import type { Metadata } from "next";
import { Suspense } from "react";
import type { PickerProduct } from "@/components/admin/core/HeroPicker";
import { AdminIcon } from "@/components/admin/core/icons";
import { SettingsForm } from "@/components/admin/core/SettingsForm";
import { SettingsTabs } from "@/components/admin/core/SettingsTabs";
import { AdminPage, PageHeader } from "@/components/admin/ui";
import { can, requireAdmin } from "@/lib/auth";
import { getSettings, listProducts } from "@/lib/store";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <AdminPage>
      <PageHeader title="Settings" description="Contact details, delivery, payments and what the storefront shows." />
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsBody />
      </Suspense>
    </AdminPage>
  );
}

async function SettingsBody() {
  const session = await requireAdmin();
  const readOnly = !can(session.role, "settings:write");
  const [settings, products] = await Promise.all([getSettings(), listProducts()]);

  // The picker only needs a few fields; keep the payload small.
  const hero = new Set(settings.heroProductIds);
  const picker: PickerProduct[] = products
    .filter((p) => p.status === "active" || hero.has(p.id))
    .map(({ id, name, spec, price, brand, category, stock, status, photo, imageUrl, art, tint }) => ({
      id,
      name,
      spec,
      price,
      brand,
      category,
      stock,
      status,
      photo,
      imageUrl,
      art,
      tint,
    }));

  return (
    <>
      <SettingsTabs active="general" isOwner={can(session.role, "danger")} />
      {readOnly && (
        <div role="note" className="mb-6 flex items-start gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-[13px] text-ink-2">
          <AdminIcon name="lock" size={18} className="mt-0.5 shrink-0" />
          <p>
            <b className="text-ink">View only.</b> Support staff can see store settings to help buyers, but only the owner or a manager can change them.
          </p>
        </div>
      )}
      <SettingsForm settings={settings} products={picker} readOnly={readOnly} />
    </>
  );
}

function SettingsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading settings" className="flex flex-col gap-8">
      <div className="h-8 w-64 animate-pulse rounded-lg bg-line/70" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="grid gap-4 lg:grid-cols-3 lg:gap-8">
          <div className="space-y-2">
            <div className="h-5 w-32 animate-pulse rounded bg-line" />
            <div className="h-4 w-48 animate-pulse rounded bg-line/70" />
          </div>
          <div className="h-48 animate-pulse rounded-2xl bg-white lg:col-span-2" />
        </div>
      ))}
    </div>
  );
}
