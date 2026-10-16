"use server";

import { refresh } from "next/cache";
import { sessionWith } from "@/components/admin/core/guard";
import { audit } from "@/lib/auth";
import { getCustomer, saveCustomer, withLock } from "@/lib/store";

export type BlockState = { ok?: boolean; message?: string };

/**
 * Block or unblock a shopper account. A blocked shopper is signed out on their next
 * request (getCurrentCustomer ignores them) and can't request or verify a sign-in code.
 */
export async function setCustomerBlockedAction(_prev: BlockState, form: FormData): Promise<BlockState> {
  const s = await sessionWith("orders:write");
  if (!s) return { ok: false, message: "You don't have permission to block shoppers." };

  const id = String(form.get("id") ?? "");
  const blocked = form.get("blocked") === "1";
  if (!/^[\w-]{1,64}$/.test(id)) return { ok: false, message: "Unknown account." };

  const result = await withLock(`customer:${id}`, async () => {
    const c = await getCustomer(id);
    if (!c) return null;
    await saveCustomer({ ...c, blocked: blocked || undefined });
    return c;
  });
  if (!result) return { ok: false, message: "That account no longer exists." };

  const who = result.name || result.email || result.phone || id;
  await audit(s, blocked ? "customer.block" : "customer.unblock", id, who);
  refresh();
  return { ok: true, message: blocked ? `${who} is blocked and signed out.` : `${who} can sign in again.` };
}
