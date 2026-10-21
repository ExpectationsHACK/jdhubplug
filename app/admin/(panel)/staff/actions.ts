"use server";

import { refresh } from "next/cache";
import { sessionWith } from "@/components/admin/core/guard";
import { isEmail } from "@/components/admin/core/settings-schema";
import { ROLE_LABEL, audit, hashPassword } from "@/lib/auth";
import { deleteStaff, findStaffByEmail, listStaff, saveStaff, withLock } from "@/lib/store";
import type { StaffUser } from "@/lib/types";

export type StaffState = { ok?: boolean; message?: string; errors?: Partial<Record<"name" | "email" | "role" | "password", string>> };

const STAFF_ROLES = ["manager", "support"] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

const MIN_PASSWORD = 10;

const field = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
};

const cleanName = (s: string) => s.replace(/[\u0000-\u001f\u007f<>]+/g, "").replace(/\s+/g, " ").trim();

function checkPassword(password: string, email?: string) {
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (password.length > 200) return "That password is too long.";
  if (/^(.)\1+$/.test(password)) return "Pick a less predictable password.";
  if (email && password.toLowerCase() === email.toLowerCase()) return "The password can't be the email address.";
  return null;
}

const owner = () => sessionWith("staff:manage");

export async function addStaffAction(_prev: StaffState, form: FormData): Promise<StaffState> {
  const s = await owner();
  if (!s) return { ok: false, message: "Only the owner can manage staff." };

  const name = cleanName(field(form, "name"));
  const email = field(form, "email").trim().toLowerCase();
  const role = field(form, "role") as StaffRole;
  const password = field(form, "password");

  const errors: StaffState["errors"] = {};
  if (!name) errors.name = "Enter their name.";
  else if (name.length > 80) errors.name = "Keep the name under 80 characters.";
  if (!isEmail(email)) errors.email = "Enter a valid email address.";
  else if (email === "owner" || email === (process.env.ADMIN_EMAIL ?? "").toLowerCase()) errors.email = "That email belongs to the owner sign-in.";
  if (!STAFF_ROLES.includes(role)) errors.role = "Choose Manager or Support.";
  const pw = checkPassword(password, email);
  if (pw) errors.password = pw;
  if (Object.keys(errors).length) return { ok: false, errors, message: "Check the highlighted fields." };

  // Lock so two quick submits can't create the same email twice.
  const result = await withLock("staff", async () => {
    if (await findStaffByEmail(email)) return "duplicate" as const;
    const { hash, salt } = await hashPassword(password);
    const user: StaffUser = {
      id: `S-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 6)}`,
      name,
      email,
      role,
      passwordHash: hash,
      salt,
      active: true,
      createdAt: new Date().toISOString(),
    };
    await saveStaff(user);
    return user;
  });
  if (result === "duplicate") return { ok: false, errors: { email: "Someone on your team already uses this email." }, message: "Check the highlighted fields." };

  await audit(s, "staff.create", result.email, `${result.name} as ${ROLE_LABEL[result.role]}`);
  refresh();
  return { ok: true, message: `${result.name} can now sign in with ${result.email}. Share the temporary password privately.` };
}

/** Row actions: reset password, change role, activate/deactivate, delete. */
export async function updateStaffAction(_prev: StaffState, form: FormData): Promise<StaffState> {
  const s = await owner();
  if (!s) return { ok: false, message: "Only the owner can manage staff." };

  const id = field(form, "id");
  const intent = field(form, "intent");
  const user = (await listStaff()).find((u) => u.id === id);
  if (!user) return { ok: false, message: "That staff member no longer exists." };
  if (user.id === s.sub) return { ok: false, message: "You can't change your own account here." };
  if (user.role === "owner") return { ok: false, message: "Owner accounts can't be changed here." };

  switch (intent) {
    case "password": {
      const password = field(form, "password");
      const pw = checkPassword(password, user.email);
      if (pw) return { ok: false, errors: { password: pw }, message: pw };
      const { hash, salt } = await hashPassword(password);
      await saveStaff({ ...user, passwordHash: hash, salt });
      await audit(s, "staff.password_reset", user.email);
      refresh();
      return { ok: true, message: `New password set for ${user.name}. Share it privately.` };
    }
    case "role": {
      const role = field(form, "role") as StaffRole;
      if (!STAFF_ROLES.includes(role)) return { ok: false, errors: { role: "Choose Manager or Support." }, message: "Choose Manager or Support." };
      if (role === user.role) return { ok: true, message: `${user.name} is already ${ROLE_LABEL[role]}.` };
      await saveStaff({ ...user, role });
      await audit(s, "staff.role", user.email, `${ROLE_LABEL[user.role]} → ${ROLE_LABEL[role]}`);
      refresh();
      return { ok: true, message: `${user.name} is now ${ROLE_LABEL[role]}. They'll be asked to sign in again.` };
    }
    case "activate":
    case "deactivate": {
      const active = intent === "activate";
      if (user.active === active) return { ok: true, message: `${user.name} is already ${active ? "active" : "deactivated"}.` };
      await saveStaff({ ...user, active });
      await audit(s, active ? "staff.activate" : "staff.deactivate", user.email);
      refresh();
      return { ok: true, message: active ? `${user.name} can sign in again.` : `${user.name} is deactivated and can't sign in.` };
    }
    case "delete": {
      if (field(form, "confirm") !== user.email) return { ok: false, message: "Confirmation didn't match." };
      await deleteStaff(user.id);
      await audit(s, "staff.delete", user.email, user.name);
      refresh();
      return { ok: true, message: `${user.name} was removed from your team.` };
    }
    default:
      return { ok: false, message: "Unknown action." };
  }
}
