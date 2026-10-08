import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { photoPage } from "@/lib/catalog";
import { models } from "@/lib/models";

export const metadata: Metadata = { title: "Photo credits" };

export default function CreditsPage() {
  return (
    <>
      <PageHero
        trail={[["Home", "/"], ["Photo credits"]]}
        title="Photo credits"
        body="Product photos on JDHub are freely licensed images from Wikimedia Commons, used as representative photos of each model. Each link opens the file page with its author and licence."
      />
      <section className="wrap">
        <ul className="grid gap-x-8 border-t border-line sm:grid-cols-2 lg:grid-cols-3">
          {models.map((m) => (
            <li key={m.slug} className="flex items-baseline justify-between gap-4 border-b border-line py-3 text-[14px]">
              <span className="font-bold">
                {m.name}
                {m.car ? ` ${m.car.year}` : ""}
              </span>
              <a href={photoPage(m.photo)} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted underline underline-offset-2 hover:text-ink">
                Source & licence
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-8 max-w-3xl text-[13px] text-muted">
          Trademarks and product names belong to their respective owners. JDHub is an independent marketplace and is not
          affiliated with the brands listed. Photos show the model, not the exact unit for sale; sellers share photos of
          the actual unit on request before payment.
        </p>
      </section>
    </>
  );
}
