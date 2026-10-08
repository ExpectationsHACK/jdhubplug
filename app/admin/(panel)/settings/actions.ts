"use server";

import { sessionWith } from "@/components/admin/core/guard";
import { settingsDiff, validateSettings, type SettingsErrors } from "@/components/admin/core/settings-schema";
import { audit } from "@/lib/auth";
import { TAGS } from "@/lib/data";
import { refreshFromAction } from "@/lib/revalidate";
import { getSettings, listProducts, saveSettings } from "@/lib/store";

export type SettingsState = { ok?: boolean; message?: string; errors?: SettingsErrors; savedAt?: number };

const str = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
};

export async function saveSettingsAction(_prev: SettingsState, form: FormData): Promise<SettingsState> {
  const session = await sessionWith("settings:write");
  if (!session) return { ok: false, message: "Only the owner or a manager can change settings." };

  // Hours in the form, minutes in storage.
  const hours = Number(str(form, "reservationHours").replace(",", "."));
  const cities = form.getAll("hub_city");
  const addresses = form.getAll("hub_address");
  const openHours = form.getAll("hub_hours");

  const [before, products] = await Promise.all([getSettings(), listProducts()]);
  const result = validateSettings(
    {
      storeName: str(form, "storeName"),
      whatsapp: str(form, "whatsapp"),
      phone: str(form, "phone"),
      email: str(form, "email"),
      promoText: str(form, "promoText"),
      promoLink: str(form, "promoLink"),
      promoEnabled: form.get("promoEnabled") === "on",
      lowStockThreshold: str(form, "lowStockThreshold"),
      reservationMinutes: Number.isFinite(hours) ? hours * 60 : NaN,
      deliveryFeeLagos: str(form, "deliveryFeeLagos"),
      deliveryFeeOther: str(form, "deliveryFeeOther"),
      freeDeliveryOver: str(form, "freeDeliveryOver"),
      hubs: cities.slice(0, 50).map((c, i) => ({ city: c, address: addresses[i], hours: openHours[i] })),
      bank: { bankName: str(form, "bankName"), accountName: str(form, "accountName"), accountNumber: str(form, "accountNumber") },
      hideSoldOut: form.get("hideSoldOut") === "on",
      heroProductIds: form.getAll("hero").slice(0, 50),
    },
    { knownProductIds: new Set(products.map((p) => p.id)) },
  );

  if (!result.ok) {
    const n = Object.keys(result.errors).length;
    return { ok: false, errors: result.errors, message: `Check ${n} field${n === 1 ? "" : "s"} and try again.` };
  }

  const changes = settingsDiff(before, result.settings);
  if (!changes.length) return { ok: true, message: "No changes to save.", savedAt: Date.now() };

  await saveSettings(result.settings);
  await audit(session, "settings.update", undefined, changes.join("; ").slice(0, 600));
  refreshFromAction(TAGS.settings, TAGS.catalog);
  return { ok: true, message: `Saved ${changes.length} change${changes.length === 1 ? "" : "s"}. The storefront is updated.`, savedAt: Date.now() };
}
