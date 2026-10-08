"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { resendCodeAction, sendCodeAction, verifyCodeAction, type CodeState } from "./actions";

export function SignInForm({ next, channels }: { next: string; channels: { sms: boolean; email: boolean; dev: boolean } }) {
  const [state, setState] = useState<CodeState>({ step: "identify" });
  const [identifier, setIdentifier] = useState("");
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [cooldown, setCooldown] = useState(0);
  const [pending, start] = useTransition();
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const placeholder = channels.sms && channels.email ? "Phone number or email" : channels.email && !channels.dev ? "Email address" : channels.sms && !channels.dev ? "Phone number" : "Phone number or email";

  const submitCode = (code: string) => {
    if (state.step !== "verify" || code.length !== 6) return;
    start(async () => {
      const res = await verifyCodeAction(state, code, next);
      setState(res);
      setDigits(Array(6).fill(""));
      boxes.current[0]?.focus();
    });
  };

  const setDigit = (i: number, v: string) => {
    const clean = v.replace(/\D/g, "");
    if (clean.length > 1) {
      // Pasted or autofilled the whole code.
      const all = clean.slice(0, 6).split("");
      const filled = [...all, ...Array(6 - all.length).fill("")];
      setDigits(filled);
      boxes.current[Math.min(all.length, 5)]?.focus();
      if (all.length === 6) submitCode(all.join(""));
      return;
    }
    const nextDigits = [...digits];
    nextDigits[i] = clean;
    setDigits(nextDigits);
    if (clean && i < 5) boxes.current[i + 1]?.focus();
    if (nextDigits.every(Boolean)) submitCode(nextDigits.join(""));
  };

  if (state.step === "identify") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await sendCodeAction(identifier);
            setState(res);
            if (res.step === "verify") {
              setCooldown(30);
              setTimeout(() => boxes.current[0]?.focus(), 50);
            }
          });
        }}
        className="space-y-4"
      >
        <label className="block text-left">
          <span className="mb-1.5 block text-[14px] font-bold">{placeholder}</span>
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            autoFocus
            autoComplete="username"
            inputMode={channels.sms && !channels.email ? "tel" : "text"}
            placeholder={channels.sms || channels.dev ? "0803 123 4567" : "you@example.com"}
            className="field"
          />
        </label>
        {state.error && <p className="rounded-xl bg-[#fde8ef] px-3 py-2 text-left text-[13px] font-bold text-sale">{state.error}</p>}
        <button disabled={pending || !identifier.trim()} className="btn btn-primary btn-lg w-full">
          {pending ? "Sending code…" : "Continue"}
        </button>
        <p className="text-[12px] text-muted">We&apos;ll send a 6-digit code. No password needed. New here? This creates your account.</p>
      </form>
    );
  }

  return (
    <div className="space-y-5">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-stage">
        <Icon name={state.channel === "sms" ? "smartphone" : "mail"} size={26} />
      </div>
      <p className="text-[15px] text-ink-2">
        Enter the code we sent to <b className="text-ink">{state.display}</b>
      </p>
      {state.devCode && (
        <p className="rounded-xl bg-[#eef3ff] px-3 py-2 text-[13px] text-accent-deep">
          Development mode (no SMS/email provider): your code is <b className="tracking-widest">{state.devCode}</b>
        </p>
      )}
      <div className="flex justify-center gap-2" role="group" aria-label="6-digit code">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              boxes.current[i] = el;
            }}
            value={d}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !digits[i] && i > 0) boxes.current[i - 1]?.focus();
            }}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={i === 0 ? 6 : 1}
            aria-label={`Digit ${i + 1}`}
            disabled={pending}
            className="h-14 w-11 rounded-xl border border-line text-center text-[22px] font-bold outline-none transition focus:border-transparent focus:ring-2 focus:ring-accent sm:w-12"
          />
        ))}
      </div>
      {pending && <p className="text-[13px] text-muted">Checking…</p>}
      {state.error && <p className="rounded-xl bg-[#fde8ef] px-3 py-2 text-[13px] font-bold text-sale">{state.error}</p>}
      {state.resent && !state.error && <p className="text-[13px] font-bold text-ok">New code sent.</p>}
      <div className="flex items-center justify-center gap-4 text-[14px]">
        <button
          type="button"
          disabled={cooldown > 0 || pending}
          onClick={() =>
            start(async () => {
              const res = await resendCodeAction(state);
              setState(res);
              if (res.step === "verify" && res.resent) setCooldown(30);
            })
          }
          className="font-bold underline underline-offset-4 disabled:text-muted disabled:no-underline"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </button>
        <span className="text-line">|</span>
        <button type="button" onClick={() => setState({ step: "identify" })} className="font-bold underline underline-offset-4">
          Use a different {state.channel === "sms" ? "number" : "email"}
        </button>
      </div>
    </div>
  );
}
