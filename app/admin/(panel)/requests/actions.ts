"use server";

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { audit, requireAdmin } from "@/lib/auth";
import { deleteLead, getLead, saveLead, withLock } from "@/lib/store";
import { isTradeIn, normalizeStatus } from "@/lib/tradein-flow";
import type { Lead } from "@/lib/types";

// Request (lead) Server Actions: status changes and deletion. Permission "leads:write".

export type LeadActionState = { ok?: boolean; error?: string; message?: string };

/** Contact and vendor requests only; sell / swap move through trade-actions.ts. */
const STATUSES: Lead["status"][] = ["new", "contacted", "closed"];
const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

async function findLead(raw: FormDataEntryValue | null) {
  const id = String(raw ?? "");
  if (!ID_RE.test(id)) return null;
  return getLead(id);
}

function friendly(e: unknown): LeadActionState {
  unstable_rethrow(e);
  const msg = e instanceof Error ? e.message : "";
  if (/permission/i.test(msg)) return { error: msg };
  console.error("[admin/requests]", e);
  return { error: "Something went wrong. Try again." };
}

/** Fields: id, status (new | contacted | closed). */
export async function setLeadStatusAction(_prev: LeadActionState, form: FormData): Promise<LeadActionState> {
  try {
    const s = await requireAdmin("leads:write");
    const status = String(form.get("status") ?? "") as Lead["status"];
    if (!STATUSES.includes(status)) return { error: "Unknown status." };
    const found = await findLead(form.get("id"));
    if (!found) return { error: "This request no longer exists." };
    if (isTradeIn(found)) return { error: "Open the request to move a sell or swap through its pipeline." };
    const from = await withLock(`lead:${found.id}`, async () => {
      const lead = await getLead(found.id);
      if (!lead) return null;
      const prev = normalizeStatus(lead);
      if (prev !== status) await saveLead({ ...lead, status });
      return prev;
    });
    if (from === null) return { error: "This request no longer exists." };
    if (from !== status) await audit(s, "lead.status", found.id, `${from} → ${status}`);
    refresh();
    return { ok: true, message: status === "new" ? "Reopened." : `Marked ${status}.` };
  } catch (e) {
    return friendly(e);
  }
}

/** Fields: id. */
export async function deleteLeadAction(_prev: LeadActionState, form: FormData): Promise<LeadActionState> {
  try {
    const s = await requireAdmin("leads:write");
    const lead = await findLead(form.get("id"));
    if (!lead) return { error: "This request no longer exists." };
    await deleteLead(lead.id);
    await audit(s, "lead.delete", lead.id, `${lead.type} from ${lead.name}`);
    refresh();
    return { ok: true, message: "Request deleted." };
  } catch (e) {
    return friendly(e);
  }
}
