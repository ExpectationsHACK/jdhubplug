"use client";

import { useEffect, useId, useRef } from "react";

/**
 * Modal built on the native <dialog> element: focus is trapped, Escape closes it and
 * the page behind is inert. Controlled with `open`; `onClose` fires on Escape, the
 * backdrop or the close button.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  tone = "default",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  tone?: "default" | "danger";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={onClose}
      onClick={(e) => {
        // A click on the ::backdrop targets the dialog element itself.
        if (e.target === e.currentTarget) onClose();
      }}
      className="adm-dialog m-auto w-[calc(100%-32px)] max-w-md rounded-2xl border border-line bg-white p-0 text-ink shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px]"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className={`display text-[20px] ${tone === "danger" ? "text-sale" : ""}`}>
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="-m-1 rounded-full p-1 text-muted hover:bg-stage hover:text-ink focus-visible:outline-2 focus-visible:outline-accent">
            <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {description && (
          <div id={descId} className="mt-2 text-[14px] leading-relaxed text-ink-2">
            {description}
          </div>
        )}
        <div className="mt-5">{children}</div>
      </div>
      <style>{`
        .adm-dialog[open] { animation: adm-dialog-in .18s cubic-bezier(.2,.8,.2,1); }
        .adm-dialog[open]::backdrop { animation: adm-fade-in .18s ease; }
        @keyframes adm-dialog-in { from { opacity: 0; transform: translateY(8px) scale(.98); } }
        @keyframes adm-fade-in { from { opacity: 0; } }
        @media (prefers-reduced-motion: reduce) {
          .adm-dialog[open], .adm-dialog[open]::backdrop { animation: none; }
        }
      `}</style>
    </dialog>
  );
}
