// Message log rows for /admin/notifications and the order page. Server component.

import Link from "next/link";
import { EVENT_LABEL, type DeliveryStatus, type NotifyLogEntry } from "@/lib/notify/events";
import { Badge, fmtDate, relTime, Table, type Tone } from "../ui";

export const DELIVERY_LABEL: Record<DeliveryStatus, string> = { ok: "Sent", skipped: "Skipped", error: "Failed" };
const DELIVERY_TONE: Record<DeliveryStatus, Tone> = { ok: "green", skipped: "neutral", error: "red" };

export function DeliveryBadge({ status }: { status: DeliveryStatus }) {
  return <Badge tone={DELIVERY_TONE[status]}>{DELIVERY_LABEL[status]}</Badge>;
}

export function MessageLogTable({ entries, now }: { entries: NotifyLogEntry[]; now: number }) {
  return (
    <Table>
      <thead>
        <tr>
          <th>When</th>
          <th>Message</th>
          <th>Order</th>
          <th>Channel</th>
          <th>To</th>
          <th>Result</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e, i) => (
          <tr key={`${e.at}-${i}`}>
            <td className="whitespace-nowrap">
              <time dateTime={e.at} title={fmtDate(e.at)} className="text-[13px] text-ink-2">
                {relTime(e.at, now)}
              </time>
            </td>
            <td>
              <p className="font-bold">{EVENT_LABEL[e.event] ?? e.event}</p>
              {e.by && <p className="text-[12px] text-muted">Resent by {e.by}</p>}
            </td>
            <td className="whitespace-nowrap">
              {e.orderId ? (
                <Link href={`/admin/orders/${encodeURIComponent(e.orderId)}`} className="font-bold hover:underline">
                  {e.orderId}
                </Link>
              ) : (
                <span className="text-muted">—</span>
              )}
            </td>
            <td>{e.channel === "email" ? "Email" : "SMS"}</td>
            <td className="whitespace-nowrap font-mono text-[12px]">{e.to}</td>
            <td>
              <DeliveryBadge status={e.status} />
              {e.status !== "ok" && e.detail && <p className="mt-1 max-w-xs break-words text-[12px] text-muted">{e.detail}</p>}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

/** Compact list for the order page sidebar. */
export function OrderMessageList({ entries, now }: { entries: NotifyLogEntry[]; now: number }) {
  if (!entries.length) return <p className="text-[13px] text-muted">No messages yet.</p>;
  return (
    <ul className="divide-y divide-line">
      {entries.map((e, i) => (
        <li key={`${e.at}-${i}`} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
          <div className="min-w-0 text-[13px]">
            <p className="font-bold">
              {EVENT_LABEL[e.event] ?? e.event} <span className="font-normal text-muted">· {e.channel === "email" ? "Email" : "SMS"}</span>
            </p>
            <p className="truncate font-mono text-[12px] text-muted">{e.to}</p>
            {e.status !== "ok" && e.detail && <p className="break-words text-[12px] text-muted">{e.detail}</p>}
            {e.by && <p className="text-[12px] text-muted">Resent by {e.by}</p>}
          </div>
          <div className="shrink-0 text-right">
            <DeliveryBadge status={e.status} />
            <time dateTime={e.at} title={fmtDate(e.at)} className="mt-1 block text-[11px] text-muted">
              {relTime(e.at, now)}
            </time>
          </div>
        </li>
      ))}
    </ul>
  );
}
