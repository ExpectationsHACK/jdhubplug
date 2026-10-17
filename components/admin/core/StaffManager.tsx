"use client";

import { useActionState, useId, useRef, useState } from "react";
import { addStaffAction, updateStaffAction, type StaffState } from "@/app/admin/(panel)/staff/actions";
import { Badge } from "../ui";
import { FormField, fieldCls, useSubmitKeepingValues } from "./form-bits";
import { ago, fmtWhen, initials } from "./format";
import { AdminIcon } from "./icons";

// Staff list with add / reset password / change role / activate / delete. Dialogs use
// the native <dialog> element (focus trap, Escape to close, inert background for free).

export type SafeStaff = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "manager" | "support";
  active: boolean;
  createdAt: string;
  lastLoginAt?: string;
};

type Mode = { kind: "add" } | { kind: "password" | "role" | "delete"; user: SafeStaff };

const ROLE_TEXT = { owner: "Owner", manager: "Manager", support: "Support" } as const;

/** 14 characters from an alphabet without look-alikes (no 0/O, 1/l/I). */
function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  const raw = [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
  return `${raw.slice(0, 5)}-${raw.slice(5, 10)}-${raw.slice(10)}`;
}

export function StaffManager({ staff, now }: { staff: SafeStaff[]; now: number }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [toast, setToast] = useState<{ text: string; ok: boolean; at: number } | null>(null);
  const [rowState, rowAction, rowPending] = useActionState<StaffState, FormData>(async (prev, fd) => {
    const res = await updateStaffAction(prev, fd);
    if (res.message) setToast({ text: res.message, ok: !!res.ok, at: Date.now() });
    return res;
  }, {});

  const open = (m: Mode) => {
    setMode(m);
    requestAnimationFrame(() => dialog.current?.showModal());
  };
  const close = () => dialog.current?.close();
  const onDone = (message: string) => {
    setToast({ text: message, ok: true, at: Date.now() });
    close();
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="min-h-5 text-[13px]">
          {toast && (
            <span key={toast.at} className={`inline-flex items-center gap-1.5 font-bold ${toast.ok ? "text-ok" : "text-sale"}`}>
              <AdminIcon name={toast.ok ? "check" : "alert"} size={15} strokeWidth={2} />
              {toast.text}
            </span>
          )}
        </p>
        <button type="button" onClick={() => open({ kind: "add" })} className="btn btn-primary">
          <AdminIcon name="plus" size={16} />
          Add staff
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <ul className="divide-y divide-line">
          <li className="flex flex-wrap items-center gap-3 px-4 py-3.5 md:px-5">
            <Avatar name="Owner" dark />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold">Owner</p>
              <p className="text-[12px] text-muted">Signs in with the ADMIN_PASSWORD environment variable</p>
            </div>
            <Badge tone="blue">Owner</Badge>
          </li>
          {staff.map((u) => (
            <li key={u.id} className={`flex flex-col gap-3 px-4 py-3.5 transition-opacity md:flex-row md:items-center md:px-5 ${u.active ? "" : "opacity-70"}`}>
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar name={u.name} />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-[14px] font-bold">
                    <span className="truncate">{u.name}</span>
                    <Badge tone={u.role === "manager" ? "purple" : "neutral"}>{ROLE_TEXT[u.role]}</Badge>
                    {!u.active && <Badge tone="red">Deactivated</Badge>}
                  </p>
                  <p className="truncate text-[12px] text-muted">{u.email}</p>
                </div>
              </div>
              <p className="text-[12px] text-muted md:w-36 md:text-right">
                {u.lastLoginAt ? (
                  <>
                    Last sign-in <time dateTime={u.lastLoginAt} title={fmtWhen(u.lastLoginAt)}>
                      {ago(u.lastLoginAt, now)}
                    </time>
                  </>
                ) : (
                  "Never signed in"
                )}
              </p>
              <div className="flex flex-wrap items-center gap-1 md:justify-end">
                <RowBtn icon="key" label="Reset password" onClick={() => open({ kind: "password", user: u })} />
                <RowBtn icon="shieldUser" label="Change role" onClick={() => open({ kind: "role", user: u })} />
                <form action={rowAction}>
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="intent" value={u.active ? "deactivate" : "activate"} />
                  <button
                    disabled={rowPending}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[12px] font-bold outline-none transition-colors hover:border-ink focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
                  >
                    {u.active ? "Deactivate" : "Activate"}
                    <span className="sr-only"> {u.name}</span>
                  </button>
                </form>
                <RowBtn icon="trash" label="Delete" danger onClick={() => open({ kind: "delete", user: u })} />
              </div>
            </li>
          ))}
        </ul>
        {!staff.length && (
          <div className="border-t border-line px-6 py-10 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-stage">
              <AdminIcon name="users" size={22} />
            </span>
            <p className="mt-3 text-[15px] font-bold">Just you for now</p>
            <p className="mx-auto mt-1 max-w-sm text-[13px] text-ink-2">Give managers and support staff their own sign-in, so every change in the activity log shows who made it.</p>
          </div>
        )}
      </div>
      {rowState.ok === false && !toast && <p className="mt-2 text-[13px] font-bold text-sale">{rowState.message}</p>}

      <dialog
        ref={dialog}
        onClose={() => setMode(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        aria-labelledby="staff-dialog-title"
        className="m-auto w-[calc(100%-32px)] max-w-md rounded-2xl bg-white p-0 shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px]"
      >
        {mode?.kind === "add" && <AddForm onDone={onDone} onCancel={close} />}
        {mode?.kind === "password" && <PasswordForm user={mode.user} onDone={onDone} onCancel={close} />}
        {mode?.kind === "role" && <RoleForm user={mode.user} onDone={onDone} onCancel={close} />}
        {mode?.kind === "delete" && <DeleteForm user={mode.user} onDone={onDone} onCancel={close} />}
      </dialog>
    </div>
  );
}

function Avatar({ name, dark }: { name: string; dark?: boolean }) {
  return (
    <span aria-hidden className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-[13px] font-bold ${dark ? "bg-ink text-white" : "bg-stage text-ink-2"}`}>
      {initials(name)}
    </span>
  );
}

function RowBtn({ icon, label, onClick, danger }: { icon: React.ComponentProps<typeof AdminIcon>["name"]; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
        danger ? "text-ink-2 hover:bg-[#fde8ef] hover:text-sale" : "text-ink-2 hover:bg-stage hover:text-ink"
      }`}
    >
      <AdminIcon name={icon} size={15} />
      <span>{label}</span>
    </button>
  );
}

function DialogShell({ title, description, children }: { title: string; description?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="p-5 md:p-6">
      <h2 id="staff-dialog-title" className="display text-[20px]">
        {title}
      </h2>
      {description && <p className="mt-1 text-[13px] text-ink-2">{description}</p>}
      <div className="mt-5">{children}</div>
    </div>
  );
}

function Actions({ pending, label, onCancel, danger, disabled }: { pending: boolean; label: string; onCancel: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <div className="mt-6 flex justify-end gap-2">
      <button type="button" onClick={onCancel} className="btn btn-outline">
        Cancel
      </button>
      <button disabled={pending || disabled} className={`btn ${danger ? "border-sale bg-sale text-white hover:bg-[#c00040]" : "btn-primary"}`}>
        {pending ? "Saving…" : label}
      </button>
    </div>
  );
}

function PasswordField({ error, label = "Temporary password" }: { error?: string; label?: string }) {
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <FormField label={label} error={error} hint="At least 10 characters. They can't change it themselves yet, so share it privately.">
      <PasswordInput
        value={value}
        show={show}
        copied={copied}
        onChange={(v) => {
          setValue(v);
          setCopied(false);
        }}
        onToggle={() => setShow((s) => !s)}
        onGenerate={() => {
          setValue(generatePassword());
          setShow(true);
          setCopied(false);
        }}
        onCopy={() => {
          void navigator.clipboard?.writeText(value).then(() => setCopied(true));
        }}
        error={error}
      />
    </FormField>
  );
}

