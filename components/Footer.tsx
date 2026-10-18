import Link from "next/link";
import { waLink } from "@/lib/settings";
import { CookieSettingsButton } from "./consent/ConsentBanner";
import { Icon, WhatsAppGlyph } from "./Icon";
import { Logo } from "./Logo";

// Fixed at build time; render-time clocks need a Suspense boundary under cacheComponents.
const COPYRIGHT_YEAR = 2026;

const columns: { title: string; links: [string, string][] }[] = [
  {
    title: "Shop",
    links: [
      ["Phones", "/shop/phones"],
      ["Accessories", "/shop/accessories"],
      ["Gadgets", "/shop/gadgets"],
      ["Cars", "/shop/cars"],
      ["Offers", "/shop"],
    ],
  },
  {
    title: "Sell & Swap",
    links: [
      ["Get an instant offer", "/sell"],
      ["Swap & trade up", "/swap"],
      ["How grading works", "/trust#grading"],
      ["Drop-off hubs", "/trust#hubs"],
    ],
  },
  {
    title: "Trust & Safety",
    links: [
      ["Escrow protection", "/trust#escrow"],
      ["IMEI & VIN check", "/trust#verify"],
      ["Scam report lookup", "/trust#lookup"],
      ["Resolve a dispute", "/trust#disputes"],
    ],
  },
  {
    title: "Business",
    links: [
      ["Sell on JDHub", "/vendors"],
      ["Partner benefits", "/vendors#dashboard"],
      ["Verification", "/vendors#verify"],
    ],
  },
  {
    title: "Support",
    links: [
      ["Chat on WhatsApp", "/trust#contact"],
      ["Order tracking", "/track"],
      ["Returns & warranty", "/returns"],
      ["Contact us", "/trust#contact"],
    ],
  },
];

export type FooterContact = { whatsapp: string; phone: string; email: string; storeName: string };

export function Footer({ contact }: { contact: FooterContact }) {
  const tel = contact.phone.replace(/[^\d+]/g, "");
  return (
    <footer className="mt-20 bg-footer text-[13px] text-ink-2">
      <div className="wrap py-12">
        {/* Contact strip: live from /admin/settings */}
        <div className="mb-10 flex flex-col gap-4 rounded-tile bg-white p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <div>
            <p className="display text-[20px] text-ink md:text-[24px]">Questions before you buy?</p>
            <p className="mt-1 text-[14px]">Real people, replying in minutes. Mon–Sat, 8am–8pm.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={waLink(contact.whatsapp, `Hi ${contact.storeName}, `)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn bg-wa text-white hover:brightness-95"
            >
              <WhatsAppGlyph size={18} /> WhatsApp
            </a>
            {tel && (
              <a href={`tel:${tel}`} className="btn btn-outline">
                <Icon name="phone" size={18} /> {contact.phone}
              </a>
            )}
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="btn btn-outline">
                <Icon name="mail" size={18} /> Email
              </a>
            )}
          </div>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {columns.map((c) => (
            <div key={c.title}>
              <p className="mb-4 text-[14px] font-bold text-ink">{c.title}</p>
              <ul className="space-y-3">
                {c.links.map(([label, href]) => (
                  <li key={label}>
                    <Link href={href} className="inline-block rounded-sm py-1 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-accent">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-6 border-t border-line pt-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-6">
            <Logo />
            <span className="flex items-center gap-1.5">
              <Icon name="globe" size={18} /> Nigeria / English
            </span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/privacy" className="inline-block py-1 hover:underline">Privacy Policy</Link>
            <Link href="/terms" className="inline-block py-1 hover:underline">Terms of use</Link>
            <Link href="/returns" className="inline-block py-1 hover:underline">Returns & warranty</Link>
            <Link href="/cookies" className="inline-block py-1 hover:underline">Cookie Policy</Link>
            <CookieSettingsButton />
            <Link href="/trust#escrow" className="inline-block py-1 hover:underline">Escrow terms</Link>
            <Link href="/credits" className="inline-block py-1 hover:underline">Photo credits</Link>
          </div>
        </div>
        <p className="mt-6 text-muted">
          Copyright © {COPYRIGHT_YEAR} {contact.storeName}. All rights reserved. Prices in Nigerian Naira (₦) and subject to change. Offers are
          locked for 7 days after grading.
        </p>
      </div>
    </footer>
  );
}
