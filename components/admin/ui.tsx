// Admin UI primitives shared by every admin page. Server-component friendly (no hooks).
// Keep these exports stable: admin pages across the app depend on them.

import Link from "next/link";
import type { OrderStatus } from "@/lib/types";

export const inputCls =
  "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[14px] outline-none transition focus:border-transparent focus:ring-2 focus:ring-accent";
export const selectCls = inputCls + " pr-8";
export const labelCls = "mb-1.5 block text-[13px] font-bold text-ink-2";

export function AdminPage({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">{children}</div>;
}

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {back && (
          <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-[13px] font-bold text-muted hover:text-ink">
            ← {back.label}
          </Link>
        )}
        <h1 className="display text-[26px] md:text-[30px]">{title}</h1>
        {description && <p className="mt-1 text-[14px] text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = "", title, actions }: { children: React.ReactNode; className?: string; title?: string; actions?: React.ReactNode }) {
  return (
    <section className={`rounded-2xl border border-line bg-white p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-[16px] font-bold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({ label, value, hint, tone = "default" }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "default" | "good" | "warn" | "bad" }) {
  const toneCls = { default: "text-ink", good: "text-ok", warn: "text-[#b45309]", bad: "text-sale" }[tone];
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <p className="text-[13px] font-bold text-muted">{label}</p>
      <p className={`display mt-2 text-[26px] ${toneCls}`}>{value}</p>
      {hint && <p className="mt-1 text-[12px] text-muted">{hint}</p>}
    </div>
  );
}

export type Tone = "neutral" | "blue" | "green" | "amber" | "red" | "purple";

const TONE_CLS: Record<Tone, string> = {
  neutral: "bg-stage text-ink-2",
  blue: "bg-[#e8efff] text-accent",
  green: "bg-[#e6f6ee] text-ok",
  amber: "bg-[#fff4e0] text-[#b45309]",
  red: "bg-[#fde8ef] text-sale",
  purple: "bg-[#f1e9ff] text-[#6b21a8]",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-bold ${TONE_CLS[tone]}`}>{children}</span>;
}

export const ORDER_TONE: Record<OrderStatus, Tone> = {
  pending: "amber",
  paid: "blue",
  processing: "purple",
  shipped: "purple",
  delivered: "green",
  completed: "green",
  cancelled: "neutral",
  refunded: "red",
};

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white px-6 py-14 text-center">
      <p className="text-[16px] font-bold">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-md text-[14px] text-ink-2">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Table shell with consistent styling. Put <thead>/<tbody> inside. */
export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white">
      <table className="adm-table w-full min-w-[640px] text-left text-[14px]">{children}</table>
    </div>
  );
}

export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className={labelCls}>{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-muted">{hint}</span>}
    </label>
  );
}

export const relTime = (iso: string, now = Date.now()) => {
  const s = Math.round((now - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
};

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
