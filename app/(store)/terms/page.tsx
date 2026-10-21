import type { Metadata } from "next";
import { termsIntro, termsSections } from "@/components/legal/content";
import { LegalDoc } from "@/components/legal/LegalDoc";
import { getLegalContent } from "@/lib/legal-store";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The terms for buying, selling and swapping graded phones, gadgets and cars on JDHub.",
  alternates: { canonical: "/terms" },
};

// Cached with the "legal" tag; refreshed when an admin saves /admin/privacy.
export default async function TermsPage() {
  const legal = await getLegalContent();
  return <LegalDoc page="terms" legal={legal} intro={termsIntro(legal)} sections={termsSections(legal)} />;
}
