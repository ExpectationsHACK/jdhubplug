import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminPage, Badge, Card, EmptyState, PageHeader, StatCard, Table, fmtDate, relTime, selectCls, type Tone } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { DSR_STATUS_LABEL, DSR_TYPE_LABEL, LEGAL_PAGE_LABEL, LEGAL_PAGES, legalDate, type DataRequest, type DsrStatus } from "@/lib/legal";
import { getLegal, listDataRequests } from "@/lib/legal-store";
import { getSettings } from "@/lib/store";
import { anonymiseCustomerAction, setRequestStatusAction } from "./actions";
import { ConfirmButton } from "./ConfirmButton";
import { LegalForm } from "./LegalForm";

export const metadata: Metadata = { title: "Privacy & legal" };

const STATUS_TONE: Record<DsrStatus, Tone> = { new: "amber", in_progress: "blue", done: "green" };

/** Requests still open after 30 days (the NDPA response target). Call after connection(). */
function ageSummary(requests: DataRequest[]) {
  const now = Date.now();
  return { now, overdue: requests.filter((r) => r.status !== "done" && now - Date.parse(r.createdAt) > 30 * 86_400_000).length };
}

export default function PrivacyAdminPage() {
  return (
    <AdminPage>
      <PageHeader
        title="Privacy & legal"
        description="Legal pages, cookie consent and data-subject requests under the Nigeria Data Protection Act 2023."
        actions={LEGAL_PAGES.map((p) => (
          <Link key={p} href={`/${p}`} target="_blank" className="rounded-full border border-line bg-white px-3 py-1.5 text-[13px] font-bold hover:border-ink">
            {LEGAL_PAGE_LABEL[p]} ↗
          </Link>
        ))}
      />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" />}>
        <PrivacyBody />
      </Suspense>
    </AdminPage>
  );
}

async function PrivacyBody() {
  await requireAdmin("settings:write");
  await connection();
  const [legal, settings, requests] = await Promise.all([getLegal(), getSettings(), listDataRequests()]);
  const count = (s: DsrStatus) => requests.filter((r) => r.status === s).length;
  const { now, overdue } = ageSummary(requests);

  return (
    <>
      <div role="note" className="mb-6 rounded-2xl border border-[#f5c06b] bg-[#fff8eb] p-5 text-[14px] text-[#7a4b00]">
        <p className="font-bold">Important: have a lawyer review this.</p>
        <p className="mt-1">
          The privacy policy, terms, returns and cookie pages are a professionally written starting point tailored to JDHub, not legal advice. Before relying
          on them, have a Nigerian lawyer review the text, retention periods, liability limits and your NDPA obligations (including whether you must register
          with the NDPC as a data controller of major importance and file annual compliance audits). Fill in every business detail below.
        </p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="New requests" value={count("new")} tone={count("new") ? "warn" : "default"} />
        <StatCard label="In progress" value={count("in_progress")} />
        <StatCard label="Done" value={count("done")} tone="good" />
        <StatCard label="Older than 30 days" value={overdue} tone={overdue ? "bad" : "default"} hint="Aim to answer every request within 30 days." />
      </div>

      <section className="mb-10">
        <h2 className="mb-3 text-[18px] font-bold">Data requests</h2>
        {requests.length === 0 ? (
          <EmptyState title="No data requests yet" body="Requests customers send from their account page (download, correction, deletion) appear here." />
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Request</th>
                <th>Customer</th>
                <th>Details</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="align-top">
                  <td>
                    <p className="font-bold">{r.id}</p>
                    <p className="text-[13px]">{DSR_TYPE_LABEL[r.type]}</p>
                    <p className="text-[12px] text-muted" title={fmtDate(r.createdAt)}>
                      {relTime(r.createdAt, now)}
                    </p>
                  </td>
                  <td>
                    <p className="font-mono text-[13px]">{r.customerId ?? "—"}</p>
                    {r.contact && <p className="text-[13px] text-ink-2">{r.contact}</p>}
                    {r.anonymisedAt && <Badge tone="neutral">Anonymised {legalDate(r.anonymisedAt)}</Badge>}
                  </td>
                  <td className="max-w-xs">
                    {r.message ? <p className="whitespace-pre-wrap break-words text-[13px]">{r.message}</p> : <p className="text-[13px] text-muted">No message</p>}
                    {r.history.length > 1 && <p className="mt-1 text-[12px] text-muted">Last: {r.history[r.history.length - 1].note} ({r.history[r.history.length - 1].by})</p>}
                  </td>
                  <td>
                    <Badge tone={STATUS_TONE[r.status]}>{DSR_STATUS_LABEL[r.status]}</Badge>
                  </td>
                  <td>
                    <div className="flex flex-col items-end gap-2">
                      <form action={setRequestStatusAction} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={r.id} />
                        <select name="status" defaultValue={r.status} className={`${selectCls} w-36 py-1.5 text-[13px]`} aria-label={`Status of ${r.id}`}>
                          {(Object.keys(DSR_STATUS_LABEL) as DsrStatus[]).map((s) => (
                            <option key={s} value={s}>
                              {DSR_STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                        <button className="rounded-full border border-line px-3 py-1.5 text-[13px] font-bold hover:border-ink">Update</button>
                      </form>
                      {r.customerId && !r.anonymisedAt && (
                        <form action={anonymiseCustomerAction}>
                          <input type="hidden" name="id" value={r.id} />
                          <ConfirmButton
                            message={`Anonymise customer ${r.customerId}? Their name, phone, email and address are removed and the account is blocked. Orders are kept. This can't be undone.`}
                            className="rounded-full bg-sale px-3 py-1.5 text-[13px] font-bold text-white hover:opacity-90 disabled:opacity-60"
                          >
                            Anonymise customer
                          </ConfirmButton>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <p className="mt-3 text-[12px] text-muted">
          Before anonymising, make sure the customer has no open orders or disputes. Order records are kept for tax and accounting; only the customer profile is
          cleared.
        </p>
      </section>

      <h2 className="mb-3 text-[18px] font-bold">Legal details</h2>
      {legal.updatedAt && (
        <p className="mb-4 text-[13px] text-muted">
          Last saved {fmtDate(legal.updatedAt)}
          {legal.updatedBy ? ` by ${legal.updatedBy}` : ""}.
        </p>
      )}
      {!legal.legalName && (
        <Card className="mb-6">
          <p className="text-[14px] text-ink-2">
            <b>Not set up yet.</b> The public pages currently use the store name ({settings.storeName}) and contact details from Settings. Add your registered
            business name, CAC number and DPO before launch.
          </p>
        </Card>
      )}
      <LegalForm legal={legal} storeName={settings.storeName} storeEmail={settings.email} />
    </>
  );
}
