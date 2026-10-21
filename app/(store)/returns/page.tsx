import type { Metadata } from "next";
import { returnsIntro, returnsSections } from "@/components/legal/content";
import { LegalDoc } from "@/components/legal/LegalDoc";
import { getLegalContent } from "@/lib/legal-store";

export const metadata: Metadata = {
  title: "Returns & Warranty",
  description: "JDHub's return window, warranty on graded devices and inspection period for cars.",
  alternates: { canonical: "/returns" },
};

// Cached with the "legal" tag; refreshed when an admin saves /admin/privacy.
export default async function ReturnsPage() {
  const legal = await getLegalContent();
  return <LegalDoc page="returns" legal={legal} intro={returnsIntro(legal)} sections={returnsSections(legal)} />;
}
