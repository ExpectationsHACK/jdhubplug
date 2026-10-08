import type { Metadata } from "next";
import { Suspense } from "react";
import { BackupCard, ResetCard, RestoreCard } from "@/components/admin/core/DataTools";
import { AdminIcon } from "@/components/admin/core/icons";
import { NoAccess, SettingsTabs } from "@/components/admin/core/SettingsTabs";
import { AdminPage, PageHeader } from "@/components/admin/ui";
import { can, requireAdmin } from "@/lib/auth";
import { listLeads, listOffers, listOrders, listProducts, storageStatus } from "@/lib/store";

export const metadata: Metadata = { title: "Data & backups" };

export default function DataPage() {
  return (
    <AdminPage>
      <PageHeader title="Settings" description="Contact details, delivery, payments and what the storefront shows." />
      <Suspense fallback={<div aria-busy="true" className="h-96 animate-pulse rounded-2xl bg-white" />}>
        <DataBody />
      </Suspense>
    </AdminPage>
  );
}

async function DataBody() {
  const session = await requireAdmin();
  if (!can(session.role, "danger")) {
    return <NoAccess body="Backups, restores and catalog resets are limited to the store owner." />;
  }
  const [products, orders, offers, leads] = await Promise.all([listProducts(), listOrders(), listOffers(), listLeads()]);
  const storage = storageStatus();

  return (
    <>
      <SettingsTabs active="data" isOwner />
      <div className="flex flex-col gap-4">
        <div
          className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-[13px] ${
            storage.kind === "redis" ? "border-line bg-white text-ink-2" : "border-[#f5c06b] bg-[#fff8eb] text-[#7a4b00]"
          }`}
        >
          <AdminIcon name="database" size={18} className="mt-0.5 shrink-0" />
          <p>
            <b>Storage: {storage.label}.</b> {storage.hint ?? "Data is saved permanently and shared by every server."}
            {storage.kind !== "redis" && " Download a backup before redeploying, then restore it once Redis is connected."}
          </p>
        </div>
        <BackupCard counts={{ products: products.length, orders: orders.length, offers: offers.length, leads: leads.length }} />
        <RestoreCard />
        <ResetCard />
      </div>
    </>
  );
}
