import type { Metadata } from "next";
import { ImportPanel } from "@/components/admin/products/ImportPanel";
import { NoAccess } from "@/components/admin/products/ProductInsights";
import { AdminPage, PageHeader } from "@/components/admin/ui";
import { can, requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Import products" };

export default async function ImportProductsPage() {
  const session = await requireAdmin();
  const allowed = can(session.role, "products:write");
  return (
    <AdminPage>
      <PageHeader
        title="Import products"
        description="Create and update products in bulk from a spreadsheet. You'll see every change before anything is saved."
        back={{ href: "/admin/products", label: "Products" }}
      />
      {allowed ? <ImportPanel /> : <NoAccess what="import products" />}
    </AdminPage>
  );
}
