import "server-only";

import { revalidateTag, updateTag } from "next/cache";
import { TAGS } from "./data";

export type Tag = (typeof TAGS)[keyof typeof TAGS];

/** Refresh storefront data after a mutation in a Server Action (read-your-own-writes). */
export function refreshFromAction(...tags: Tag[]) {
  for (const t of tags) updateTag(t);
}

/** Refresh storefront data from a Route Handler (webhooks, cron). */
export function refreshFromRoute(...tags: Tag[]) {
  for (const t of tags) revalidateTag(t, { expire: 0 });
}
