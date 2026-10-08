import type { Metadata } from "next";
import { OfferForm } from "@/components/admin/offers/OfferForm";
import { isoToLagosInput, type OfferInput } from "@/components/admin/offers/offerInput";
import { offerFormData, siteOrigin } from "@/components/admin/offers/server";
import { AdminPage, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { listOffers } from "@/lib/store";

export const metadata: Metadata = { title: "New offer" };

/** Default schedule: from now for a week. Kept out of render for purity. */
function defaultSchedule() {
  const start = Math.floor(Date.now() / 60_000) * 60_000;
  return { startsAt: isoToLagosInput(new Date(start).toISOString()), endsAt: isoToLagosInput(new Date(start + 7 * 86_400_000).toISOString()) };
}

export default async function NewOfferPage() {
  await requireAdmin("offers:write");
  const [{ products, brands }, offers, origin] = await Promise.all([offerFormData(), listOffers(), siteOrigin()]);

  const initial: OfferInput = {
    title: "",
    code: "",
    headline: "",
    description: "",
    discountType: "percent",
    discountValue: "10",
    scopeType: "all",
    categories: [],
    brands: [],
    productIds: [],
    ...defaultSchedule(),
    usageLimit: null,
    minSubtotal: null,
    heroProductId: null,
    active: true,
  };

  return (
    <AdminPage>
      <PageHeader title="New offer" description="Set the discount, pick what it covers and share the link." back={{ href: "/admin/offers", label: "Offers & links" }} />
      <OfferForm mode="create" initial={initial} products={products} brands={brands} existingCodes={offers.map((o) => o.code)} origin={origin} />
    </AdminPage>
  );
}
