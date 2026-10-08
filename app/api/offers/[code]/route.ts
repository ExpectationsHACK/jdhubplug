import { connection } from "next/server";
import { toPublicOffer, type PublicOfferPayload } from "@/components/offers/format";
import { getPublicOffer } from "@/lib/data";
import { offerState } from "@/lib/pricing";

// Public offer lookup used by the storefront offer widgets (ActiveOfferBanner,
// OfferPrice). Returns public fields and the current state only: no stats, no flags.

export async function GET(_request: Request, ctx: RouteContext<"/api/offers/[code]">) {
  const { code } = await ctx.params;
  const data = await getPublicOffer(code);
  if (!data) return Response.json({ error: "Offer not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });

  await connection();
  const body: PublicOfferPayload = {
    offer: toPublicOffer(data.offer),
    state: offerState(data.offer, Date.now(), data.stats),
  };
  return Response.json(body, {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=60" },
  });
}
