import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { nairaCompact } from "@/components/admin/core/format";
import { AdminIcon } from "@/components/admin/core/icons";
import s from "@/components/admin/core/core.module.css";
import { ProductImage } from "@/components/ProductImage";
import { adminConfigured, usingDevPassword } from "@/lib/auth";
import { listings } from "@/lib/catalog";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false, follow: false } };

// A spread across every category for the brand-panel collage (seed data is fine here:
// it's decoration, not live stock).
const COLLAGE_IDS = [
  "iphone-17-pro-max-1",
  "airpods-max-1",
  "toyota-camry-2019-xse-1",
  "galaxy-s25-ultra-1",
  "macbook-air-m2-1",
  "apple-watch-ultra-2-1",
  "ps5-disc-1",
  "dji-mini-4-pro-1",
  "ipad-pro-m4-1",
];

const collage = COLLAGE_IDS.map((id) => listings.find((l) => l.id === id))
  .filter((l): l is NonNullable<typeof l> => !!l)
  .map(({ id, name, price, photo, imageUrl, art, tint }) => ({ id, name, price, photo, imageUrl, art, tint }));

type Tile = (typeof collage)[number];

const NOTICES: Record<string, string> = {
  signedout: "You've signed out. See you soon.",
  revoked: "Your access changed. Sign in again to continue.",
};

export default function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  const params = searchParams.then((sp) => ({
    next: typeof sp.next === "string" ? sp.next : "",
    reason: typeof sp.reason === "string" ? sp.reason : "",
  }));

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <BrandPanel />

      <div className="flex min-h-screen flex-col">
        <MobileBand />
        <div className="flex flex-1 items-center justify-center px-4 py-10 md:px-8">
          <div className={`w-full max-w-sm ${s.rise}`}>
            <p className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-accent">
              <AdminIcon name="lock" size={14} /> JDHub Admin
            </p>
            <h1 className="display mt-3 text-[30px] md:text-[34px]">Welcome back.</h1>
            <p className="mt-1.5 text-[14px] text-ink-2">Sign in to manage products, stock, orders and offers.</p>
            <div className="mt-8">
              <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-stage" />}>
                <LoginBody params={params} />
              </Suspense>
            </div>
          </div>
        </div>
        <footer className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 pb-6 text-[11px] text-muted">
          <span>Protected area. Every sign-in is logged.</span>
          <Link href="/" className="font-bold text-ink-2 underline-offset-4 hover:text-ink hover:underline">
            Back to the store
          </Link>
        </footer>
      </div>
    </div>
  );
}

// Checked at request time so adding ADMIN_PASSWORD takes effect without a rebuild.
async function LoginBody({ params }: { params: Promise<{ next: string; reason: string }> }) {
  await connection();
  if (!adminConfigured()) {
    return (
      <div className="rounded-2xl border border-line bg-stage p-5 text-[14px] text-ink-2">
        <p className="flex items-center gap-2 font-bold text-ink">
          <AdminIcon name="alert" size={18} /> The admin isn&apos;t set up yet.
        </p>
        <p className="mt-2">
          In Vercel, open your project → Settings → Environment Variables and add <code>ADMIN_PASSWORD</code> (and a long random <code>AUTH_SECRET</code>), then
          redeploy.
        </p>
      </div>
    );
  }
  const { reason } = await params;
  return <LoginForm next={params.then((p) => p.next)} devHint={usingDevPassword()} notice={NOTICES[reason]} />;
}

function CollageTile({ item, tall, i }: { item: Tile; tall?: boolean; i: number }) {
  return (
    <figure className={`relative overflow-hidden rounded-tile bg-stage ${tall ? "aspect-[4/5]" : "aspect-square"}`}>
      <ProductImage item={item} width={500} className="h-full w-full" artClassName="h-3/4 w-3/4" priority={i < 3} />
      <figcaption className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2 rounded-xl bg-white/85 px-2.5 py-1.5 text-[11px] text-ink backdrop-blur">
        <span className="truncate font-bold">{item.name}</span>
        <span className="shrink-0 text-ink-2">{nairaCompact(item.price)}</span>
      </figcaption>
    </figure>
  );
}

function BrandPanel() {
  const cols = [collage.slice(0, 3), collage.slice(3, 6), collage.slice(6, 9)];
  return (
    <aside aria-hidden className="relative hidden overflow-hidden bg-ink text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
      <div className="pointer-events-none absolute -left-32 top-1/3 h-96 w-96 rounded-full bg-accent/35 blur-[110px]" />
      <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-accent-deep/70 blur-[90px]" />
      <div className={s.sheen} />

      <div className="relative flex items-center gap-2 px-12 pt-10">
        <span className="display text-[22px] font-extrabold uppercase tracking-[0.14em]">JDHub</span>
        <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]">Admin</span>
      </div>

      {/* Collage: three columns drifting at different phases, fading out top and bottom. */}
      <div className="relative min-h-0 flex-1 overflow-hidden px-12 [mask-image:linear-gradient(to_bottom,transparent,black_14%,black_80%,transparent)]">
        <div className="grid h-full grid-cols-3 gap-4 py-6">
          {cols.map((col, c) => (
            <div key={c} className={`flex flex-col gap-4 ${c === 1 ? "-mt-16" : c === 2 ? "mt-10" : ""} ${s.float}`} style={{ ["--i" as string]: c }}>
              {col.map((item, r) => (
                <CollageTile key={item.id} item={item} tall={(r + c) % 2 === 0} i={c * 3 + r} />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="relative px-12 pb-12">
        <h2 className="display text-[38px] leading-[1.1] xl:text-[44px]">
          Run the store.
          <br />
          Trade with certainty.
        </h2>
        <p className="mt-3 max-w-md text-[15px] text-white/70">Prices, stock, orders and offer links in one place. Every sale reserves stock the moment it&apos;s placed.</p>
        <ul className="mt-6 flex flex-wrap gap-2 text-[12px] font-bold">
          {["Live stock", "Escrow-protected orders", "Offer links", "Team roles"].map((t) => (
            <li key={t} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
              <AdminIcon name="check" size={13} strokeWidth={2} /> {t}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function MobileBand() {
  return (
    <div aria-hidden className="relative overflow-hidden bg-ink px-4 pt-5 text-white lg:hidden">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/40 blur-3xl" />
      <div className="relative flex items-center gap-2">
        <span className="display text-[18px] font-extrabold uppercase tracking-[0.14em]">JDHub</span>
        <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]">Admin</span>
      </div>
      <div className="relative mt-5 grid translate-y-3 grid-cols-3 gap-2.5">
        {collage.slice(0, 3).map((item, i) => (
          <div key={item.id} className={`overflow-hidden rounded-t-[16px] bg-stage ${i === 1 ? "h-28" : "mt-4 h-24"}`}>
            <ProductImage item={item} width={330} className="h-full w-full" artClassName="h-3/4 w-3/4" priority />
          </div>
        ))}
      </div>
    </div>
  );
}
