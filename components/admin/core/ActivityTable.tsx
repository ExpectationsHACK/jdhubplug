"use client";

import { useDeferredValue, useEffect, useId, useMemo, useState } from "react";
import type { AuditEntry } from "@/lib/types";
import { Badge, selectCls, type Tone } from "../ui";
import { ago, fmtWhen } from "./format";
import { AdminIcon } from "./icons";

// Activity log browser: search, filter by action type and person, relative times that
// stay fresh, paging, and CSV export of whatever is currently filtered.

const GROUPS: Record<string, { label: string; tone: Tone }> = {
  order: { label: "Orders", tone: "blue" },
  orders: { label: "Orders", tone: "blue" },
  product: { label: "Products", tone: "purple" },
  products: { label: "Products", tone: "purple" },
  inventory: { label: "Inventory", tone: "purple" },
  stock: { label: "Inventory", tone: "purple" },
  offer: { label: "Offers", tone: "green" },
  offers: { label: "Offers", tone: "green" },
  lead: { label: "Requests", tone: "amber" },
  leads: { label: "Requests", tone: "amber" },
  request: { label: "Requests", tone: "amber" },
  customer: { label: "Customers", tone: "amber" },
  settings: { label: "Settings", tone: "neutral" },
  staff: { label: "Staff", tone: "neutral" },
  auth: { label: "Sign-ins", tone: "neutral" },
  backup: { label: "Data", tone: "red" },
  catalog: { label: "Data", tone: "red" },
  cron: { label: "System", tone: "neutral" },
};

const groupOf = (action: string) => {
  const key = action.split(".")[0] ?? action;
  return GROUPS[key] ?? { label: key ? key[0].toUpperCase() + key.slice(1) : "Other", tone: "neutral" as Tone };
};

