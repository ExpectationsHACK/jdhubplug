import Link from "next/link";
import { Icon } from "./Icon";

export function Breadcrumbs({ trail }: { trail: [string, string?][] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-[13px] text-muted">
      <ol className="flex flex-wrap items-center gap-1">
        {trail.map(([label, href], i) => (
          <li key={label} className="flex items-center gap-1">
            {i > 0 && <Icon name="chevronRight" size={14} />}
            {href ? (
              <Link href={href} className="hover:text-ink hover:underline">
                {label}
              </Link>
            ) : (
              <span className="text-ink">{label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageHero({
  eyebrow,
  title,
  body,
  trail,
  children,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  trail: [string, string?][];
  children?: React.ReactNode;
}) {
  return (
    <section className="wrap pb-10 pt-6">
      <Breadcrumbs trail={trail} />
      <div className="pt-10 text-center">
        {eyebrow && <p className="mb-2 text-[14px] font-bold text-accent">{eyebrow}</p>}
        <h1 className="display text-[32px] md:text-[48px]">{title}</h1>
        {body && <p className="mx-auto mt-4 max-w-2xl text-[16px] text-ink-2 md:text-[18px]">{body}</p>}
        {children}
      </div>
    </section>
  );
}
