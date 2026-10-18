import type { Metadata } from "next";
import Link from "next/link";
import { RestockList } from "@/components/admin/products/RestockList";
import { ToastProvider } from "@/components/admin/products/Toasts";
import { toRow } from "@/components/admin/products/types";
import { CATEGORY_OPTIONS, stockState } from "@/components/admin/products/validate";
import { AdminPage, Card, PageHeader, StatCard, relTime } from "@/components/admin/ui";
import { ProductImage } from "@/components/ProductImage";
import { s } from "@/components/admin/products/styles";
import { can, requireAdmin } from "@/lib/auth";
import { formatNaira } from "@/lib/reference";
import { getSettings, listProducts } from "@/lib/store";
import { requestNow } from "../products/_lib/time";

export const metadata: Metadata = { title: "Inventory" };

const DAY = 86_400_000;
const SLOW_AFTER_DAYS = 30;

const compactNaira = (n: number) => {
  if (n >= 1e9) return `₦${(n / 1e9).toFixed(n >= 1e10 ? 0 : 1)}bn`;
  if (n >= 1e6) return `₦${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)}m`;
  return formatNaira(n);
};

export default async function InventoryPage() {
  const session = await requireAdmin();
  const [products, settings] = await Promise.all([listProducts(), getSettings()]);
  const now = await requestNow();
  const canStock = can(session.role, "inventory:write");
  const low = settings.lowStockThreshold;

  // Archived products are out of circulation, so they don't count towards stock.
  const tracked = products.filter((p) => p.status !== "archived");
  const units = tracked.reduce((n, p) => n + p.stock, 0);
  const value = tracked.reduce((n, p) => n + p.price * p.stock, 0);
  const lowList = tracked.filter((p) => stockState(p.stock, low, p.category) === "low").sort((a, b) => a.stock - b.stock || b.sold - a.sold);
  const outList = tracked.filter((p) => p.stock <= 0).sort((a, b) => b.sold - a.sold || b.updatedAt.localeCompare(a.updatedAt));

  const byCategory = CATEGORY_OPTIONS.map((c) => {
    const items = tracked.filter((p) => p.category === c.value);
    return {
      ...c,
      products: items.length,
      units: items.reduce((n, p) => n + p.stock, 0),
      value: items.reduce((n, p) => n + p.price * p.stock, 0),
      out: items.filter((p) => p.stock <= 0).length,
    };
  });
  const maxValue = Math.max(1, ...byCategory.map((c) => c.value));

  const recent = [...products].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8);
  const slow = products
    .filter((p) => p.status === "active" && p.sold === 0 && p.stock > 0 && now - Date.parse(p.createdAt) >= SLOW_AFTER_DAYS * DAY)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const slowValue = slow.reduce((n, p) => n + p.price * p.stock, 0);

  return (
    <AdminPage>
      <PageHeader
        title="Inventory"
        description={
          <>
            Stock across {tracked.length} products. Low stock means {low} {low === 1 ? "unit" : "units"} or fewer
            {can(session.role, "settings:write") && (
              <>
                {" "}
                (
                <Link href="/admin/settings" className="underline underline-offset-2">
                  change
                </Link>
                )
              </>
            )}
            .
          </>
        }
        actions={
          <Link href="/admin/products" className="btn btn-outline">
            All products
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        {[
          <StatCard key="v" label="Stock value" value={compactNaira(value)} hint={`${formatNaira(value)} at selling price`} />,
          <StatCard key="u" label="Units in stock" value={units.toLocaleString("en-NG")} hint={`${tracked.filter((p) => p.stock > 0).length} products available`} />,
          <StatCard key="l" label="Low stock" value={lowList.length} tone={lowList.length ? "warn" : "default"} hint={`≤ ${low} left`} />,
          <StatCard key="o" label="Sold out" value={outList.length} tone={outList.length ? "bad" : "default"} hint="Restock or archive" />,
        ].map((card, i) => (
          <div key={i} className={s.rise} style={{ animationDelay: `${i * 60}ms` }}>
            {card}
          </div>
        ))}
      </div>

      <ToastProvider>
        <div className="mt-6 grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
          <Card
            title={`Low stock (${lowList.length})`}
            actions={
              <Link href="/admin/products?stock=low" className="text-[13px] font-bold text-muted hover:text-ink">
                View in list
              </Link>
            }
          >
            <RestockList rows={lowList.map(toRow)} lowStock={low} canStock={canStock} emptyText="Nothing is running low." />
          </Card>
          <Card
            title={`Sold out (${outList.length})`}
            actions={
              <Link href="/admin/products?stock=out" className="text-[13px] font-bold text-muted hover:text-ink">
                View in list
              </Link>
            }
          >
            <RestockList rows={outList.map(toRow)} lowStock={low} canStock={canStock} emptyText="Nothing is sold out." />
          </Card>
        </div>
      </ToastProvider>

      <div className="mt-6 grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card title="Stock by category">
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-[14px]">
              <caption className="sr-only">Products, units and stock value by category</caption>
              <thead>
                <tr className="text-[12px] uppercase tracking-wide text-muted">
                  <th className="pb-2 font-bold">Category</th>
                  <th className="pb-2 text-right font-bold">Products</th>
                  <th className="pb-2 text-right font-bold">Units</th>
                  <th className="pb-2 text-right font-bold">Value</th>
                  <th className="w-[30%] pb-2 pl-4 font-bold">
                    <span className="sr-only">Share of stock value</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {byCategory.map((c, i) => (
                  <tr key={c.value} className="border-t border-line">
                    <td className="py-3">
                      <Link href={`/admin/products?category=${c.value}`} className="font-bold hover:underline">
                        {c.label}
                      </Link>
                      {c.out > 0 && <span className="ml-2 text-[12px] text-sale">{c.out} sold out</span>}
                    </td>
                    <td className="py-3 text-right tabular-nums">{c.products}</td>
                    <td className="py-3 text-right tabular-nums">{c.units.toLocaleString("en-NG")}</td>
                    <td className="py-3 text-right font-bold tabular-nums">{compactNaira(c.value)}</td>
                    <td className="py-3 pl-4" title={`${Math.round((c.value / Math.max(1, value)) * 100)}% of stock value`}>
                      <span className={s.track}>
                        <span className={s.bar} style={{ width: `${(c.value / maxValue) * 100}%`, animationDelay: `${i * 80}ms` }} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Recently updated">
          <ul className="space-y-3">
            {recent.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/products/${p.id}`} className="group flex items-center gap-3">
                  <span className="shrink-0 overflow-hidden rounded-lg bg-stage">
                    <ProductImage item={p} width={120} className="h-9 w-9" artClassName="h-7 w-7" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold group-hover:underline">{p.name}</span>
                    <span className="block text-[12px] text-muted">
                      {formatNaira(p.price)} · {p.stock} in stock
                    </span>
                  </span>
                  <time dateTime={p.updatedAt} className="shrink-0 text-[12px] text-muted">
                    {relTime(p.updatedAt, now)}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title={`Slow movers (${slow.length})`} className="mt-6">
        <p className="-mt-2 mb-4 text-[13px] text-muted">
          Live for {SLOW_AFTER_DAYS}+ days with no sales{slow.length ? ` · ${compactNaira(slowValue)} tied up` : ""}. Consider a price drop, a badge, or an offer link.
        </p>
        {slow.length === 0 ? (
          <p className="rounded-xl bg-stage/70 px-4 py-6 text-center text-[13px] text-ink-2">No slow movers. Everything listed for a month has sold at least once.</p>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[14px]">
              <thead>
                <tr className="text-[12px] uppercase tracking-wide text-muted">
                  <th className="pb-2 font-bold">Product</th>
                  <th className="pb-2 text-right font-bold">Listed</th>
                  <th className="pb-2 text-right font-bold">Price</th>
                  <th className="pb-2 text-right font-bold">Stock</th>
                  <th className="pb-2">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {slow.slice(0, 25).map((p) => (
                  <tr key={p.id} className="border-t border-line">
                    <td className="py-2.5">
                      <span className="block max-w-[280px] truncate font-bold">{p.name}</span>
                      <span className="block truncate text-[12px] text-muted">{p.spec}</span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-ink-2">{Math.floor((now - Date.parse(p.createdAt)) / DAY)} days</td>
                    <td className="py-2.5 text-right tabular-nums">{formatNaira(p.price)}</td>
                    <td className="py-2.5 text-right tabular-nums">{p.stock}</td>
                    <td className="py-2.5 text-right">
                      <Link href={`/admin/products/${p.id}`} className="text-[13px] font-bold underline underline-offset-4">
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {slow.length > 25 && (
              <p className="mt-3 text-[13px] text-muted">
                And {slow.length - 25} more.{" "}
                <Link href="/admin/products?sort=oldest&status=active" className="font-bold underline">
                  See them in the list
                </Link>
              </p>
            )}
          </div>
        )}
      </Card>
    </AdminPage>
  );
}