/** "order.paid" → "Paid", "staff.password_reset" → "Password reset". */
const actionLabel = (action: string) => {
  const rest = action.includes(".") ? action.slice(action.indexOf(".") + 1) : action;
  const words = rest.replace(/[._-]+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : action;
};

const PAGE = 100;

function toCsv(rows: AuditEntry[]) {
  const cell = (v: string | undefined) => {
    let s = v ?? "";
    // Neutralise spreadsheet formulas.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const head = ["Time (ISO)", "Who", "Action", "Target", "Detail"].map(cell).join(",");
  return [head, ...rows.map((r) => [r.at, r.by, r.action, r.target, r.detail].map(cell).join(","))].join("\r\n");
}

export function ActivityTable({ entries, now: serverNow }: { entries: AuditEntry[]; now: number }) {
  const [now, setNow] = useState(serverNow);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const [who, setWho] = useState("all");
  const [limit, setLimit] = useState(PAGE);
  const q = useDeferredValue(query.trim().toLowerCase());
  const searchId = useId();

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const groups = useMemo(() => [...new Set(entries.map((e) => groupOf(e.action).label))].sort(), [entries]);
  const people = useMemo(() => [...new Set(entries.map((e) => e.by))].sort(), [entries]);

  const filtered = useMemo(
    () =>
      entries.filter((e) => {
        if (group !== "all" && groupOf(e.action).label !== group) return false;
        if (who !== "all" && e.by !== who) return false;
        if (!q) return true;
        return `${e.by} ${e.action} ${actionLabel(e.action)} ${e.target ?? ""} ${e.detail ?? ""}`.toLowerCase().includes(q);
      }),
    [entries, group, who, q],
  );
  const shown = filtered.slice(0, limit);
  const filteredOn = !!q || group !== "all" || who !== "all";

  const exportCsv = () => {
    const blob = new Blob([`﻿${toCsv(filtered)}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jdhub-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center">
        <div className="relative md:max-w-sm md:flex-1">
          <label htmlFor={searchId} className="sr-only">
            Search activity
          </label>
          <AdminIcon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
            placeholder="Search people, actions, orders, products…"
            className="w-full rounded-xl border border-line bg-white py-2.5 pl-9 pr-3 text-[14px] outline-none transition focus:border-transparent focus:ring-2 focus:ring-accent"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 md:flex">
          <select
            aria-label="Filter by type"
            value={group}
            onChange={(e) => {
              setGroup(e.target.value);
              setLimit(PAGE);
            }}
            className={`${selectCls} md:w-44`}
          >
            <option value="all">All types</option>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by person"
            value={who}
            onChange={(e) => {
              setWho(e.target.value);
              setLimit(PAGE);
            }}
            className={`${selectCls} md:w-52`}
          >
            <option value="all">Everyone</option>
            {people.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3 md:ml-auto">
          <p className="text-[13px] text-muted" aria-live="polite">
            {filteredOn ? `${filtered.length} of ${entries.length}` : `${entries.length}`} entr{(filteredOn ? filtered.length : entries.length) === 1 ? "y" : "ies"}
          </p>
          <button
            type="button"
            onClick={exportCsv}
            disabled={!filtered.length}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-2 text-[13px] font-bold outline-none transition-colors hover:border-ink focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          >
            <AdminIcon name="download" size={15} />
            Export CSV
          </button>
        </div>
      </div>

      {!shown.length ? (
        <div className="rounded-2xl border border-dashed border-line bg-white px-6 py-14 text-center">
          <p className="text-[16px] font-bold">{entries.length ? "Nothing matches those filters" : "No activity yet"}</p>
          <p className="mx-auto mt-1 max-w-md text-[14px] text-ink-2">
            {entries.length ? "Try a different search or clear the filters." : "Sign-ins, edits, orders and settings changes will be recorded here."}
          </p>
          {filteredOn && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setGroup("all");
                setWho("all");
              }}
              className="btn btn-outline mt-5"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Phones: stacked rows. */}
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white md:hidden">
            {shown.map((e, i) => {
              const g = groupOf(e.action);
              return (
                <li key={`${e.at}-${i}`} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <Badge tone={g.tone}>{g.label}</Badge>
                      <span className="truncate text-[14px] font-bold">{actionLabel(e.action)}</span>
                    </span>
                    <time dateTime={e.at} title={fmtWhen(e.at)} className="shrink-0 text-[12px] text-muted">
                      {ago(e.at, now)}
                    </time>
                  </div>
                  {(e.target || e.detail) && (
                    <p className="mt-1 break-words text-[13px] text-ink-2">
                      {e.target && <span className="font-bold text-ink">{e.target}</span>}
                      {e.target && e.detail && " · "}
                      {e.detail}
                    </p>
                  )}
                  <p className="mt-1 text-[12px] text-muted">{e.by}</p>
                </li>
              );
            })}
          </ul>

          {/* Larger screens: table. */}
          <div className="hidden overflow-x-auto rounded-2xl border border-line bg-white md:block">
            <table className="adm-table w-full text-left text-[14px]">
              <caption className="sr-only">Activity log</caption>
              <thead>
                <tr>
                  <th scope="col" className="w-32">
                    When
                  </th>
                  <th scope="col">Who</th>
                  <th scope="col">Action</th>
                  <th scope="col">Target</th>
                  <th scope="col">Detail</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((e, i) => {
                  const g = groupOf(e.action);
                  return (
                    <tr key={`${e.at}-${i}`}>
                      <td className="whitespace-nowrap text-ink-2">
                        <time dateTime={e.at} title={fmtWhen(e.at)}>
                          {ago(e.at, now)}
                        </time>
                      </td>
                      <td className="max-w-[200px] truncate">{e.by}</td>
                      <td className="whitespace-nowrap">
                        <span className="flex items-center gap-2">
                          <Badge tone={g.tone}>{g.label}</Badge>
                          <span className="font-bold">{actionLabel(e.action)}</span>
                        </span>
                      </td>
                      <td className="max-w-[180px] truncate font-bold">{e.target ?? <span className="font-normal text-muted">—</span>}</td>
                      <td className="max-w-[360px] break-words text-[13px] text-ink-2">{e.detail ?? <span className="text-muted">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filtered.length > shown.length && (
            <div className="mt-4 text-center">
              <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="btn btn-outline">
                Show {Math.min(PAGE, filtered.length - shown.length)} more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
