"use client";

import { use, useActionState } from "react";
import { inputCls, labelCls } from "@/components/admin/ui";
import { loginAction, type LoginState } from "../actions";

export function LoginForm({ next, devHint }: { next: Promise<string>; devHint: boolean }) {
  const nextPath = use(next);
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={nextPath} />
      <label className="block">
        <span className={labelCls}>Email (staff only)</span>
        <input name="email" type="email" autoComplete="username" placeholder="Leave empty if you're the owner" className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>Password</span>
        <input name="password" type="password" required autoComplete="current-password" className={inputCls} />
      </label>
      {state.error && <p className="rounded-xl bg-[#fde8ef] px-3 py-2 text-[13px] font-bold text-sale">{state.error}</p>}
      <button disabled={pending} className="btn btn-primary btn-lg w-full">
        {pending ? "Signing in…" : "Sign in"}
      </button>
      {devHint && <p className="text-center text-[12px] text-muted">Development password: jdhub-admin</p>}
    </form>
  );
}
