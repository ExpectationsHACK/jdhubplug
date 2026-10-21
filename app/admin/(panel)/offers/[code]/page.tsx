import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OfferForm } from "@/components/admin/offers/OfferForm";
import { OfferLinkTools } from "@/components/admin/offers/OfferLinkTools";
import { DeleteOfferButton } from "@/components/admin/offers/OfferRowActions";
import { offerToInput } from "@/components/admin/offers/offerInput";
import { offerFormData, qrSvg, siteOrigin, specialLink } from "@/components/admin/offers/server";
import { AdminPage, Badge, PageHeader, StatCard, type Tone } from "@/components/admin/ui";
import { Icon } from "@/components/Icon";
import { STATE_LABEL, formatNaira } from "@/components/offers/format";
import { requireAdmin } from "@/lib/auth";
import { describeDiscount, offerState } from "@/lib/pricing";
import { getOffer, getOfferStats, listOffers } from "@/lib/store";
import type { OfferState } from "@/lib/types";

export const metadata: Metadata = { title: "Edit offer" };

const STATE_TONE: Record<OfferState, Tone> = { live: "green", scheduled: "blue", paused: "amber", expired: "neutral", exhausted: "purple" };

const currentTime = () => Date.now();

export default async function EditOfferPage({ params, searchParams }: PageProps<"/admin/offers/[code]">) {
  await requireAdmin("offers:write");
  const { code } = await params;
  const offer = await getOffer(decodeURIComponent(code));
  if (!offer) notFound();
  const sp = await searchParams;

  const [stats, { products, brands }, offers, origin] = await Promise.all([getOfferStats(offer.code), offerFormData(), listOffers(), siteOrigin()]);
  const state = offerState(offer, currentTime(), stats);
  const url = specialLink(origin, offer.code);
  const qr = await qrSvg(url);
  const conv = stats.views ? `${((stats.orders / stats.views) * 100).toFixed(1)}%` : "—";

  return (
    <AdminPage>
      <PageHeader
        title={offer.title}
        back={{ href: "/admin/offers", label: "Offers & links" }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={STATE_TONE[state]}>{STATE_LABEL[state]}</Badge>
            <span className="font-mono text-[13px] font-bold uppercase">{offer.code}</span>
            <span className="text-muted">·</span>
            <span className="font-bold text-sale">{describeDiscount(offer)}</span>
          </span>
        }
        actions={
          <>
            <Link href={`/offer/${encodeURIComponent(offer.code)}`} target="_blank" className="btn btn-outline">
              View landing page <span aria-hidden>↗</span>
            </Link>
            <DeleteOfferButton code={offer.code} title={offer.title} returnToList className="btn btn-outline" />
          </>
        }
      />

      {sp.duplicated === "1" && (
        <p role="status" className="mb-5 flex items-center gap-2 rounded-xl border border-[#c9d7ff] bg-[#eef3ff] px-4 py-3 text-[14px] text-accent-deep">
          <Icon name="info" size={18} /> This is a paused copy. Review the details and schedule, then switch it on.
        </p>
      )}

      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-4 [&>*]:min-w-0">
          <StatCard label="Views" value={stats.views.toLocaleString("en-NG")} hint="Special link opens" />
          <StatCard label="Orders" value={stats.orders.toLocaleString("en-NG")} hint={`${stats.paid} paid, ${Math.max(0, stats.orders - stats.paid)} awaiting payment${offer.usageLimit ? ` · of ${offer.usageLimit} allowed` : ""}`} />
          <StatCard label="Revenue" value={formatNaira(stats.revenue)} />
          <StatCard label="Conversion" value={conv} hint="Orders ÷ views" />
        </div>
        <div className="min-w-0 rounded-2xl border border-line bg-white p-4">
          <p className="mb-2 text-[13px] font-bold text-muted">Special link</p>
          <OfferLinkTools url={url} code={offer.code} qrSvg={qr} shareText={`${offer.title}: ${describeDiscount(offer)} at JDHub.`} />
        </div>
      </div>

      <OfferForm
        mode="edit"
        initial={offerToInput(offer)}
        products={products}
        brands={brands}
        existingCodes={offers.map((o) => o.code)}
        origin={origin}
      />
    </AdminPage>
  );
}
