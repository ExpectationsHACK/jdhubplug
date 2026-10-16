"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Badge, Card } from "@/components/admin/ui";
import { Icon } from "@/components/Icon";
import { formatNaira } from "@/lib/reference";
import { toCsv } from "@/lib/csv";
import { CSV_COLUMNS, MAX_IMPORT_ROWS, templateRows, type ImportSummary } from "./csv-schema";
import { s } from "./styles";

// CSV import: upload or paste → server preview (creates, updates, errors by row) → apply.

const COLUMN_NOTES: [string, string][] = [
  ["id", "Existing id to update. Leave blank to create a new product."],
  ["name, brand", "Required for new products."],
  ["category", "phones, accessories, gadgets or cars."],
  ["grade", "like-new, great, good or fair."],
  ["price, was", "Whole naira. was (compare-at) must be higher than price."],
  ["stock", "Units available. 0 shows the product as sold out."],
  ["status", "active, draft or archived. New rows default to draft."],
  ["featured, verified", "true or false."],
  ["badge", "New, Best seller, Hot deal, Swap pick, or blank."],
  ["state", "Lagos, Abuja (FCT), Rivers, Oyo, Kano or Enugu."],
  ["photo, imageUrl", "Commons file name and/or an https image URL."],
  ["attrs", 'JSON like {"Storage":"256GB"} or Storage: 256GB; Colour: Black'],
];

const LIST_LIMIT = 100;

