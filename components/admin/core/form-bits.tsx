"use client";

import { cloneElement, isValidElement, useId, useTransition } from "react";
import { inputCls, labelCls } from "../ui";
import { AdminIcon } from "./icons";

// Form primitives for admin-core client forms: labelled fields with hint and error
// text wired up through aria-describedby, a switch, and a naira input.

type ControlProps = { id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string };

/**
 * A labelled field. Pass exactly one input/select/textarea as the child; it receives
 * the id, aria-invalid and aria-describedby automatically.
 */
export function FormField({
  label,
  hint,
  error,
  children,
  className = "",
  optional,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactElement<ControlProps>;
  className?: string;
  optional?: boolean;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const describedBy = [error ? errId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;
  const control = isValidElement(children) ? cloneElement(children, { id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy }) : children;
  return (
    <div className={className}>
      <label htmlFor={id} className={labelCls}>
        {label}
        {optional && <span className="ml-1 font-normal text-muted">(optional)</span>}
      </label>
      {control}
      {error && (
        <p id={errId} className="mt-1.5 flex items-start gap-1 text-[12px] font-bold text-sale">
          <AdminIcon name="alert" size={13} className="mt-px shrink-0" />
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="mt-1 text-[12px] text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * onSubmit handler that dispatches a useActionState action without React's automatic
 * form reset, so a failed validation doesn't wipe what the user typed. Keep `action=`
 * on the form too: before hydration the browser still posts it natively.
 */
export function useSubmitKeepingValues(dispatch: (fd: FormData) => void) {
  const [, start] = useTransition();
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    start(() => dispatch(fd));
  };
}

/** Error-aware input class. */
export const fieldCls = (error?: string) => `${inputCls} ${error ? "border-sale ring-1 ring-sale/30" : ""} disabled:bg-stage disabled:text-ink-2`;

/** A checkbox styled as a switch. Submits "on" when checked, like a plain checkbox. */
export function Switch({
  name,
  label,
  description,
  defaultChecked,
  checked,
  onChange,
  disabled,
}: {
  name?: string;
  label: string;
  description?: React.ReactNode;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-[14px] font-bold text-ink">
          {label}
        </label>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      <span className="relative inline-flex shrink-0">
        <input
          id={id}
          type="checkbox"
          role="switch"
          name={name}
          defaultChecked={defaultChecked}
          checked={checked}
          onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
          disabled={disabled}
          className="peer h-7 w-12 cursor-pointer appearance-none rounded-full bg-[#d4d4d4] outline-none transition-colors checked:bg-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-5 motion-reduce:transition-none"
        />
      </span>
    </div>
  );
}

/** Naira amount input with a ₦ prefix. Accepts "3,500" or "3500"; the server parses it. */
export function MoneyInput(props: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  const { error, className = "", ...rest } = props;
  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] font-bold text-muted">
        ₦
      </span>
      <input type="text" inputMode="numeric" autoComplete="off" {...rest} className={`${fieldCls(error)} pl-7 tabular-nums ${className}`} />
    </div>
  );
}
