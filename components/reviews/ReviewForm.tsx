"use client";

import { useActionState, useId, useState } from "react";
import { submitReviewAction, type ReviewFormState } from "@/app/(store)/order/[id]/review-actions";
import { REVIEW_LIMITS } from "@/lib/reviews-shared";
import { Icon } from "../Icon";

// "Rate your purchase" for one delivered order line. Collapsed to a button until the
// buyer opens it. Server-side validation is the source of truth; limits here only help.

const WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

export function ReviewForm({ orderId, token, productId, productName }: { orderId: string; token: string; productId: string; productName: string }) {
  const [state, action, pending] = useActionState<ReviewFormState, FormData>(submitReviewAction, {});
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  // Controlled, so a rejected submission doesn't wipe what the buyer typed.
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const uid = useId();

  if (state.ok) {
    return (
      <p role="status" className="flex items-start gap-2 rounded-xl bg-stage p-3 text-[14px]">
        <Icon name="checkCircle" size={18} className="mt-0.5 shrink-0 text-ok" />
        {state.published ? "Thanks! Your review is live on the product page." : "Thanks! Your review will appear once our team has checked it."}
      </p>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-outline min-h-10 px-4 py-2 text-[14px]">
        <Icon name="star" size={16} /> Rate your purchase
      </button>
    );
  }

  const shown = hover || rating;
  const err = (f: ReviewFormState["field"]) => (state.field === f ? state.error : undefined);

  return (
    <form action={action} className="rounded-xl border border-line p-4" aria-label={`Review ${productName}`}>
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="productId" value={productId} />

      <fieldset>
        <legend className="text-[14px] font-bold">How would you rate it?</legend>
        <div className="mt-2 flex items-center gap-3">
          <div className="flex" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="cursor-pointer p-0.5" onMouseEnter={() => setHover(n)}>
                <input
                  type="radio"
                  name="rating"
                  value={n}
                  checked={rating === n}
                  onChange={() => setRating(n)}
                  required
                  className="peer sr-only"
                  aria-label={`${n} star${n === 1 ? "" : "s"}, ${WORDS[n]}`}
                />
                <Icon
                  name="star"
                  size={28}
                  strokeWidth={1.25}
                  className={`rounded peer-focus-visible:outline-2 peer-focus-visible:outline-accent ${n <= shown ? "fill-ink text-ink" : "text-line"}`}
                />
              </label>
            ))}
          </div>
          <span className="text-[14px] font-bold text-ink-2" aria-hidden>
            {WORDS[shown]}
          </span>
        </div>
        {err("rating") && <p className="mt-1 text-[13px] font-bold text-sale">{err("rating")}</p>}
      </fieldset>

      <label htmlFor={`${uid}-title`} className="mt-4 block text-[14px] font-bold">
        Headline <span className="font-normal text-muted">(optional)</span>
      </label>
      <input
        id={`${uid}-title`}
        name="title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={REVIEW_LIMITS.title}
        placeholder="e.g. Exactly as graded"
        className="field mt-1"
        aria-invalid={!!err("title")}
      />
      {err("title") && <p className="mt-1 text-[13px] font-bold text-sale">{err("title")}</p>}

      <label htmlFor={`${uid}-body`} className="mt-4 block text-[14px] font-bold">
        Your review
      </label>
      <textarea
        id={`${uid}-body`}
        name="body"
        required
        minLength={REVIEW_LIMITS.bodyMin}
        maxLength={REVIEW_LIMITS.body}
        rows={4}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Did it match its grade? How was delivery or pickup?"
        className="field mt-1"
        aria-invalid={!!err("body")}
        aria-describedby={`${uid}-hint`}
      />
      <p id={`${uid}-hint`} className="mt-1 flex justify-between gap-3 text-[12px] text-muted">
        <span>Shown with your first name and last initial, and a Verified purchase label.</span>
        <span>
          {body.length}/{REVIEW_LIMITS.body}
        </span>
      </p>

      {state.error && (
        <p role="alert" className="mt-3 text-[13px] font-bold text-sale">
          {state.error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Sending…" : "Submit review"}
        </button>
        <button type="button" className="btn btn-outline" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
