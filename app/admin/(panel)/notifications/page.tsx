import type { Metadata } from "next";
import { Suspense } from "react";
import { requestNow } from "@/components/admin/core/clock";
import { AdminIcon } from "@/components/admin/core/icons";
import { MessageLogTable } from "@/components/admin/notifications/MessageLog";
import { NotifySettingsForm, TestEmailForm } from "@/components/admin/notifications/NotifyForms";
import { TemplatePreviews, type Preview } from "@/components/admin/notifications/TemplatePreviews";
import { FilterBar } from "@/components/admin/orders/FilterBar";
import { AdminPage, Card, EmptyState, PageHeader, StatCard } from "@/components/admin/ui";
import { can, requireAdmin } from "@/lib/auth";
import { emailEnabled, smsEnabled } from "@/lib/messaging";
import { EVENT_LABEL, type LogEvent, type NotifyLogEntry } from "@/lib/notify/events";
import { renderPreviews } from "@/lib/notify/orders";
import { getNotifySettings, listNotifyLog } from "@/lib/notify/store";
import { getSettings } from "@/lib/store";

export const metadata: Metadata = { title: "Notifications" };

const SHOWN = 200;
const EVENTS = Object.keys(EVENT_LABEL) as LogEvent[];

export default function NotificationsPage({ searchParams }: PageProps<"/admin/notifications">) {
  return (
    <AdminPage>
      <PageHeader title="Notifications" description="Emails and SMS customers get as their order moves along, and the new-order alert for the store." />
      <Suspense fallback={<NotificationsSkeleton />}>
        <NotificationsBody searchParams={searchParams} />
      </Suspense>
    </AdminPage>
  );
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function readFilters(sp: Record<string, string | string[] | undefined>) {
  const event = one(sp.event);
  const channel = one(sp.channel);
  const status = one(sp.status);
  return {
    q: one(sp.q).trim().slice(0, 80),
    event: (EVENTS as string[]).includes(event) ? (event as LogEvent) : "",
    channel: channel === "email" || channel === "sms" ? channel : "",
    status: status === "ok" || status === "skipped" || status === "error" ? status : "",
  };
}

async function NotificationsBody({ searchParams }: { searchParams: PageProps<"/admin/notifications">["searchParams"] }) {
  const session = await requireAdmin();
  const readOnly = !can(session.role, "settings:write");
  const [prefs, settings, log, previews, sp, now] = await Promise.all([getNotifySettings(), getSettings(), listNotifyLog(), renderPreviews(), searchParams, requestNow()]);
  const f = readFilters(sp);
  const q = f.q.toLowerCase();
  const rows = log.filter(
    (e) =>
      (!f.event || e.event === f.event) &&
      (!f.channel || e.channel === f.channel) &&
      (!f.status || e.status === f.status) &&
      (!q || e.orderId?.toLowerCase().includes(q) || e.to.toLowerCase().includes(q)),
  );

  const week = log.filter((e) => Date.parse(e.at) > now - 7 * 86_400_000);
  const by = (s: NotifyLogEntry["status"]) => week.filter((e) => e.status === s).length;
  const emailFrom = process.env.EMAIL_FROM?.trim();
  const filtered = !!(f.q || f.event || f.channel || f.status);
  const previewData: Preview[] = previews.map((p) => ({ event: p.event, label: p.label, subject: p.message.subject, html: p.message.html, sms: p.message.sms }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Email (Resend)" value={emailEnabled() ? "Connected" : "Not set up"} tone={emailEnabled() ? "good" : "warn"} hint={emailEnabled() ? "RESEND_API_KEY is set." : "Add RESEND_API_KEY to send email."} />
        <StatCard
          label="Sender address"
          value={emailFrom ? "Set" : "Default"}
          tone={emailFrom ? "good" : "warn"}
          hint={emailFrom ? <span className="break-all">{emailFrom}</span> : "EMAIL_FROM isn't set; Resend's test sender only reaches your own inbox."}
        />
        <StatCard
          label="SMS (Termii)"
          value={smsEnabled() ? "Connected" : "Not set up"}
          tone={smsEnabled() ? "good" : "warn"}
          hint={smsEnabled() ? `Sender ID: ${process.env.TERMII_SENDER_ID || "JDHub"}` : "Add TERMII_API_KEY to send SMS."}
        />
        <StatCard label="Last 7 days" value={by("ok").toLocaleString("en-NG")} tone={by("error") ? "bad" : "default"} hint={`sent · ${by("error")} failed · ${by("skipped")} skipped`} />
      </div>

      {readOnly && (
        <div role="note" className="flex items-start gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-[13px] text-ink-2">
          <AdminIcon name="lock" size={18} className="mt-0.5 shrink-0" />
          <p>
            <b className="text-ink">View only.</b> Only the owner or a manager can change notifications or send test emails.
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card title="What gets sent">
          <p className="mb-4 text-[13px] text-ink-2">Email goes to customers who gave an address at checkout. SMS goes to the order phone number once Termii is connected.</p>
          <NotifySettingsForm settings={prefs} readOnly={readOnly} />
        </Card>
        <Card title="Test email" className="self-start">
          <p className="mb-4 text-[13px] text-ink-2">Check that email is set up and lands in the inbox, not spam.</p>
          <TestEmailForm defaultTo={settings.email} disabled={readOnly} />
        </Card>
      </div>

      <Card title="Templates">
        <p className="mb-4 text-[13px] text-ink-2">Previews use a sample order with your current store settings (name, hubs, bank details).</p>
        <TemplatePreviews previews={previewData} />
      </Card>

      <section aria-labelledby="log-title" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="log-title" className="text-[16px] font-bold">
            Message log
          </h2>
          <p className="text-[13px] text-muted">
            {filtered ? `${rows.length.toLocaleString("en-NG")} of ` : ""}
            {log.length.toLocaleString("en-NG")} messages · the log keeps the latest 1,000
          </p>
        </div>
        <FilterBar
          action="/admin/notifications"
          q={f.q}
          placeholder="Search by order number or recipient"
          selects={[
            { name: "event", label: "Message", value: f.event, options: [{ value: "", label: "All messages" }, ...EVENTS.map((e) => ({ value: e, label: EVENT_LABEL[e] }))] },
            {
              name: "channel",
              label: "Channel",
              value: f.channel,
              options: [
                { value: "", label: "All channels" },
                { value: "email", label: "Email" },
                { value: "sms", label: "SMS" },
              ],
            },
            {
              name: "status",
              label: "Result",
              value: f.status,
              options: [
                { value: "", label: "Any result" },
                { value: "ok", label: "Sent" },
                { value: "error", label: "Failed" },
                { value: "skipped", label: "Skipped" },
              ],
            },
          ]}
        />
        {rows.length ? (
          <>
            <MessageLogTable entries={rows.slice(0, SHOWN)} now={now} />
            {rows.length > SHOWN && <p className="text-center text-[13px] text-muted">Showing the latest {SHOWN}. Narrow the filters to see older messages.</p>}
          </>
        ) : (
          <EmptyState
            title={filtered ? "No messages match" : "No messages yet"}
            body={filtered ? "Try another search or clear the filters." : "Order confirmations and updates appear here as they go out, including ones skipped because a provider isn't set up."}
          />
        )}
      </section>
    </div>
  );
}

function NotificationsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading notifications" className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[120px] animate-pulse rounded-2xl bg-white" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="h-[520px] animate-pulse rounded-2xl bg-white" />
        <div className="h-48 animate-pulse rounded-2xl bg-white" />
      </div>
    </div>
  );
}