function PasswordInput({
  value,
  show,
  copied,
  onChange,
  onToggle,
  onGenerate,
  onCopy,
  error,
  ...aria
}: {
  value: string;
  show: boolean;
  copied: boolean;
  onChange: (v: string) => void;
  onToggle: () => void;
  onGenerate: () => void;
  onCopy: () => void;
  error?: string;
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  return (
    <div>
      <div className="relative">
        <input
          {...aria}
          name="password"
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="new-password"
          minLength={10}
          maxLength={200}
          required
          className={`${fieldCls(error)} pr-11 font-mono`}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
        >
          <AdminIcon name={show ? "eyeOff" : "eye"} size={17} />
        </button>
      </div>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={onGenerate} className="inline-flex items-center gap-1.5 rounded-full bg-stage px-3 py-1.5 text-[12px] font-bold outline-none hover:bg-line focus-visible:ring-2 focus-visible:ring-accent">
          <AdminIcon name="sparkle" size={13} /> Generate
        </button>
        <button
          type="button"
          onClick={onCopy}
          disabled={!value}
          className="inline-flex items-center gap-1.5 rounded-full bg-stage px-3 py-1.5 text-[12px] font-bold outline-none hover:bg-line focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
        >
          <AdminIcon name={copied ? "check" : "copy"} size={13} /> {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

type FormProps = { onDone: (message: string) => void; onCancel: () => void };

/** Action state for a dialog form; closes the dialog on success and never resets typed values. */
function useStaffForm(fn: typeof addStaffAction, onDone: (m: string) => void) {
  const [state, action, pending] = useActionState<StaffState, FormData>(async (prev, fd) => {
    const res = await fn(prev, fd);
    if (res.ok && res.message) onDone(res.message);
    return res;
  }, {});
  const onSubmit = useSubmitKeepingValues(action);
  return { state, action, pending, onSubmit };
}

function AddForm({ onDone, onCancel }: FormProps) {
  const { state, action, pending, onSubmit } = useStaffForm(addStaffAction, onDone);
  const e = state.errors ?? {};
  return (
    <DialogShell title="Add a team member" description="They sign in at /admin/login with their email and this temporary password.">
      <form action={action} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormField label="Name" error={e.name}>
          <input name="name" autoComplete="off" maxLength={80} required className={fieldCls(e.name)} autoFocus />
        </FormField>
        <FormField label="Email" error={e.email}>
          <input name="email" type="email" autoComplete="off" maxLength={200} required className={fieldCls(e.email)} />
        </FormField>
        <RolePicker error={e.role} />
        <PasswordField error={e.password} />
        {state.ok === false && state.message && !Object.keys(e).length && (
          <p role="alert" className="text-[13px] font-bold text-sale">
            {state.message}
          </p>
        )}
        <Actions pending={pending} label="Add staff" onCancel={onCancel} />
      </form>
    </DialogShell>
  );
}

function RolePicker({ error, current }: { error?: string; current?: "manager" | "support" }) {
  const id = useId();
  return (
    <fieldset aria-describedby={error ? `${id}-err` : undefined}>
      <legend className="mb-1.5 text-[13px] font-bold text-ink-2">Role</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {(
          [
            ["manager", "Manager", "Products, stock, orders, offers, requests and settings."],
            ["support", "Support", "Orders and requests only. Settings are view-only."],
          ] as const
        ).map(([value, label, body]) => (
          <label key={value} className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line p-3 transition-colors has-[:checked]:border-ink has-[:checked]:bg-stage/60">
            <input type="radio" name="role" value={value} defaultChecked={(current ?? "support") === value} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--ink)]" />
            <span>
              <span className="block text-[14px] font-bold">{label}</span>
              <span className="block text-[12px] text-muted">{body}</span>
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p id={`${id}-err`} className="mt-1.5 text-[12px] font-bold text-sale">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function PasswordForm({ user, onDone, onCancel }: FormProps & { user: SafeStaff }) {
  const { state, action, pending, onSubmit } = useStaffForm(updateStaffAction, onDone);
  return (
    <DialogShell title={`Reset ${user.name}'s password`} description="Their current password stops working straight away.">
      <form action={action} onSubmit={onSubmit} noValidate>
        <input type="hidden" name="id" value={user.id} />
        <input type="hidden" name="intent" value="password" />
        <PasswordField label="New temporary password" error={state.errors?.password} />
        {state.ok === false && state.message && !state.errors && (
          <p role="alert" className="mt-3 text-[13px] font-bold text-sale">
            {state.message}
          </p>
        )}
        <Actions pending={pending} label="Set password" onCancel={onCancel} />
      </form>
    </DialogShell>
  );
}

function RoleForm({ user, onDone, onCancel }: FormProps & { user: SafeStaff }) {
  const { state, action, pending, onSubmit } = useStaffForm(updateStaffAction, onDone);
  return (
    <DialogShell title={`Change ${user.name}'s role`} description="They'll be asked to sign in again so the new permissions apply.">
      <form action={action} onSubmit={onSubmit}>
        <input type="hidden" name="id" value={user.id} />
        <input type="hidden" name="intent" value="role" />
        <RolePicker error={state.errors?.role} current={user.role === "manager" ? "manager" : "support"} />
        {state.ok === false && state.message && !state.errors && (
          <p role="alert" className="mt-3 text-[13px] font-bold text-sale">
            {state.message}
          </p>
        )}
        <Actions pending={pending} label="Save role" onCancel={onCancel} />
      </form>
    </DialogShell>
  );
}

function DeleteForm({ user, onDone, onCancel }: FormProps & { user: SafeStaff }) {
  const { state, action, pending, onSubmit } = useStaffForm(updateStaffAction, onDone);
  return (
    <DialogShell
      title={`Remove ${user.name}?`}
      description={
        <>
          They won&apos;t be able to sign in again. Their past actions stay in the activity log. To pause access instead, use <b>Deactivate</b>.
        </>
      }
    >
      <form action={action} onSubmit={onSubmit}>
        <input type="hidden" name="id" value={user.id} />
        <input type="hidden" name="intent" value="delete" />
        <input type="hidden" name="confirm" value={user.email} />
        {state.ok === false && state.message && (
          <p role="alert" className="text-[13px] font-bold text-sale">
            {state.message}
          </p>
        )}
        <Actions pending={pending} label="Remove" danger onCancel={onCancel} />
      </form>
    </DialogShell>
  );
}
