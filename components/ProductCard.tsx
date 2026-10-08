import Link from "next/link";
import { formatNaira, gradeName, type Listing } from "@/lib/catalog";
import { DeviceArt } from "./DeviceArt";
import { Icon } from "./Icon";

export function GradePill({ grade }: { grade: Listing["grade"] }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line px-2.5 py-0.5 text-[12px] font-bold text-ink-2">
      {gradeName(grade)}
    </span>
  );
}

export function ProductCard({ item }: { item: Listing }) {
  return (
    <div className="group flex h-full flex-col rounded-tile bg-stage p-5 transition-shadow hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
      <div className="flex min-h-6 items-start justify-between">
        {item.badge ? (
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
              item.badge === "Hot deal" ? "bg-sale text-white" : "bg-white text-ink"
            }`}
          >
            {item.badge}
          </span>
        ) : (
          <span />
        )}
        <button aria-label={`Save ${item.name}`} className="rounded-full p-1 text-muted hover:text-ink">
          <Icon name="heart" size={20} />
        </button>
      </div>
      <Link href={`/product/${item.id}`} className="block">
        <DeviceArt kind={item.art} tint={item.tint} className="mx-auto my-2 h-44 w-44 transition-transform duration-300 group-hover:scale-[1.04]" />
      </Link>
      <div className="mt-auto text-center">
        <div className="mb-2 flex items-center justify-center gap-2">
          <GradePill grade={item.grade} />
          {item.verified && (
            <span className="inline-flex items-center gap-0.5 text-[12px] font-bold text-accent">
              <Icon name="verified" size={15} /> Verified
            </span>
          )}
        </div>
        <Link href={`/product/${item.id}`} className="block">
          <h3 className="text-[16px] font-bold leading-snug">{item.name}</h3>
          <p className="mt-1 text-[13px] text-muted">{item.spec}</p>
        </Link>
        <p className="mt-1 flex items-center justify-center gap-1 text-[12px] text-muted">
          <Icon name="star" size={13} className="fill-ink text-ink" /> {item.rating} ({item.reviews}) · {item.state}
        </p>
        <p className="mt-3 text-[18px] font-bold">
          {formatNaira(item.price)}
          {item.was && <span className="ml-2 text-[13px] font-normal text-muted line-through">{formatNaira(item.was)}</span>}
        </p>
        <Link href={`/product/${item.id}`} className="btn btn-primary mt-4 w-full">
          Buy now
        </Link>
      </div>
    </div>
  );
}
