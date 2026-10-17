import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { SwapPlanner, type SwapProduct } from "@/components/SwapPlanner";
import { getCatalog, getStoreSettings } from "@/lib/data";

export const metadata: Metadata = {
  title: "Swap & trade up",
  description: "Value your phone, pick an in-stock upgrade and pay only the difference. Escrow-protected.",
};

export default async function SwapPage() {
  const [catalog, settings] = await Promise.all([getCatalog(), getStoreSettings()]);
  // Only what the planner renders, to keep the client payload small.
  const products: SwapProduct[] = catalog
    .filter((p) => (p.category === "phones" || p.category === "gadgets") && p.stock > 0)
    .map((p) => ({
      id: p.id,
      model: p.model,
      name: p.name,
      spec: p.spec,
      price: p.price,
      grade: p.grade,
      stock: p.stock,
      status: p.status,
      photo: p.photo,
      imageUrl: p.imageUrl,
      art: p.art,
      tint: p.tint,
      category: p.category,
    }));
  return (
    <>
      <PageHero
        trail={[["Home", "/"], ["Swap"]]}
        eyebrow="Swap & trade up"
        title="Trade up. Pay only the difference."
        body="Value your current phone, pick your next one, and we roll one into the other. Escrow-protected end to end."
      />
      <section className="wrap">
        <SwapPlanner products={products} whatsapp={settings.whatsapp} />
      </section>
    </>
  );
}
