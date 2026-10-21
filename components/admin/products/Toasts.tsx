"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { s } from "./styles";

// Lightweight toast notifications for the product admin. One provider per screen;
// messages are announced politely to screen readers.

type Tone = "success" | "error" | "info";
type Toast = { id: number; tone: Tone; text: string };

type ToastApi = { push: (text: string, tone?: Tone) => void };

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const push = useCallback(
    (text: string, tone: Tone = "success") => {
      const id = ++seq.current;
      setToasts((t) => [...t.slice(-3), { id, tone, text }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), tone === "error" ? 7000 : 3500),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const all = timers.current;
    return () => all.forEach((t) => clearTimeout(t));
  }, []);

  const api = useMemo(() => ({ push }), [push]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {/* Top right, clear of the bulk action bar and the sticky save bar at the bottom. */}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-4 top-16 z-[60] flex flex-col items-center gap-2 sm:left-auto sm:items-end">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`${s.toast} pointer-events-auto flex max-w-md items-start gap-2.5 rounded-2xl px-4 py-3 text-[14px] font-bold shadow-[0_12px_32px_rgba(0,0,0,0.18)] ${
              t.tone === "error" ? "bg-sale text-white" : "bg-ink text-white"
            }`}
          >
            <Icon name={t.tone === "error" ? "alert" : t.tone === "info" ? "info" : "checkCircle"} size={18} className="mt-px shrink-0" />
            <span className="flex-1">{t.text}</span>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="-mr-1 rounded-full p-0.5 opacity-70 hover:opacity-100">
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const c = useContext(Ctx);
  // Outside a provider (shouldn't happen) fall back to a no-op so UI never crashes.
  return c ?? { push: () => undefined };
}
