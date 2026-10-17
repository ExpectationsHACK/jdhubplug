"use client";

import { useActionState, useState } from "react";
import { setCustomerBlockedAction, type BlockState } from "@/app/admin/(panel)/customers/actions";
import { Dialog } from "@/components/admin/orders/Dialog";

/** Block / unblock a shopper account. Blocking asks for confirmation first. */
export function BlockButton({ id, name, blocked }: { id: string; name: string; blocked: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<BlockState, FormData>(async (prev, data) => {
    const result = await setCustomerBlockedAction(prev, data);
    if (result.ok) setOpen(false);
    return result;
  }, {});

  const form = (
    <form action={action} className="contents">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="blocked" value={blocked ? "0" : "1"} />
      <button
        type="submit"
        disabled={pending}
        className={`inline-flex h-9 items-center rounded-full px-4 text-[13px] font-bold transition-colors disabled:opacity-60 ${
          blocked ? "border border-line bg-white text-ink hover:bg-stage" : "bg-sale text-white hover:opacity-90"
        }`}
      >
        {pending ? "Saving…" : blocked ? "Unblock" : "Block account"}
      </button>
    </form>
  );

  return (
    <>
      {blocked ? (
        form
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-9 items-center rounded-full border border-line bg-white px-4 text-[13px] font-bold text-sale transition-colors hover:bg-stage"
        >
          Block
        </button>
      )}
      {state.message && !state.ok && (
        <p role="alert" className="mt-1 text-[12px] text-sale">
          {state.message}
        </p>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        tone="danger"
        title={`Block ${name}?`}
        description="They're signed out straight away and can't sign in or check out with this account. Past orders are kept. You can unblock them any time."
      >
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className="inline-flex h-9 items-center rounded-full border border-line px-4 text-[13px] font-bold hover:bg-stage">
            Cancel
          </button>
          {form}
        </div>
      </Dialog>
    </>
  );
}
