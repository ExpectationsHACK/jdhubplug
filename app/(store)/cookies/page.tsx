import type { Metadata } from "next";
import { CookieSettingsButton } from "@/components/consent/ConsentBanner";
import { cookiesIntro, cookiesSections } from "@/components/legal/content";
import { LegalDoc } from "@/components/legal/LegalDoc";
import { getLegalContent } from "@/lib/legal-store";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "The cookies JDHub uses and how to manage your analytics consent.",
  alternates: { canonical: "/cookies" },
};

// Cached with the "legal" tag; refreshed when an admin saves /admin/privacy.
export default async function CookiesPage() {
  const legal = await getLegalContent();
  const manage = <CookieSettingsButton className="btn btn-primary">Open cookie settings</CookieSettingsButton>;
  return <LegalDoc page="cookies" legal={legal} intro={cookiesIntro(legal)} sections={cookiesSections(legal, manage)} />;
}
