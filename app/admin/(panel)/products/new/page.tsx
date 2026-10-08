import type { Metadata } from "next";
import { NoAccess } from "@/components/admin/products/ProductInsights";
import { ProductForm } from "@/components/admin/products/ProductForm";
import { ToastProvider } from "@/components/admin/products/Toasts";
import type { ProductInput } from "@/components/admin/products/validate";
import { AdminPage, PageHeader } from "@/components/admin/ui";
import { can, requireAdmin } from "@/lib/auth";
import { listProducts } from "@/lib/store";
import { blobEnabled, formSuggestions } from "../_lib/suggestions";

export const metadata: Metadata = { title: "Add product" };

const BLANK: ProductInput = {
  name: "",
  brand: "",
  category: "phones",
  model: "",
  grade: "great",
  price: "",
  was: "",
  stock: "1",
  status: "active",
  featured: false,
  badge: "",
  seller: "JDHub Certified",
  verified: true,
  state: "Lagos",
  spec: "",
  attrs: [
    ["Storage", ""],
    ["Colour", ""],
    ["Battery health", ""],
    ["IMEI", "Clean · checked"],
    ["Network", "Factory unlocked"],
  ],
  photo: "",
  imageUrl: "",
  art: "phone",
  tint: "#2a2a2a",
};

export default async function NewProductPage() {
  const session = await requireAdmin();
  if (!can(session.role, "products:write")) {
    return (
      <AdminPage>
        <PageHeader title="Add product" back={{ href: "/admin/products", label: "Products" }} />
        <NoAccess what="add products" />
      </AdminPage>
    );
  }
  const products = await listProducts();
  return (
    <AdminPage>
      <PageHeader title="Add product" description="List a new unit. It goes live as soon as you save it with the status set to Active." back={{ href: "/admin/products", label: "Products" }} />
      <ToastProvider>
        <ProductForm mode="create" initial={BLANK} blobEnabled={blobEnabled()} suggestions={formSuggestions(products)} />
      </ToastProvider>
    </AdminPage>
  );
}
