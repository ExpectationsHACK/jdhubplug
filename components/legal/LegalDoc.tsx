import Link from "next/link";
import { PageHero } from "@/components/PageHero";
import { LEGAL_PAGE_LABEL, LEGAL_PAGES, legalDate, type LegalPage, type ResolvedLegal } from "@/lib/legal";
import { RichText } from "./RichText";

export type LegalSection = {
  id: string;
  title: string;
  /** Markdown-lite (see RichText). */
  body: string;
  /** Extra UI after the text, e.g. the cookie settings button. */
  extra?: React.ReactNode;
};

/** Samsung-style legal page: hero, last-updated line, sticky table of contents. */
export function LegalDoc({ page, legal, intro, sections }: { page: LegalPage; legal: ResolvedLegal; intro: string; sections: LegalSection[] }) {
  const all = legal.clauses[page].trim() ? [...sections, { id: "additional-terms", title: "Additional terms", body: legal.clauses[page] }] : sections;
  const updated = legalDate(legal.updatedAt) || legalDate(legal.effectiveDate);
  return (
    <>
      <PageHero trail={[["Home", "/"], [LEGAL_PAGE_LABEL[page]]]} eyebrow="Legal" title={LEGAL_PAGE_LABEL[page]} body={intro}>
        <p className="mt-5 text-[13px] text-muted">
          Effective {legalDate(legal.effectiveDate)} · Last updated {updated}
        </p>
      </PageHero>

      <div className="wrap grid gap-10 lg:grid-cols-[260px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <nav aria-label="On this page" className="rounded-tile bg-stage p-5">
            <p className="mb-3 text-[13px] font-bold uppercase tracking-wide text-muted">On this page</p>
            <ol className="space-y-2 text-[14px]">
              {all.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="flex gap-2 py-1 text-ink-2 hover:text-ink hover:underline">
                    <span className="w-5 shrink-0 text-muted">{i + 1}.</span>
                    <span>{s.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <nav aria-label="Legal pages" className="mt-4 hidden flex-col gap-1 px-1 text-[13px] lg:flex">
            {LEGAL_PAGES.filter((p) => p !== page).map((p) => (
              <Link key={p} href={`/${p}`} className="link-cta text-[13px]">
                {LEGAL_PAGE_LABEL[p]}
              </Link>
            ))}
          </nav>
        </aside>

        <article className="min-w-0 max-w-3xl">
          {all.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-24 border-b border-line py-10 first:pt-0 last:border-0">
              <h2 className="display text-[22px] md:text-[26px]">
                <span className="text-muted">{i + 1}.</span> {s.title}
              </h2>
              <RichText text={s.body} className="mt-4" />
              {s.extra && <div className="mt-6">{s.extra}</div>}
            </section>
          ))}
          <p className="mt-6 rounded-tile bg-stage p-5 text-[14px] text-ink-2">
            Questions about this page? Email <a href={`mailto:${legal.email}`} className="font-bold text-accent underline underline-offset-2">{legal.email}</a> or call {legal.phone}.
          </p>
        </article>
      </div>
    </>
  );
}

/** The "who we are" paragraph every page shares. */
export function whoWeAre(l: ResolvedLegal) {
  const parts = [
    `**${l.entity}**${l.entity !== l.brand ? ` (trading as **${l.brand}**)` : ""}`,
    l.rcNumber ? `registered with the Corporate Affairs Commission under number **${l.rcNumber}**` : "a business registered in Nigeria",
    l.registeredAddress ? `with its registered address at ${l.registeredAddress}` : "",
  ].filter(Boolean);
  return `${parts.join(", ")}.`;
}
