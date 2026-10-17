import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { TrackPanel } from "@/components/checkout/TrackPanel";
import { Icon } from "@/components/Icon";
import { ProductImage } from "@/components/ProductImage";
import { formatNaira } from "@/lib/reference";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { customerOrders, getLegalContent } from "@/lib/legal-store";
import { STATUS_LABEL } from "@/lib/order-status";
import { listOrders } from "@/lib/store";
import { signOutAction } from "../signin/actions";
import { PrivacyControls } from "./PrivacyControls";

export const metadata: Metadata = {
  title: "Your account",
  description: "Your JDHub orders and account. Sign in with a one-time code, or open an order with its number and phone.",
  robots: { index: false },
};

export default function AccountPage({ searchParams }: PageProps<"/account">) {
  return (
    <Suspense fallback={<div className="wrap py-16"><div className="mx-auto h-64 max-w-3xl animate-pulse rounded-tile bg-stage" /></div>}>
      <AccountBody request={searchParams.then((s) => (typeof s.request === "string" ? s.request : undefined))} />
    </Suspense>
  );
}

async function AccountBody({ request }: { request: Promise<string | undefined> }) {
  await connection();
  const [customer, requestId, legal] = await Promise.all([getCurrentCustomer(), request, getLegalContent()]);
  if (!customer && requestId && /^DSR-\d+$/.test(requestId)) {
    return (
      <section className="wrap max-w-md py-16 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-stage">
          <Icon name="user" size={30} />
        </span>
        <h1 className="display mt-6 text-[32px]">Deletion request received</h1>
        <p className="mt-2 text-ink-2">
          Your reference is <b>{requestId}</b>. You&apos;ve been signed out, and we&apos;ll remove your personal details within 30 days. Order records are kept
          for tax purposes without your contact details.
        </p>
        <p className="mt-4 text-[14px] text-ink-2">
          Changed your mind or have a question? Email{" "}
          <a href={`mailto:${legal.privacyEmail}`} className="font-bold text-accent underline underline-offset-2">
            {legal.privacyEmail}
          </a>
          .
        </p>
        <Link href="/" className="btn btn-primary btn-lg mt-8 w-full">
          Back to JDHub
        </Link>
      </section>
    );
  }
  if (!customer) {
    return (
      <>
        <div className="wrap pt-12 text-center">
          <Link href="/signin?next=/account" className="btn btn-primary btn-lg">
            Sign in to see all your orders
          </Link>
          <p className="mt-3 text-[13px] text-muted">Or open a single order below with its number and phone.</p>
        </div>
        <TrackPanel title="Your orders." body="No password needed. Open any order with its number and the phone you checked out with." />
      </>
    );
  }
  const orders = customerOrders(customer, await listOrders());
  return (
    <section className="wrap max-w-4xl py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[14px] font-bold text-accent">Your account</p>
          <h1 className="display mt-1 text-[32px] md:text-[40px]">{customer.name ? `Hi, ${customer.name.split(" ")[0]}` : "Welcome back"}</h1>
          <p className="mt-1 text-[14px] text-ink-2">Signed in as {customer.phone ?? customer.email}</p>
        </div>
        <form action={signOutAction}>
          <button className="btn btn-outline">Sign out</button>
        </form>
      </div>

      <h2 className="mt-10 text-[18px] font-bold">Orders ({orders.length})</h2>
      {orders.length === 0 ? (
        <div className="mt-4 rounded-tile bg-stage px-6 py-12 text-center">
          <p className="font-bold">No orders yet.</p>
          <Link href="/shop" className="btn btn-primary mt-5">
            Start shopping
          </Link>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-line rounded-tile border border-line">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/order/${o.id}?t=${o.token}`} className="flex items-center gap-4 p-4 transition-colors hover:bg-stage">
                <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-stage">
                  <ProductImage item={{ ...o.lines[0], art: o.lines[0].art ?? "phone", tint: o.lines[0].tint ?? "#2a2a2a" }} width={120} className="h-14 w-14" artClassName="h-12 w-12" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold">
                    {o.id} · {o.lines.length === 1 ? o.lines[0].name : `${o.lines[0].name} + ${o.lines.length - 1} more`}
                  </span>
                  <span className="text-[13px] text-muted">
                    {new Date(o.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" })} · {STATUS_LABEL[o.status]}
                  </span>
                </span>
                <span className="text-[15px] font-bold">{formatNaira(o.total)}</span>
                <Icon name="chevronRight" size={18} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="max-w-xl">
        <PrivacyControls privacyEmail={legal.privacyEmail} whatsapp={legal.whatsapp} />
      </div>
    </section>
  );
}
