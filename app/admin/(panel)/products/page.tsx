import type { Metadata } from "next";
import Link from "next/link";
import { readFilters } from "@/components/admin/products/filters";
import { ProductsTable } from "@/components/admin/products/ProductsTable";
import { ToastProvider } from "@/components/admin/products/Toasts";
import { toRow } from "@/components/admin/products/types";
import { AdminPage, PageHeader } from "@/components/admin/ui";
import { Icon } from "@/components/Icon";
import { can, requireAdmin } from "@/lib/auth";
import { getSettings, listProducts } from "@/lib/store";
import { requestNow } from "./_lib/time";

export const metadata: Metadata = { title: "Products" };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function ProductsPage({ searchParams }: PageProps<"/admin/products">) {
  const session = await requireAdmin();
  const [products, settings, sp] = await Promise.all([listProducts(), getSettings(), searchParams]);
  const now = await requestNow();
  const canEdit = can(session.role, "products:write");
  const canStock = can(session.role, "inventory:write");

  const live = products.filter((p) => p.status === "active");
  const units = live.reduce((n, p) => n + p.stock, 0);

  return (
    <AdminPage>
      <PageHeader
        title="Products"
        description={
          <>
            {products.length} products · {live.length} live on the store · {units.toLocaleString("en-NG")} units in stock
          </>
        }
        actions={
          <>
            {canEdit && (
              <>
                <a href="/api/admin/products/export" className="btn btn-outline" download>
                  <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5M5 19.5h14" />
                  </svg>
                  Export
                </a>
                <Link href="/admin/products/import" className="btn btn-outline">
                  <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 15V4m-4.5 4.5L12 4l4.5 4.5M5 19.5h14" />
                  </svg>
                  Import
                </Link>
                <Link href="/admin/products/new" className="btn btn-primary">
                  <Icon name="tag" size={16} /> Add product
                </Link>
              </>
            )}
          </>
        }
      />
      <ToastProvider>
        <ProductsTable
          products={products.map(toRow)}
          lowStock={settings.lowStockThreshold}
          canEdit={canEdit}
          canStock={canStock}
          initial={readFilters(sp)}
          now={now}
          notice={one(sp.deleted) === "1" ? "Product deleted." : undefined}
        />
      </ToastProvider>
    </AdminPage>
  );
}
