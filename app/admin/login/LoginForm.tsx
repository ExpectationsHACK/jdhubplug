"use client";

import { use, useActionState, useState } from "react";
import { inputCls, labelCls } from "@/components/admin/ui";
import { useSubmitKeepingValues } from "@/components/admin/core/form-bits";
import { AdminIcon } from "@/components/admin/core/icons";
import { loginAction, type LoginState } from "../actions";

export function LoginForm({ next, devHint, notice }: { next: Promise<string>; devHint: boolean; notice?: string }) {
  const nextPath = use(next);
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  // Keep the email when a sign-in fails (React would otherwise reset the form).
  const onSubmit = useSubmitKeepingValues(action);

  return (
    <form action={action} onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="next" value={nextPath} />
      {notice && !state.error && (
        <p role="status" className="flex items-start gap-2 rounded-xl bg-[#eef3ff] px-3 py-2.5 text-[13px] text-accent-deep">
          <AdminIcon name="info" size={16} className="mt-px shrink-0" />
          {notice}
        </p>
      )}
      <label className="block">
        <span className={labelCls}>
          Email <span className="font-normal text-muted">(staff only)</span>
        </span>
        <input name="email" type="email" autoComplete="username" placeholder="Leave empty if you're the owner" className={inputCls} />
      </label>
      <div>
        <label htmlFor="admin-password" className={labelCls}>
          Password
        </label>
        <div className="relative">
          <input
            id="admin-password"
            name="password"
            type={show ? "text" : "password"}
            required
            autoComplete="current-password"
            aria-describedby={caps ? "caps-hint" : undefined}
            onKeyUp={(e) => setCaps(e.getModifierState("CapsLock"))}
            className={`${inputCls} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
          >
            <AdminIcon name={show ? "eyeOff" : "eye"} size={17} />
          </button>
        </div>
        {caps && (
          <p id="caps-hint" className="mt-1.5 text-[12px] font-bold text-[#b45309]">
            Caps Lock is on.
          </p>
        )}
      </div>
      {state.error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-[#fde8ef] px-3 py-2.5 text-[13px] font-bold text-sale">
          <AdminIcon name="alert" size={16} className="mt-px shrink-0" />
          {state.error}
        </p>
      )}
      <button disabled={pending} className="btn btn-primary btn-lg w-full">
        {pending ? (
          <>
            <AdminIcon name="refresh" size={16} className="motion-safe:animate-spin" /> Signing in…
          </>
        ) : (
          <>
            Sign in <AdminIcon name="chevronRight" size={16} />
          </>
        )}
      </button>
      {devHint && <p className="text-center text-[12px] text-muted">Development password: jdhub-admin</p>}
    </form>
  );
}
