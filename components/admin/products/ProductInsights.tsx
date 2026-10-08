import Link from "next/link";
import { Card, EmptyState, relTime } from "@/components/admin/ui";
import { formatNaira } from "@/lib/catalog";
import type { AuditEntry, Product } from "@/lib/types";

// Server-rendered side cards for the product edit page: sales performance and the
// product's recent activity from the audit log.

const ACTION_LABEL: Record<string, string> = {
  "product.create": "Created",
  "product.duplicate": "Created as a copy",
  "product.update": "Edited",
  "product.price": "Price changed",
  "product.stock": "Stock changed",
  "product.delete": "Deleted",
  "product.import": "Updated by CSV import",
  "product.bulk-status": "Status changed (bulk)",
  "product.bulk-featured": "Featured changed (bulk)",
  "product.bulk-badge": "Badge changed (bulk)",
  "product.bulk-price": "Price changed (bulk)",
  "product.bulk-stock": "Stock changed (bulk)",
};

/** Bulk entries list many products; keep the part about this one. */
function detailFor(e: AuditEntry, id: string) {
  const d = e.detail ?? "";
  if (!e.target?.includes(",")) return d;
  const part = d.split("; ").find((x) => x.includes(`${id} `) || x.endsWith(`: ${id}`) || x === id);
  const head = d.split(":")[0];
  return part ? `${head}: ${part.replace(/^.*?: /, "")}` : head;
}

/** Audit entries that concern a product (single target or a bulk list of ids). */
export function activityFor(entries: AuditEntry[], id: string) {
  return entries.filter((e) => e.target === id || (e.target?.includes(",") && e.target.split(",").includes(id)));
}

export function PerformanceCard({ product, orders, revenue, now }: { product: Product; orders: number; revenue: number; now: number }) {
  const rows: [string, React.ReactNode][] = [
    ["Units sold", product.sold],
    ["Orders", orders],
    ["Revenue", formatNaira(revenue)],
    ["In stock", product.stock <= 0 ? <span className="text-sale">Sold out</span> : product.stock],
    ["Listed", product.createdAt ? relTime(product.createdAt, now) : "—"],
    ["Last edited", product.updatedAt ? relTime(product.updatedAt, now) : "—"],
  ];
  return (
    <Card title="Performance">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[12px] text-muted">{k}</dt>
            <dd className="text-[15px] font-bold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[11px] text-muted">Orders and revenue count paid orders that weren&apos;t cancelled or refunded.</p>
    </Card>
  );
}

export function ActivityCard({ entries, id, now }: { entries: AuditEntry[]; id: string; now: number }) {
  return (
    <Card
      title="Recent activity"
      actions={
        <Link href="/admin/activity" className="text-[13px] font-bold text-muted hover:text-ink">
          All activity
        </Link>
      }
    >
      {entries.length === 0 ? (
        <p className="text-[13px] text-muted">No changes recorded yet.</p>
      ) : (
        <ol className="relative space-y-4 border-l border-line pl-4">
          {entries.slice(0, 12).map((e, i) => {
            const detail = detailFor(e, id);
            return (
              <li key={`${e.at}-${i}`} className="relative">
                <span aria-hidden className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-ink" />
                <p className="text-[13px] font-bold">{ACTION_LABEL[e.action] ?? e.action}</p>
                {detail && (
                  <p className="mt-0.5 break-words text-[12px] text-ink-2" title={detail.length > 160 ? detail : undefined}>
                    {detail.length > 160 ? `${detail.slice(0, 159)}…` : detail}
                  </p>
                )}
                <p className="mt-0.5 text-[11px] text-muted">
                  {e.by} · <time dateTime={e.at}>{relTime(e.at, now)}</time>
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

export function NoAccess({ what }: { what: string }) {
  return (
    <EmptyState
      title="You don't have access to this"
      body={`Your role can't ${what}. Ask the owner or a manager if you need it.`}
      action={
        <Link href="/admin" className="btn btn-outline">
          Back to dashboard
        </Link>
      }
    />
  );
}
