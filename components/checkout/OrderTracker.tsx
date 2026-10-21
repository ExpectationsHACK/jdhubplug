import type { DeliveryMethod, OrderEvent, OrderStatus } from "@/lib/types";
import { Icon } from "../Icon";
import { CommerceMotion } from "./Motion";

const FLOW: OrderStatus[] = ["pending", "paid", "processing", "shipped", "delivered", "completed"];

const fmt = (iso: string) =>
  new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" }).format(new Date(iso));

/** Animated order progress: the bar sweeps to the current step and the current dot pulses. */
export function OrderTracker({ status, delivery, history }: { status: OrderStatus; delivery: DeliveryMethod; history: OrderEvent[] }) {
  const stopped = status === "cancelled" || status === "refunded";
  // A stopped order shows how far it got before it was cancelled/refunded.
  const reached = stopped
    ? Math.max(0, ...history.map((h) => FLOW.indexOf(h.status as OrderStatus)).filter((i) => i >= 0))
    : FLOW.indexOf(status);
  const when = (s: OrderStatus) => [...history].reverse().find((h) => h.status === s)?.at;
  const steps: { s: OrderStatus; label: string; hint: string }[] = [
    { s: "pending", label: "Awaiting payment", hint: "Items reserved" },
    { s: "paid", label: "Paid", hint: "Held in escrow" },
    { s: "processing", label: "Processing", hint: "Inspected & packed" },
    { s: "shipped", label: delivery === "pickup" ? "Ready at hub" : "Shipped", hint: delivery === "pickup" ? "Come pick it up" : "On its way" },
    { s: "delivered", label: delivery === "pickup" ? "Collected" : "Delivered", hint: "Check window per our returns policy" },
    { s: "completed", label: "Completed", hint: "Escrow released" },
  ];
  const p = reached / (steps.length - 1);

  return (
    <div>
      <CommerceMotion />
      {stopped && (
        <p className="jdc-in-up mb-5 flex items-start gap-2 rounded-xl bg-sale/10 p-4 text-[14px] font-bold text-sale" role="status">
          <Icon name="alert" size={20} className="shrink-0" />
          {status === "cancelled"
            ? "This order was cancelled and the items were released. No payment is due."
            : "This order was refunded. The money is on its way back to you."}
        </p>
      )}
      <ol className="relative grid gap-5 md:grid-cols-6 md:gap-2">
        {/* Track: vertical on phones, horizontal from md up. */}
        <span aria-hidden className="absolute bottom-4 left-[15px] top-4 w-0.5 rounded bg-line md:hidden" />
        <span
          aria-hidden
          className={`jdc-grow-y absolute left-[15px] top-4 w-0.5 rounded md:hidden ${stopped ? "bg-muted" : "bg-ink"}`}
          style={{ ["--p" as string]: p, height: "calc(100% - 32px)" }}
        />
        <span aria-hidden className="absolute left-[calc(100%/12)] right-[calc(100%/12)] top-[15px] hidden h-0.5 rounded bg-line md:block" />
        <span
          aria-hidden
          className={`jdc-grow absolute left-[calc(100%/12)] top-[15px] hidden h-0.5 rounded md:block ${stopped ? "bg-muted" : "bg-ink"}`}
          style={{ ["--p" as string]: p, width: "calc(100% - 100%/6)" }}
        />
        {steps.map((st, i) => {
          const done = i < reached || (i === reached && (status === "completed" || stopped));
          const current = i === reached && !stopped && status !== "completed";
          const at = i <= reached ? when(st.s) : undefined;
          return (
            <li
              key={st.s}
              className="relative flex items-start gap-4 md:flex-col md:items-center md:gap-3 md:text-center"
              aria-current={current ? "step" : undefined}
            >
              <span className="relative grid h-8 w-8 shrink-0 place-items-center">
                {current && <span aria-hidden className="jdc-ping absolute inset-0 rounded-full bg-accent" />}
                <span
                  className={`jdc-pop relative grid h-8 w-8 place-items-center rounded-full border-2 text-[12px] font-bold ${
                    done
                      ? stopped
                        ? "border-muted bg-muted text-white"
                        : "border-ink bg-ink text-white"
                      : current
                        ? "border-accent bg-accent text-white"
                        : "border-line bg-white text-muted"
                  }`}
                  style={{ animationDelay: `${200 + i * 160}ms` }}
                >
                  {done ? (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="jdc-check" style={{ ["--len" as string]: 22 }}>
                      <path d="m5 12.5 4.5 4.5L19 7.5" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
              </span>
              <span className="min-w-0 pt-1 md:pt-0">
                <span className={`block text-[14px] font-bold ${i > reached ? "text-muted" : ""}`}>{st.label}</span>
                <span className="block text-[12px] text-muted">{at ? fmt(at) : st.hint}</span>
              </span>
              <span className="sr-only">{done ? "(done)" : current ? "(current step)" : "(upcoming)"}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
