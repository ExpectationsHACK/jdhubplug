import type { Metadata } from "next";
import Link from "next/link";
import { ActivityCard, NoAccess, PerformanceCard, activityFor } from "@/components/admin/products/ProductInsights";
import { ProductForm } from "@/components/admin/products/ProductForm";
import { ToastProvider } from "@/components/admin/products/Toasts";
import { productToInput } from "@/components/admin/products/validate";
import { AdminPage, Badge, EmptyState, PageHeader } from "@/components/admin/ui";
import { can, requireAdmin } from "@/lib/auth";
import { getProduct, listAudit, listOrders, listProducts } from "@/lib/store";
import type { OrderStatus } from "@/lib/types";
import { blobEnabled, formSuggestions } from "../_lib/suggestions";
import { requestNow } from "../_lib/time";

export const metadata: Metadata = { title: "Edit product" };

// Orders that represent a real sale (paid and not reversed).
const SOLD_STATUSES: OrderStatus[] = ["paid", "processing", "shipped", "delivered", "completed"];

export default async function EditProductPage({ params }: PageProps<"/admin/products/[id]">) {
  const session = await requireAdmin();
  const { id } = await params;
  const back = { href: "/admin/products", label: "Products" };

  if (!can(session.role, "products:write")) {
    return (
      <AdminPage>
        <PageHeader title="Edit product" back={back} />
        <NoAccess what="edit products" />
      </AdminPage>
    );
  }

  const [product, products, audit, orders] = await Promise.all([getProduct(id), listProducts(), listAudit(1000), listOrders()]);
  const now = await requestNow();

  if (!product) {
    return (
      <AdminPage>
        <PageHeader title="Product not found" back={back} />
        <EmptyState
          title="This product doesn't exist"
          body="It may have been deleted, or the link is wrong."
          action={
            <Link href="/admin/products" className="btn btn-outline">
              Back to products
            </Link>
          }
        />
      </AdminPage>
    );
  }

  let orderCount = 0;
  let revenue = 0;
  for (const o of orders) {
    if (!SOLD_STATUSES.includes(o.status)) continue;
    const lines = o.lines.filter((l) => l.productId === product.id);
    if (!lines.length) continue;
    orderCount++;
    revenue += lines.reduce((n, l) => n + l.finalUnitPrice * l.qty, 0);
  }

  const tone = product.status === "active" ? "green" : product.status === "draft" ? "amber" : "neutral";

  return (
    <AdminPage>
      <PageHeader
        title={product.name}
        back={back}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={tone}>{product.status[0].toUpperCase() + product.status.slice(1)}</Badge>
            {product.stock <= 0 && <Badge tone="red">Sold out</Badge>}
            <span className="font-mono text-[12px] text-muted">{product.id}</span>
          </span>
        }
      />
      <ToastProvider>
        <ProductForm
          key={`${product.id}:${product.updatedAt}:${product.stock}`}
          mode="edit"
          product={product}
          initial={productToInput(product)}
          blobEnabled={blobEnabled()}
          suggestions={formSuggestions(products)}
          aside={
            <>
              <PerformanceCard product={product} orders={orderCount} revenue={revenue} now={now} />
              <ActivityCard entries={activityFor(audit, product.id)} id={product.id} now={now} />
            </>
          }
        />
      </ToastProvider>
    </AdminPage>
  );
}
