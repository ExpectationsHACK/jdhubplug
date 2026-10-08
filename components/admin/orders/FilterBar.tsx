"use client";

import Form from "next/form";
import { useEffect, useRef } from "react";
import { selectCls } from "../ui";

// URL-driven filter bar for admin lists. It is a plain GET form (works without JS);
// with JS it navigates client-side, submitting as you type (debounced) or pick an option.

export type FilterSelect = { name: string; label: string; value: string; options: { value: string; label: string }[] };

export function FilterBar({
  action,
  q,
  placeholder,
  selects = [],
  hidden = {},
}: {
  action: string;
  q: string;
  placeholder: string;
  selects?: FilterSelect[];
  /** Params to keep (e.g. the active tab). */
  hidden?: Record<string, string>;
}) {
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const input = useRef<HTMLInputElement>(null);
  const submit = () => form.current?.requestSubmit();

  // Keep the box in sync when the URL changes elsewhere (tabs, "clear"), unless the admin is typing.
  useEffect(() => {
    const el = input.current;
    if (el && document.activeElement !== el && el.value !== q) el.value = q;
  }, [q]);

  return (
    <Form ref={form} action={action} replace scroll={false} role="search" className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <label className="relative min-w-0 flex-1 sm:min-w-[320px]">
        <span className="sr-only">Search</span>
        <svg aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4 4" />
        </svg>
        <input
          ref={input}
          type="search"
          name="q"
          defaultValue={q}
          placeholder={placeholder}
          maxLength={80}
          autoComplete="off"
          onChange={() => {
            clearTimeout(timer.current);
            timer.current = setTimeout(submit, 350);
          }}
          className="w-full rounded-full border border-line bg-white py-2.5 pl-10 pr-4 text-[14px] outline-none transition focus:border-transparent focus:ring-2 focus:ring-accent"
        />
      </label>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        {selects.map((s) => (
          <label key={s.name} className="min-w-0">
            <span className="sr-only">{s.label}</span>
            <select name={s.name} defaultValue={s.value} onChange={submit} className={`${selectCls} rounded-full py-2.5 sm:w-auto`}>
              {s.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <noscript>
        <button className="btn btn-outline">Apply</button>
      </noscript>
    </Form>
  );
}