export function ImportPanel() {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [busy, setBusy] = useState<null | "preview" | "apply">(null);
  const [error, setError] = useState("");
  const [skip, setSkip] = useState(false);
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const step = summary?.applied ? 3 : summary ? 2 : 1;

  const readFile = async (f: File) => {
    setError("");
    if (f.size > 8 * 1024 * 1024) return setError("That file is over 8 MB. Split it into smaller files.");
    if (!/\.(csv|txt)$/i.test(f.name) && !/csv|text\/plain/.test(f.type)) return setError("Choose a .csv file.");
    setCsv(await f.text());
    setFileName(f.name);
    setSummary(null);
  };

  const send = async (apply: boolean) => {
    setBusy(apply ? "apply" : "preview");
    setError("");
    try {
      const res = await fetch("/api/admin/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, apply, skipInvalid: skip }),
      });
      const body = (await res.json().catch(() => null)) as (ImportSummary & { error?: string }) | null;
      if (!body) throw new Error(`The server answered ${res.status}.`);
      if ("total" in body) setSummary(body);
      if (!res.ok || body.error) setError(body.error ?? `The server answered ${res.status}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't reach the server. Check your connection.");
    } finally {
      setBusy(null);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([toCsv(templateRows(), { bom: true })], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "jdhub-products-template.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const reset = () => {
    setCsv("");
    setFileName("");
    setSummary(null);
    setError("");
    setSkip(false);
  };

  const changes = summary ? summary.creates.length + summary.updates.length : 0;
  const blocked = !!summary && summary.errors.length > 0 && !skip;

  return (
    <div className="space-y-6">
      <ol aria-label="Import steps" className="flex flex-wrap items-center gap-2 text-[13px] font-bold">
        {["Choose file", "Review", "Done"].map((label, i) => {
          const n = i + 1;
          const state = n < step ? "done" : n === step ? "current" : "todo";
          return (
            <li key={label} className="flex items-center gap-2" aria-current={state === "current" ? "step" : undefined}>
              {i > 0 && <span aria-hidden className={`h-px w-6 ${n <= step ? "bg-ink" : "bg-line"}`} />}
              <span
                className={`grid h-6 w-6 place-items-center rounded-full text-[12px] ${
                  state === "done" ? "bg-ok text-white" : state === "current" ? "bg-ink text-white" : "bg-line text-muted"
                }`}
              >
                {state === "done" ? <Icon name="check" size={14} strokeWidth={2.5} /> : n}
              </span>
              <span className={state === "todo" ? "text-muted" : ""}>{label}</span>
            </li>
          );
        })}
      </ol>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-2xl border border-[#f7b8cb] bg-[#fff5f8] px-4 py-3 text-[14px] font-bold text-sale">
          <Icon name="alert" size={18} className="mt-px shrink-0" /> {error}
        </div>
      )}

      {step === 1 && (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card title="Your CSV">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) void readFile(f);
              }}
              className={`flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line bg-stage/60 px-4 py-8 text-center transition-colors ${over ? s.dropActive : ""}`}
            >
              <span className="grid h-12 w-12 place-items-center rounded-full bg-white">
                <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z" />
                  <path d="M14 3.5V8h4.5M9 13h6M9 16.5h6" />
                </svg>
              </span>
              {fileName ? (
                <p className="text-[14px] font-bold">
                  {fileName} <span className="font-normal text-muted">· {csv.split(/\r?\n/).filter(Boolean).length - 1} rows</span>
                </p>
              ) : (
                <>
                  <p className="text-[14px] font-bold">Drop a .csv file here</p>
                  <p className="text-[12px] text-muted">Up to {MAX_IMPORT_ROWS.toLocaleString("en-NG")} rows. Excel and Google Sheets exports work.</p>
                </>
              )}
              <button type="button" onClick={() => fileRef.current?.click()} className="btn btn-outline mt-1 min-h-9! px-5! py-2! text-[13px]!">
                {fileName ? "Choose another file" : "Choose file"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                tabIndex={-1}
                aria-label="Choose a CSV file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void readFile(f);
                  e.target.value = "";
                }}
              />
            </div>

            <label className="mt-5 block">
              <span className="mb-1.5 block text-[13px] font-bold text-ink-2">Or paste CSV</span>
              <textarea
                value={csv}
                onChange={(e) => {
                  setCsv(e.target.value);
                  setFileName("");
                }}
                rows={8}
                spellCheck={false}
                placeholder={`${CSV_COLUMNS.slice(0, 8).join(",")},…`}
                className="w-full rounded-xl border border-line bg-white px-3 py-2.5 font-mono text-[12px] outline-none transition focus:border-transparent focus:ring-2 focus:ring-accent"
              />
            </label>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              {csv && (
                <button type="button" onClick={reset} className="btn btn-outline">
                  Clear
                </button>
              )}
              <button type="button" onClick={() => send(false)} disabled={!csv.trim() || busy !== null} className="btn btn-primary">
                {busy === "preview" ? "Checking…" : "Preview import"}
              </button>
            </div>
          </Card>

          <Card title="Format">
            <p className="text-[13px] text-ink-2">
              Rows with an <b>id</b> update that product; rows without one create a new product. Only the columns you include change, so a file with just <code>id,price</code> updates prices.
            </p>
            <dl className="mt-4 space-y-2.5 text-[12px]">
              {COLUMN_NOTES.map(([k, v]) => (
                <div key={k}>
                  <dt className="font-mono font-bold text-ink">{k}</dt>
                  <dd className="text-muted">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={downloadTemplate} className="btn btn-outline min-h-9! px-4! py-2! text-[13px]!">
                Download template
              </button>
              <a href="/api/admin/products/export" download className="btn btn-outline min-h-9! px-4! py-2! text-[13px]!">
                Export catalog
              </a>
            </div>
          </Card>
        </div>
      )}

      {step === 2 && summary && (
        <>
          <div className={`${s.rise} grid grid-cols-2 gap-3 md:grid-cols-4`}>
            <Stat label="New products" value={summary.creates.length} tone="green" />
            <Stat label="Updates" value={summary.updates.length} tone="blue" />
            <Stat label="Unchanged" value={summary.unchanged} tone="neutral" />
            <Stat label="Rows with errors" value={summary.errors.length} tone={summary.errors.length ? "red" : "neutral"} />
          </div>

          {summary.warnings.length > 0 && (
            <ul className="space-y-1 rounded-2xl bg-[#fff8eb] px-4 py-3 text-[13px] text-[#7a4b00]">
              {summary.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}

          {summary.errors.length > 0 && (
            <PreviewTable title={`Errors (${summary.errors.length})`} tone="red" head={["Row", "Problem"]} rows={summary.errors.map((e) => [e.row, e.message])} />
          )}
          {summary.creates.length > 0 && (
            <PreviewTable
              title={`New products (${summary.creates.length})`}
              tone="green"
              head={["Row", "Product", "Category", "Price", "Stock", "Status"]}
              rows={summary.creates.map((c) => [
                c.row,
                <span key="n">
                  <b>{c.name}</b>
                  <span className="block font-mono text-[11px] text-muted">{c.id}</span>
                </span>,
                c.category,
                formatNaira(c.price),
                c.stock,
                c.status,
              ])}
            />
          )}
          {summary.updates.length > 0 && (
            <PreviewTable
              title={`Updates (${summary.updates.length})`}
              tone="blue"
              head={["Row", "Product", "Changes"]}
              rows={summary.updates.map((u) => [
                u.row,
                <span key="n">
                  <b>{u.name}</b>
                  <span className="block font-mono text-[11px] text-muted">{u.id}</span>
                </span>,
                <ul key="c" className="space-y-0.5 text-[12px] text-ink-2">
                  {u.changes.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>,
              ])}
            />
          )}

          <div className="sticky bottom-0 z-20 -mx-4 flex flex-wrap items-center gap-3 border-t border-line bg-white/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
            <button type="button" onClick={() => setSummary(null)} className="btn btn-outline">
              Back
            </button>
            {summary.errors.length > 0 && (
              <label className="flex items-center gap-2 text-[13px] font-bold">
                <input type="checkbox" checked={skip} onChange={(e) => setSkip(e.target.checked)} className="h-4 w-4 accent-ink" />
                Skip {summary.errors.length} {summary.errors.length === 1 ? "row" : "rows"} with errors
              </label>
            )}
            <button type="button" onClick={() => send(true)} disabled={!changes || blocked || busy !== null} className="btn btn-primary ml-auto">
              {busy === "apply" ? "Importing…" : changes ? `Import ${changes} ${changes === 1 ? "change" : "changes"}` : "Nothing to import"}
            </button>
          </div>
        </>
      )}

      {step === 3 && summary?.applied && (
        <div className={`${s.rise} rounded-2xl border border-line bg-white px-6 py-12 text-center`}>
          <span className={`${s.checkIn} mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#e6f6ee] text-ok`}>
            <Icon name="check" size={32} strokeWidth={2} />
          </span>
          <h2 className="display mt-5 text-[24px]">Import complete.</h2>
          <p className="mt-2 text-[14px] text-ink-2">
            {summary.applied.created} created · {summary.applied.updated} updated
            {summary.applied.skipped ? ` · ${summary.applied.skipped} ${summary.applied.skipped === 1 ? "row" : "rows"} skipped` : ""}. The store is already showing the changes.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <button type="button" onClick={reset} className="btn btn-outline">
              Import another
            </button>
            <Link href="/admin/products" className="btn btn-primary">
              View products
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "green" | "blue" | "neutral" | "red" }) {
  const cls = { green: "text-ok", blue: "text-accent", neutral: "text-ink", red: "text-sale" }[tone];
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-[12px] font-bold text-muted">{label}</p>
      <p className={`display mt-1 text-[26px] tabular-nums ${cls}`}>{value}</p>
    </div>
  );
}

function PreviewTable({ title, tone, head, rows }: { title: string; tone: "green" | "blue" | "red"; head: string[]; rows: React.ReactNode[][] }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, LIST_LIMIT);
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="text-[15px] font-bold">{title}</h2>
        <Badge tone={tone}>{tone === "red" ? "Won't import" : tone === "green" ? "Create" : "Update"}</Badge>
      </div>
      <div className="relative max-h-[480px] overflow-auto">
        <table className="adm-table w-full min-w-[560px] text-left text-[13px]">
          <thead className="sticky top-0 bg-white">
            <tr>
              {head.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j} className={j === 0 ? "w-16 tabular-nums text-muted" : ""}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > LIST_LIMIT && (
        <button type="button" onClick={() => setAll((v) => !v)} className="w-full border-t border-line px-4 py-2.5 text-[13px] font-bold hover:bg-stage">
          {all ? "Show fewer" : `Show all ${rows.length}`}
        </button>
      )}
    </section>
  );
}
