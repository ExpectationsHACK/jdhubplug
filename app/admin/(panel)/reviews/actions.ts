"use server";

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { audit, requireAdmin } from "@/lib/auth";
import { TAGS } from "@/lib/data";
import { refreshFromAction } from "@/lib/revalidate";
import { getReview, getReviewSettings, REVIEW_LIMITS, saveReviewSettings, setReviewReply, setReviewStatus, type ReviewStatus } from "@/lib/reviews";

// Review moderation. Approve/hide/reply need "products:write"; the auto-publish
// setting needs "settings:write". Every change is audited.

export type ReviewActionState = { ok?: boolean; error?: string; message?: string };

const STATUSES: ReviewStatus[] = ["pending", "published", "hidden"];
const ID_RE = /^rv_[a-z0-9]{1,40}$/;

function friendly(e: unknown): ReviewActionState {
  unstable_rethrow(e);
  const msg = e instanceof Error ? e.message : "";
  if (/permission|busy/i.test(msg)) return { error: msg };
  console.error("[admin/reviews]", e);
  return { error: "Something went wrong. Try again." };
}

const stars = (n: number) => `${n}★`;

/** Fields: id, status (pending | published | hidden). */
export async function setReviewStatusAction(_prev: ReviewActionState, form: FormData): Promise<ReviewActionState> {
  try {
    const s = await requireAdmin("products:write");
    const id = String(form.get("id") ?? "");
    const status = String(form.get("status") ?? "") as ReviewStatus;
    if (!ID_RE.test(id)) return { error: "This review no longer exists." };
    if (!STATUSES.includes(status)) return { error: "Unknown status." };
    const before = await getReview(id);
    if (!before) return { error: "This review no longer exists." };
    if (before.status !== status) {
      await setReviewStatus(id, status, s.name);
      const verb = status === "published" ? "publish" : status === "hidden" ? "hide" : "unpublish";
      await audit(s, `review.${verb}`, id, `${before.productModel} · ${stars(before.rating)} · ${before.status} → ${status}`);
      if (before.status === "published" || status === "published") refreshFromAction(TAGS.reviews);
    }
    refresh();
    return { ok: true, message: status === "published" ? "Published." : status === "hidden" ? "Hidden." : "Moved back to pending." };
  } catch (e) {
    return friendly(e);
  }
}

/** Fields: id, text (empty removes the reply). */
export async function replyReviewAction(_prev: ReviewActionState, form: FormData): Promise<ReviewActionState> {
  try {
    const s = await requireAdmin("products:write");
    const id = String(form.get("id") ?? "");
    const text = String(form.get("text") ?? "");
    if (!ID_RE.test(id)) return { error: "This review no longer exists." };
    if (text.length > REVIEW_LIMITS.reply) return { error: `Keep the reply under ${REVIEW_LIMITS.reply} characters.` };
    const updated = await setReviewReply(id, text, s.name);
    if (!updated) return { error: "This review no longer exists." };
    await audit(s, updated.adminReply ? "review.reply" : "review.reply-remove", id, updated.adminReply?.text.slice(0, 120));
    if (updated.status === "published") refreshFromAction(TAGS.reviews);
    refresh();
    return { ok: true, message: updated.adminReply ? "Reply saved." : "Reply removed." };
  } catch (e) {
    return friendly(e);
  }
}

/** Fields: autoPublish ("on" when checked). */
export async function saveReviewSettingsAction(_prev: ReviewActionState, form: FormData): Promise<ReviewActionState> {
  try {
    const s = await requireAdmin("settings:write");
    const autoPublish = form.get("autoPublish") === "on";
    const before = await getReviewSettings();
    if (before.autoPublish !== autoPublish) {
      await saveReviewSettings({ ...before, autoPublish });
      await audit(s, "reviews.settings", "auto-publish", autoPublish ? "on" : "off");
    }
    refresh();
    return { ok: true, message: autoPublish ? "New reviews publish immediately." : "New reviews wait for approval." };
  } catch (e) {
    return friendly(e);
  }
}
