import Link from "next/link";
import { Icon } from "./Icon";
import { Logo } from "./Logo";

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
      ["Vendor dashboard", "/vendors#dashboard"],
      ["Verification", "/vendors#verify"],
    ],
  },
  {
    title: "Support",
    links: [
      ["Chat on WhatsApp", "/trust#contact"],
      ["Order tracking", "/account"],
      ["Warranty", "/trust#escrow"],
      ["Contact us", "/trust#contact"],
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-20 bg-footer text-[13px] text-ink-2">
      <div className="wrap py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {columns.map((c) => (
            <div key={c.title}>
              <p className="mb-4 text-[14px] font-bold text-ink">{c.title}</p>
              <ul className="space-y-3">
                {c.links.map(([label, href]) => (
                  <li key={label}>
                    <Link href={href} className="hover:text-ink hover:underline">
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
            <Link href="/trust" className="hover:underline">Privacy</Link>
            <Link href="/trust" className="hover:underline">Terms of use</Link>
            <Link href="/trust#escrow" className="hover:underline">Escrow terms</Link>
            <Link href="/trust#contact" className="hover:underline">Sitemap</Link>
          </div>
        </div>
        <p className="mt-6 text-muted">
          Copyright © 2026 JDHub. All rights reserved. Prices in Nigerian Naira (₦) and subject to change. Offers are
          locked for 7 days after grading.
        </p>
      </div>
    </footer>
  );
}
