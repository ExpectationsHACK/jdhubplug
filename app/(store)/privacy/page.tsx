import type { Metadata } from "next";
import { privacyIntro, privacySections } from "@/components/legal/content";
import { LegalDoc } from "@/components/legal/LegalDoc";
import { getLegalContent } from "@/lib/legal-store";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How JDHub collects, uses and protects your personal data under the Nigeria Data Protection Act 2023.",
  alternates: { canonical: "/privacy" },
};

// Cached with the "legal" tag; refreshed when an admin saves /admin/privacy.
export default async function PrivacyPage() {
  const legal = await getLegalContent();
  return <LegalDoc page="privacy" legal={legal} intro={privacyIntro(legal)} sections={privacySections(legal)} />;
}
