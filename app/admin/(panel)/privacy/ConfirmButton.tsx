"use client";

import { useFormStatus } from "react-dom";

/** Submit button that asks for confirmation first (for irreversible admin actions). */
export function ConfirmButton({ message, children, className = "" }: { message: string; children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      className={className}
    >
      {pending ? "Working…" : children}
    </button>
  );
}
