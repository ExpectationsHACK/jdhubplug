import type { Metadata } from "next";
import { TrackPanel } from "@/components/checkout/TrackPanel";

export const metadata: Metadata = {
  title: "Track your order",
  description: "Check the status of your JDHub order with your order number and phone.",
};

export default function TrackPage() {
  return <TrackPanel title="Track your order." body="Payment, inspection, delivery and escrow, all in one place." />;
}
