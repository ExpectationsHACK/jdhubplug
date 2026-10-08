import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { SwapPlanner } from "@/components/SwapPlanner";

export const metadata: Metadata = { title: "Swap & trade up" };

export default function SwapPage() {
  return (
    <>
      <PageHero
        trail={[["Home", "/"], ["Swap"]]}
        eyebrow="Swap & trade up"
        title="Trade up. Pay only the difference."
        body="Value your current phone, pick your next one, and we roll one into the other. Escrow-protected end to end."
      />
      <section className="wrap">
        <SwapPlanner />
      </section>
    </>
  );
}
