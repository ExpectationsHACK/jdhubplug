"use server";

import { sessionWith } from "@/components/admin/core/guard";
import { audit } from "@/lib/auth";
import { TAGS } from "@/lib/data";
import { refreshFromAction } from "@/lib/revalidate";
import { resetCatalogToSeed } from "@/lib/store";

export type ResetState = { ok?: boolean; message?: string };

/** Wipe the catalog and write the seed catalog again. Orders, offers and settings stay. */
export async function resetCatalogAction(_prev: ResetState, form: FormData): Promise<ResetState> {
  const session = await sessionWith("danger");
  if (!session) return { ok: false, message: "Only the owner can reset the catalog." };
  if (form.get("confirm") !== "RESET") return { ok: false, message: "Type RESET in capitals to confirm." };

  await resetCatalogToSeed();
  await audit(session, "catalog.reset", undefined, "Catalog replaced with the seed catalog");
  refreshFromAction(TAGS.catalog, TAGS.offers);
  return { ok: true, message: "Catalog reset to the seed. Stock levels are back to their starting values." };
}
