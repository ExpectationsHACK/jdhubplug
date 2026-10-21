"use client";

import { useActionState, useState } from "react";
import { transitionOrderAction, type OrderActionState } from "@/app/admin/(panel)/orders/actions";
import type { DeliveryMethod, OrderStatus } from "@/lib/types";
import { inputCls, labelCls } from "../ui";
import { Dialog } from "./Dialog";

// Status buttons for the order detail page. Only transitions allowed by ORDER_FLOW are
// passed in (and the server re-checks), so the admin can never pick an invalid move.

type Step = {
  label: string;
  /** Opens a dialog before submitting (for inputs or a confirmation). */
  dialog?: { title: string; body: React.ReactNode; confirm: string; field?: { name: string; label: string; placeholder: string; hint?: string } };
  danger?: boolean;
};

function stepFor(next: OrderStatus, ctx: { delivery: DeliveryMethod; total: string; method: string }): Step {
  switch (next) {
    case "paid":
      return {
        label: "Mark paid",
        dialog: {
          title: "Mark as paid",
          body: (
            <>
              Confirm you&apos;ve received <b>{ctx.total}</b> by {ctx.method}. The money is held in escrow until the buyer confirms delivery.
            </>
          ),
          confirm: "Mark paid",
          field: { name: "reference", label: "Payment reference (optional)", placeholder: "e.g. bank narration or Paystack ref" },
        },
      };
    case "processing":
      return { label: "Start processing" };
    case "shipped":
      return {
        label: ctx.delivery === "pickup" ? "Ready at hub" : "Mark shipped",
        dialog: {
          title: ctx.delivery === "pickup" ? "Ready for pickup" : "Mark as shipped",
          body: ctx.delivery === "pickup" ? "Let the buyer know their order is waiting at the hub." : "The buyer can follow the order from their tracking link.",
          confirm: ctx.delivery === "pickup" ? "Mark ready" : "Mark shipped",
          field: {
            name: "note",
            label: ctx.delivery === "pickup" ? "Hub note (optional)" : "Tracking note (optional)",
            placeholder: ctx.delivery === "pickup" ? "e.g. Ask for Tunde at the front desk" : "e.g. GIG Logistics #GL123456, rider 0803…",
          },
        },
      };
    case "delivered":
      return { label: "Mark delivered" };
    case "completed":
      return {
        label: "Complete",
        dialog: {
          title: "Complete this order?",
          body: "Do this once the buyer has confirmed the item is as described. Escrow is released to the seller.",
          confirm: "Complete order",
        },
      };
    case "cancelled":
      return {
        label: "Cancel order",
        danger: true,
        dialog: {
          title: "Cancel this order?",
          body: "The reservation is released and every item goes straight back on sale. This can't be undone.",
          confirm: "Cancel order",
          field: { name: "note", label: "Reason (optional)", placeholder: "e.g. Buyer changed their mind" },
        },
      };
    case "refunded":
      return {
        label: "Refund",
        danger: true,
        dialog: {
          title: "Refund this order?",
          body: (
            <>
              Mark <b>{ctx.total}</b> as refunded to the buyer. Stock for every item is restored once, and the items go back on sale. Send the money back
              before or right after you confirm. This can&apos;t be undone.
            </>
          ),
          confirm: "Refund order",
          field: { name: "note", label: "Reason (optional)", placeholder: "e.g. Item failed inspection" },
        },
      };
    default:
      return { label: next };
  }
}

export function OrderActions({
  id,
  allowed,
  delivery,
  total,
  method,
  canWrite,
}: {
  id: string;
  allowed: OrderStatus[];
  delivery: DeliveryMethod;
  total: string;
  method: string;
  canWrite: boolean;
}) {
  const [open, setOpen] = useState<OrderStatus | null>(null);
  // Which move the latest result belongs to, so an old error doesn't show in a new dialog.
  const [submitted, setSubmitted] = useState<OrderStatus | null>(null);
  const [state, action, pending] = useActionState<OrderActionState, FormData>(async (prev, form) => {
    const res = await transitionOrderAction(prev, form);
    // Close the dialog once the server confirms the move.
    if (res.ok) setOpen(null);
    return res;
  }, {});
  const ctx = { delivery, total, method };

  if (!allowed.length) return null;
  if (!canWrite) return <p className="text-[13px] text-muted">Your role can view orders but not change them.</p>;

  // The first non-destructive move is the primary call to action.
  const primary = allowed.find((s) => !stepFor(s, ctx).danger);
  const dialogStep = open ? stepFor(open, ctx) : null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {allowed.map((next) => {
          const step = stepFor(next, ctx);
          const cls = step.danger ? "btn border-line! bg-white text-sale hover:border-sale!" : next === primary ? "btn btn-primary" : "btn btn-outline";
          if (step.dialog) {
            return (
              <button key={next} type="button" className={cls} onClick={() => setOpen(next)} disabled={pending}>
                {step.label}
              </button>
            );
          }
          return (
            <form key={next} action={action} onSubmit={() => setSubmitted(next)}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="next" value={next} />
              <button className={cls} disabled={pending}>
                {pending ? "Saving…" : step.label}
              </button>
            </form>
          );
        })}
      </div>

      <p role="status" aria-live="polite" className="mt-2 min-h-[1.25rem] text-[13px]">
        {state.error ? <span className="font-bold text-sale">{state.error}</span> : state.ok && state.message ? <span className="font-bold text-ok">{state.message}</span> : null}
      </p>

      {dialogStep?.dialog && open && (
        <Dialog open onClose={() => setOpen(null)} title={dialogStep.dialog.title} description={dialogStep.dialog.body} tone={dialogStep.danger ? "danger" : "default"}>
          <form action={action} onSubmit={() => setSubmitted(open)} className="space-y-4">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="next" value={open} />
            {dialogStep.dialog.field && (
              <label className="block">
                <span className={labelCls}>{dialogStep.dialog.field.label}</span>
                <input name={dialogStep.dialog.field.name} className={inputCls} placeholder={dialogStep.dialog.field.placeholder} maxLength={dialogStep.dialog.field.name === "reference" ? 120 : 500} autoComplete="off" autoFocus />
              </label>
            )}
            {state.error && submitted === open && (
              <p role="alert" className="rounded-xl bg-[#fde8ef] px-3 py-2 text-[13px] font-bold text-sale">
                {state.error}
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="btn btn-outline" onClick={() => setOpen(null)}>
                Back
              </button>
              <button className={`btn ${dialogStep.danger ? "bg-sale text-white hover:bg-[#b8003c]" : "btn-primary"}`} disabled={pending} autoFocus={!dialogStep.dialog.field}>
                {pending ? "Saving…" : dialogStep.dialog.confirm}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
