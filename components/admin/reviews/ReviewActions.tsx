"use client";

import { useActionState, useState } from "react";
import { replyReviewAction, saveReviewSettingsAction, setReviewStatusAction, type ReviewActionState } from "@/app/admin/(panel)/reviews/actions";
import { REVIEW_LIMITS, type ReviewStatus } from "@/lib/reviews-shared";
import { Switch } from "../core/form-bits";
import { Dialog } from "../orders/Dialog";
import { inputCls } from "../ui";

// Moderation controls on a review card, and the auto-publish setting.

export function ReviewActions({ id, name, status, reply, canWrite }: { id: string; name: string; status: ReviewStatus; reply?: string; canWrite: boolean }) {
  const [state, setStatus, pending] = useActionState<ReviewActionState, FormData>(setReviewStatusAction, {});
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(reply ?? "");
  const [replyState, saveReply, replying] = useActionState<ReviewActionState, FormData>(async (prev, fd) => {
    const res = await replyReviewAction(prev, fd);
    if (res.ok) setOpen(false);
    return res;
  }, {});

  if (!canWrite) return null;

  const moves: { to: ReviewStatus; label: string; primary?: boolean }[] =
    status === "pending"
      ? [
          { to: "published", label: "Approve", primary: true },
          { to: "hidden", label: "Hide" },
        ]
      : status === "published"
        ? [{ to: "hidden", label: "Hide" }]
        : [
            { to: "published", label: "Publish", primary: true },
            { to: "pending", label: "Back to pending" },
          ];

  const error = state.error ?? replyState.error;
  const message = !error ? (state.message ?? replyState.message) : undefined;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {moves.map((m) => (
        <form key={m.to} action={setStatus}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value={m.to} />
          <button className={`btn min-h-9 px-4 py-2 text-[13px] ${m.primary ? "btn-primary" : "btn-outline"}`} disabled={pending} aria-label={`${m.label} review from ${name}`}>
            {m.label}
          </button>
        </form>
      ))}
      <button type="button" onClick={() => setOpen(true)} className="btn btn-outline min-h-9 px-4 py-2 text-[13px]">
        {reply ? "Edit reply" : "Reply"}
      </button>
      <span role="status" aria-live="polite" className={`text-[13px] font-bold ${error ? "text-sale" : "text-ok"}`}>
        {error ?? message}
      </span>
      {open && (
        <Dialog
          open
          onClose={() => setOpen(false)}
          title={reply ? "Edit public reply" : "Reply publicly"}
          description={<>Shown under {name}&apos;s review on the product page as &ldquo;Reply from JDHub&rdquo;. Leave empty to remove it.</>}
        >
          <form action={saveReply} className="space-y-3">
            <input type="hidden" name="id" value={id} />
            <textarea
              name="text"
              rows={5}
              maxLength={REVIEW_LIMITS.reply}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className={inputCls}
              aria-label="Reply"
              autoFocus
            />
            <p className="text-right text-[12px] text-muted">
              {text.length}/{REVIEW_LIMITS.reply}
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="btn btn-outline" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" disabled={replying}>
                {replying ? "Saving…" : text.trim() ? "Save reply" : "Remove reply"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}

export function ReviewSettingsForm({ autoPublish, canWrite }: { autoPublish: boolean; canWrite: boolean }) {
  const [state, save, pending] = useActionState<ReviewActionState, FormData>(saveReviewSettingsAction, {});
  const [on, setOn] = useState(autoPublish);
  return (
    <form action={save} className="space-y-3">
      <Switch
        name="autoPublish"
        label="Publish reviews automatically"
        description="Off (recommended): new reviews wait here until someone approves them. Every review comes from a delivered order either way."
        checked={on}
        onChange={setOn}
        disabled={!canWrite}
      />
      {canWrite && (
        <div className="flex items-center gap-3">
          <button className="btn btn-primary min-h-9 px-4 py-2 text-[13px]" disabled={pending || on === autoPublish}>
            {pending ? "Saving…" : "Save"}
          </button>
          <span role="status" aria-live="polite" className={`text-[13px] font-bold ${state.error ? "text-sale" : "text-ok"}`}>
            {state.error ?? state.message}
          </span>
        </div>
      )}
    </form>
  );
}
