import type { Metadata } from "next";
import { FilterBar } from "@/components/admin/orders/FilterBar";
import { customerWaLink, humanizeKey, LEAD_STATUS_LABEL, LEAD_TYPE_LABEL, telHref } from "@/components/admin/orders/format";
import { LeadActions } from "@/components/admin/orders/LeadActions";
import { Avatar, IconLink, Pagination, TabNav } from "@/components/admin/orders/parts";
import { requestNow } from "@/components/admin/orders/server";
import { AdminPage, Badge, EmptyState, fmtDate, PageHeader, relTime, type Tone } from "@/components/admin/ui";
import { can, requireAdmin } from "@/lib/auth";
import { getSettings, listLeads } from "@/lib/store";
import type { Lead, LeadType } from "@/lib/types";

export const metadata: Metadata = { title: "Requests" };

const PER_PAGE = 20;
const STATUS_KEYS = ["new", "contacted", "closed", "all"] as const;
type StatusKey = (typeof STATUS_KEYS)[number];
const TYPE_KEYS = Object.keys(LEAD_TYPE_LABEL) as LeadType[];

const TYPE_TONE: Record<LeadType, Tone> = { sell: "green", swap: "purple", contact: "neutral", vendor: "blue" };
const STATUS_TONE: Record<Lead["status"], Tone> = { new: "amber", contacted: "blue", closed: "neutral" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Opening line for a WhatsApp reply, tailored to the request type. */
function replyText(l: Lead, store: string) {
  const name = l.name.split(/\s+/)[0] || "there";
  const what = l.details?.model ?? l.details?.device ?? l.details?.item;
  switch (l.type) {
    case "sell":
      return `Hi ${name}, this is ${store}. Thanks for your request to sell${what ? ` your ${what}` : ""}. When is a good time to inspect it?`;
    case "swap":
      return `Hi ${name}, this is ${store} about your swap request${what ? ` for your ${what}` : ""}. Let's get you a quote.`;
    case "vendor":
      return `Hi ${name}, this is ${store}. Thanks for your interest in selling on ${store}. Let's talk about your inventory.`;
    default:
      return `Hi ${name}, this is ${store}, replying to your message.`;
  }
}

export default async function RequestsPage({ searchParams }: PageProps<"/admin/requests">) {
  const session = await requireAdmin();
  const [leads, settings, sp] = await Promise.all([listLeads(), getSettings(), searchParams]);
  const now = await requestNow();
  const canWrite = can(session.role, "leads:write");

  const statusParam = first(sp.status);
  const status: StatusKey = (STATUS_KEYS as readonly string[]).includes(statusParam) ? (statusParam as StatusKey) : "new";
  const typeParam = first(sp.type);
  const type: LeadType | "all" = (TYPE_KEYS as string[]).includes(typeParam) ? (typeParam as LeadType) : "all";
  const q = first(sp.q).trim().slice(0, 80);
  const pageParam = Number.parseInt(first(sp.page) || "1", 10);

  const needle = q.toLowerCase();
  const digits = q.replace(/\D/g, "").replace(/^(234|0)/, "");
  const scoped = leads.filter(
    (l) =>
      (type === "all" || l.type === type) &&
      (!q ||
        l.name.toLowerCase().includes(needle) ||
        l.message.toLowerCase().includes(needle) ||
        !!l.email?.toLowerCase().includes(needle) ||
        Object.values(l.details ?? {}).some((v) => v.toLowerCase().includes(needle)) ||
        (digits.length >= 4 && l.phone.replace(/\D/g, "").includes(digits))),
  );
  const rows = scoped.filter((l) => status === "all" || l.status === status);
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.min(pageParam, pages) : 1;
  const visible = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const href = (patch: { status?: StatusKey; page?: number }) => {
    const u = new URLSearchParams();
    const s = patch.status ?? status;
    if (s !== "new") u.set("status", s);
    if (type !== "all") u.set("type", type);
    if (q) u.set("q", q);
    if (patch.page && patch.page > 1) u.set("page", String(patch.page));
    const str = u.toString();
    return `/admin/requests${str ? `?${str}` : ""}`;
  };

  const newCount = leads.filter((l) => l.status === "new").length;

  return (
    <AdminPage>
      <PageHeader
        title="Requests"
        description={newCount ? `${newCount} new request${newCount === 1 ? "" : "s"} waiting for a reply.` : "Sell, swap, vendor and contact requests from the store."}
      />

      <TabNav
        label="Request status"
        tabs={STATUS_KEYS.map((s) => ({
          href: href({ status: s }),
          label: s === "all" ? "All" : LEAD_STATUS_LABEL[s],
          count: scoped.filter((l) => s === "all" || l.status === s).length,
          active: s === status,
        }))}
      />

      <div className="mb-4">
        <FilterBar
          action="/admin/requests"
          q={q}
          placeholder="Search name, phone, message or device"
          hidden={{ status: status === "new" ? "" : status }}
          selects={[{ name: "type", label: "Request type", value: type, options: [{ value: "all", label: "All types" }, ...TYPE_KEYS.map((t) => ({ value: t, label: LEAD_TYPE_LABEL[t] }))] }]}
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={leads.length ? "Nothing here" : "No requests yet"}
          body={leads.length ? "No requests match this tab and filter." : "Sell, swap and contact forms on the store land here."}
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((l) => {
            const wa = customerWaLink(l.phone, replyText(l, settings.storeName));
            const details = Object.entries(l.details ?? {}).filter(([, v]) => v);
            return (
              <li key={l.id} className="rounded-2xl border border-line bg-white p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <Avatar name={l.name} />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-bold">{l.name}</span>
                        <Badge tone={TYPE_TONE[l.type]}>{LEAD_TYPE_LABEL[l.type]}</Badge>
                        <Badge tone={STATUS_TONE[l.status]}>{LEAD_STATUS_LABEL[l.status]}</Badge>
                      </p>
                      <p className="mt-0.5 text-[13px] text-muted">
                        {l.phone}
                        {l.email && <> · {l.email}</>} ·{" "}
                        <time dateTime={l.createdAt} title={fmtDate(l.createdAt)}>
                          {relTime(l.createdAt, now)}
                        </time>
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <IconLink href={telHref(l.phone)} label={`Call ${l.name}`} kind="phone" />
                    {l.email && <IconLink href={`mailto:${l.email}`} label={`Email ${l.name}`} kind="mail" />}
                    {wa && <IconLink href={wa} label={`Reply to ${l.name} on WhatsApp`} kind="wa" external />}
                  </div>
                </div>

                {l.message && <p className="mt-4 whitespace-pre-line break-words text-[14px] leading-relaxed text-ink-2">{l.message}</p>}

                {details.length > 0 && (
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-stage p-4 text-[13px] sm:grid-cols-3 lg:grid-cols-4">
                    {details.map(([k, v]) => (
                      <div key={k} className="min-w-0">
                        <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">{humanizeKey(k)}</dt>
                        <dd className="mt-0.5 break-words font-bold">{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                  <LeadActions id={l.id} name={l.name} status={l.status} canWrite={canWrite} />
                  {l.updatedAt !== l.createdAt && <p className="text-[12px] text-muted">Updated {relTime(l.updatedAt, now)}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination page={page} pages={pages} total={rows.length} perPage={PER_PAGE} href={(p) => href({ page: p })} />
    </AdminPage>
  );
}
