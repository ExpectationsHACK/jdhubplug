import type { Metadata } from "next";
import { PageTransition } from "@/components/motion/PageTransition";
import { PageHero } from "@/components/PageHero";
import { ProductImage } from "@/components/ProductImage";
import { getCatalog } from "@/lib/data";
import { photoPage } from "@/lib/photos";

export const metadata: Metadata = {
  title: "Photo credits",
  description: "Sources and licences for the Wikimedia Commons product photos used on JDHub.",
  alternates: { canonical: "/credits" },
};

export default async function CreditsPage() {
  // Every Commons photo in the live catalog, once, with the first product that uses it.
  const all = await getCatalog();
  const byPhoto = new Map<string, (typeof all)[number]>();
  for (const p of all) if (p.photo && !byPhoto.has(p.photo)) byPhoto.set(p.photo, p);
  const credits = [...byPhoto.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));

  return (
    <PageTransition>
      <PageHero
        trail={[["Home", "/"], ["Photo credits"]]}
        title="Photo credits"
        body="Product photos on JDHub are freely licensed images from Wikimedia Commons, used as representative photos of each model. Each link opens the file page with its author and licence."
      />
      <section className="wrap">
        <ul className="grid gap-x-8 border-t border-line sm:grid-cols-2 lg:grid-cols-3">
          {credits.map(([file, p]) => (
            <li key={file} className="flex items-center justify-between gap-4 border-b border-line py-3 text-[14px]">
              <span className="flex min-w-0 items-center gap-3">
                <ProductImage item={p} width={120} className="h-10 w-10 shrink-0 rounded-lg bg-stage" artClassName="h-8 w-8" />
                <span className="truncate font-bold">{p.name}</span>
              </span>
              <a
                href={photoPage(file)}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-muted underline underline-offset-2 hover:text-ink"
              >
                Source & licence
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-8 max-w-3xl text-[13px] text-muted">
          Trademarks and product names belong to their respective owners. JDHub is an independent marketplace and is not
          affiliated with the brands listed. Photos show the model, not the exact unit for sale; sellers share photos of
          the actual unit on request before payment. Photos uploaded by sellers belong to them.
        </p>
      </section>
    </PageTransition>
  );
}
