import type { Metadata } from "next";
import { TrackPanel } from "@/components/checkout/TrackPanel";

export const metadata: Metadata = {
  title: "Your orders",
  description: "Track your JDHub orders with your order number and phone. No account or password needed.",
};

// No customer accounts yet: orders are opened with the order number + phone used at checkout.
export default function AccountPage() {
  return <TrackPanel title="Your orders." body="No password needed. Open any order with its number and the phone you checked out with." />;
}
