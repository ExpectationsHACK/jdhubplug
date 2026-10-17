import { NextResponse, type NextRequest } from "next/server";
import { bumpOfferStat, getOffer } from "@/lib/store";

// Offer special link: /o/{code}. Records a view, remembers the code for checkout
// (cookie "jd_offer", 30 days) and lands the shopper on the offer page. Unknown codes
// go to the shop. Query strings (e.g. utm_*) are carried through to the landing page.

const OFFER_COOKIE = "jd_offer";

export async function GET(request: NextRequest, ctx: RouteContext<"/o/[code]">) {
  const { code } = await ctx.params;
  const offer = await getOffer(code).catch(() => null);

  if (!offer) {
    return NextResponse.redirect(new URL("/shop", request.nextUrl), 307);
  }

  // Counting a view must never block the redirect.
  await bumpOfferStat(offer.code, "views", 1).catch(() => undefined);

  const target = new URL(`/offer/${encodeURIComponent(offer.code)}`, request.nextUrl);
  target.search = request.nextUrl.search;
  const res = NextResponse.redirect(target, 307);
  res.cookies.set(OFFER_COOKIE, offer.code, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && request.nextUrl.protocol === "https:",
  });
  // Every hit must reach the server so views are counted.
  res.headers.set("Cache-Control", "no-store");
  return res;
}
