// Tiny isomorphic formatters for client components. Importing lib/catalog from the
// client would ship the whole seed catalog, so the few labels needed live here.

import type { Grade } from "@/lib/types";

const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

/** ₦1,185,000 */
export const formatNaira = (n: number) => naira.format(n);

/** Compact naira for tight spots: ₦1.2M, ₦850K. */
export function shortNaira(n: number) {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `₦${Math.round(n / 1_000)}K`;
  return `₦${n}`;
}

export const GRADES: { id: Grade; name: string }[] = [
  { id: "like-new", name: "Like New" },
  { id: "great", name: "Great" },
  { id: "good", name: "Good" },
  { id: "fair", name: "Fair" },
];

export const gradeLabel = (g: Grade) => GRADES.find((x) => x.id === g)?.name ?? g;
