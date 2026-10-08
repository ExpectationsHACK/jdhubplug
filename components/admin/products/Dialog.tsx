"use client";

import { useEffect, useId, useLayoutEffect, useRef } from "react";
import { Icon } from "@/components/Icon";
import { s } from "./styles";

// Modal dialog on the native <dialog> element: focus is trapped and restored, Esc
// closes it, and the page behind is inert.

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  tone = "default",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
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

  // Close when the screen is hidden by a navigation (Activity keeps it mounted).
  useLayoutEffect(() => {
    const d = ref.current;
    return () => {
      if (d?.open) d.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Click on the backdrop (the dialog element itself) closes.
        if (e.target === e.currentTarget) onClose();
      }}
      className={`${s.dialog} m-auto w-[min(92vw,460px)] rounded-[20px] border-0 bg-white p-0 text-ink shadow-[0_24px_64px_rgba(0,0,0,0.25)]`}
    >
      {open && (
        <div className="p-6">
          <div className="flex items-start gap-3">
            {tone === "danger" && (
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#fde8ef] text-sale">
                <Icon name="alert" size={20} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="display text-[20px]">
                {title}
              </h2>
              {description && (
                <div id={descId} className="mt-1.5 text-[14px] text-ink-2">
                  {description}
                </div>
              )}
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 -mt-1 rounded-full p-1.5 text-muted hover:bg-stage hover:text-ink">
              <Icon name="close" size={20} />
            </button>
          </div>
          {children && <div className="mt-5">{children}</div>}
          {footer && <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
