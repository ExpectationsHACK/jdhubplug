"use client";

import { useCallback, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { useToast } from "./Toasts";

// Optimistic edits for product rows. A change shows immediately; the Server Action
// refreshes the page data in the same response, and if it fails the row falls back to
// the server's value (React drops the optimistic patch when the transition ends).

type Result = { ok: true; message?: string } | { ok: false; error: string };

type Patch<T> = { ids: string[]; patch: (row: T) => T | null };

export function useOptimisticRows<T extends { id: string }>(rows: T[]) {
  const [optimistic, apply] = useOptimistic(rows, (state: T[], u: Patch<T>) => {
    const ids = new Set(u.ids);
    return state.flatMap((r) => {
      if (!ids.has(r.id)) return [r];
      const next = u.patch(r);
      return next ? [next] : [];
    });
  });
  const [, startTransition] = useTransition();
  const [pending, setPending] = useState<Map<string, number>>(() => new Map());
  const [flash, setFlash] = useState<Set<string>>(() => new Set());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const toast = useToast();

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  const mark = useCallback((ids: string[], by: 1 | -1) => {
    setPending((prev) => {
      const next = new Map(prev);
      for (const id of ids) {
        const n = (next.get(id) ?? 0) + by;
        if (n > 0) next.set(id, n);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const run = useCallback(
    (ids: string[], patch: (row: T) => T | null, call: () => Promise<Result>, opts: { quiet?: boolean; onDone?: (ok: boolean) => void } = {}) => {
      mark(ids, 1);
      startTransition(async () => {
        apply({ ids, patch });
        let res: Result;
        try {
          res = await call();
        } catch {
          res = { ok: false, error: "Couldn't reach the server. Check your connection and try again." };
        }
        mark(ids, -1);
        if (res.ok) {
          if (res.message && !opts.quiet) toast.push(res.message);
          setFlash((prev) => new Set([...prev, ...ids]));
          timers.current.push(
            setTimeout(() => {
              setFlash((prev) => {
                const next = new Set(prev);
                ids.forEach((id) => next.delete(id));
                return next;
              });
            }, 1300),
          );
        } else {
          toast.push(res.error, "error");
        }
        opts.onDone?.(res.ok);
      });
    },
    [apply, mark, toast],
  );

  return { rows: optimistic, run, isPending: (id: string) => pending.has(id), isFlashing: (id: string) => flash.has(id) };
}
