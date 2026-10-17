import Link from "next/link";
import type { CSSProperties } from "react";
import type { Product } from "@/lib/types";
import { formatNaira, gradeLabel } from "../home/format";
import { Icon, type IconName } from "../Icon";
import { ProductImage } from "../ProductImage";
import { SpotlightDriver } from "./SpotlightDriver";

// Pinned, scroll-driven product spotlight. The section is tall; its inner stage sticks
// to the viewport while the product photo scales up and turns in 3D and the spec
// callouts fly in one by one. Driven by CSS scroll timelines (`.spot*` in globals.css);
// SpotlightDriver feeds a --p progress variable to browsers without them. The base
// styles are the finished state, so without either (or under reduced motion) it's a
// normal, static section.

type Callout = { icon: IconName; label: string; value: string };

export function ScrollSpotlight({ product }: { product: Product }) {
  const battery = product.attrs["Battery health"];
  const isCar = product.category === "cars";
  const callouts: Callout[] = [
    { icon: "checkCircle", label: "JDHub grade", value: gradeLabel(product.grade) },
    battery
      ? { icon: "battery", label: "Battery health", value: battery }
      : { icon: "verified", label: "Seller", value: product.verified ? "Verified" : product.seller },
    { icon: "scan", label: isCar ? "VIN" : "IMEI", value: isCar ? "History checked" : "Checked · clean" },
    { icon: "shield", label: "Escrow", value: "Protected payment" },
    { icon: "tag", label: "Price", value: formatNaira(product.price) },
  ];
  const side = (i: number) => (i % 2 === 0 ? "spot-left" : "spot-right");

  return (
    <section className="spot" aria-labelledby="spot-title" data-spot>
      <SpotlightDriver />
      <div className="spot-pin">
        <div aria-hidden className="spot-backdrop">
          <span>Checked.</span>
        </div>
        <div className="spot-head">
          <p className="text-[14px] font-bold text-accent">Spotlight</p>
          <h2 id="spot-title" className="display mt-2 text-[26px] md:text-[40px]">
            Every unit, checked before it lists.
          </h2>
        </div>

        <div className="spot-body">
          <div className="spot-photo-wrap">
            <Link href={`/product/${product.id}`} className="spot-photo" aria-label={`View ${product.name}`}>
              <ProductImage item={product} width={960} className="h-full w-full" artClassName="h-4/5 w-4/5" />
              <span aria-hidden className="spot-photo-gloss" />
            </Link>
          </div>
          <ul className="spot-callouts">
            {callouts.map((c, i) => (
              <li key={c.label} className={`spot-callout ${side(i)}`} style={{ "--n": i } as CSSProperties}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-white">
                  <Icon name={c.icon} size={20} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[12px] font-bold uppercase tracking-wider text-muted">{c.label}</span>
                  <span className="block truncate text-[15px] font-bold md:text-[17px]">{c.value}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="spot-foot">
          <p className="text-[15px] font-bold">{product.name}</p>
          <p className="text-[13px] text-muted">{product.spec}</p>
          <Link href={`/product/${product.id}`} className="btn btn-primary mt-4">
            View this unit
          </Link>
        </div>
      </div>
    </section>
  );
}
