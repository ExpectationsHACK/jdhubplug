"use server";

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { audit, requireAdmin } from "@/lib/auth";
import { deleteLead, listLeads, saveLead } from "@/lib/store";
import type { Lead } from "@/lib/types";

// Request (lead) Server Actions: status changes and deletion. Permission "leads:write".

export type LeadActionState = { ok?: boolean; error?: string; message?: string };

const STATUSES: Lead["status"][] = ["new", "contacted", "closed"];
const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

async function findLead(raw: FormDataEntryValue | null) {
  const id = String(raw ?? "");
  if (!ID_RE.test(id)) return null;
  return (await listLeads()).find((l) => l.id === id) ?? null;
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
    const lead = await findLead(form.get("id"));
    if (!lead) return { error: "This request no longer exists." };
    if (lead.status !== status) {
      await saveLead({ ...lead, status });
      await audit(s, "lead.status", lead.id, `${lead.status} → ${status}`);
    }
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
