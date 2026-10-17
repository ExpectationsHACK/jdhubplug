// Server-rendered building blocks for the admin dashboard.

import Link from "next/link";
import type { HealthCheck, HealthStatus } from "./health";
import { AdminIcon, type AdminIconName } from "./icons";
import s from "./core.module.css";

const TONE = {
  default: "text-ink",
  good: "text-ok",
  warn: "text-[#b45309]",
  bad: "text-sale",
  accent: "text-accent",
} as const;

export type TileTone = keyof typeof TONE;

/** KPI tile. Linked tiles lift on hover; `i` staggers the entrance animation. */
export function Tile({
  label,
  value,
  hint,
  icon,
  href,
  tone = "default",
  i = 0,
  trend,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: AdminIconName;
  href?: string;
  tone?: TileTone;
  i?: number;
  trend?: { text: string; up: boolean; vs: string } | null;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-bold text-muted">{label}</p>
        {icon && (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-stage text-ink-2 transition-colors group-hover:bg-ink group-hover:text-white">
            <AdminIcon name={icon} size={16} />
          </span>
        )}
      </div>
      <p className={`display mt-1.5 text-[24px] md:text-[26px] ${TONE[tone]}`}>{value}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
        {trend && (
          <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-bold ${trend.up ? "bg-[#e6f6ee] text-ok" : "bg-[#fde8ef] text-sale"}`}>
            <AdminIcon name={trend.up ? "arrowUp" : "arrowDown"} size={11} strokeWidth={2} />
            {trend.text}
            <span className="sr-only"> {trend.vs}</span>
          </span>
        )}
        {hint && <span>{hint}</span>}
      </div>
    </>
  );
  const cls = `group block rounded-2xl border border-line bg-white p-4 md:p-5 ${s.rise}`;
  const style = { ["--i" as string]: i } as React.CSSProperties;
  if (!href) {
    return (
      <div className={cls} style={style}>
        {body}
      </div>
    );
  }
  return (
    <Link href={href} className={`${cls} ${s.lift} outline-none focus-visible:ring-2 focus-visible:ring-accent`} style={style}>
      {body}
    </Link>
  );
}

/** Card with a header row and an optional "see all" link. */
export function Panel({
  title,
  description,
  href,
  hrefLabel = "View all",
  action,
  children,
  className = "",
  i = 0,
  id,
}: {
  title: string;
  description?: React.ReactNode;
  href?: string;
  hrefLabel?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  i?: number;
  id?: string;
}) {
  return (
    <section id={id} className={`rounded-2xl border border-line bg-white p-4 md:p-5 ${s.rise} ${className}`} style={{ ["--i" as string]: i } as React.CSSProperties}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[16px] font-bold">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
        </div>
        {action}
        {href && (
          <Link href={href} className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-1 text-[13px] font-bold text-ink-2 underline-offset-4 outline-none hover:text-ink hover:underline focus-visible:ring-2 focus-visible:ring-accent">
            {hrefLabel}
            <AdminIcon name="chevronRight" size={14} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

const STATUS_STYLE: Record<HealthStatus, { dot: string; icon: AdminIconName; label: string; text: string }> = {
  ok: { dot: "bg-[#e6f6ee] text-ok", icon: "check", label: "OK", text: "text-ok" },
  info: { dot: "bg-[#e8efff] text-accent", icon: "info", label: "Info", text: "text-accent" },
  warn: { dot: "bg-[#fff4e0] text-[#b45309]", icon: "alert", label: "Needs attention", text: "text-[#b45309]" },
  bad: { dot: "bg-[#fde8ef] text-sale", icon: "alert", label: "Action required", text: "text-sale" },
};

export function HealthList({ checks, extra }: { checks: HealthCheck[]; extra?: Record<string, React.ReactNode> }) {
  return (
    <ul className="grid gap-x-6 md:grid-cols-2">
      {checks.map((c) => {
        const st = STATUS_STYLE[c.status];
        return (
          <li key={c.id} className="flex gap-3 border-t border-line py-3.5 first:border-t-0 md:[&:nth-child(2)]:border-t-0">
            <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${st.dot}`}>
              <AdminIcon name={st.icon} size={14} strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline gap-x-2 text-[14px] font-bold">
                {c.label}
                <span className={`text-[11px] font-bold uppercase tracking-[0.04em] ${st.text}`}>{st.label}</span>
              </p>
              <p className="mt-0.5 break-words text-[13px] text-ink-2">{c.detail}</p>
              {c.fix && c.status !== "ok" && <p className="mt-1 break-words text-[12px] text-muted">{c.fix}</p>}
              {extra?.[c.id]}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
