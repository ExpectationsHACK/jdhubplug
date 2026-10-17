"use client";

import { useRouter } from "next/navigation";
import { useActionState, useId, useRef, useState } from "react";
import { resetCatalogAction, signOutEveryoneAction, type ResetState } from "@/app/admin/(panel)/settings/data/actions";
import { fieldCls } from "./form-bits";
import { AdminIcon } from "./icons";

// Owner-only data tools: download a backup, restore one (validated on the server with a
// dry run first), and reset the catalog to the seed.

type Counts = { products: number; orders: number; offers: number; leads: number };

type Plan = {
  products: { add: number; update: number; remove: number };
  offers: { add: number; update: number } | null;
  leads: { add: number; update: number } | null;
  settings: boolean;
  ordersSkipped: number;
  exportedAt: string;
  exportedBy: string;
};

type Options = { replaceCatalog: boolean; settings: boolean; offers: boolean; leads: boolean };

const MAX_BYTES = 4 * 1024 * 1024;

const fmtWhen = (iso: string) =>
  iso ? new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "an unknown date";

export function BackupCard({ counts }: { counts: Counts }) {
  return (
    <Box
      icon="download"
      title="Download a backup"
      description="A complete JSON copy of your store: products with stock, orders, offers and their stats, requests and settings. Staff passwords are never included."
    >
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            ["Products", counts.products],
            ["Orders", counts.orders],
            ["Offers", counts.offers],
            ["Requests", counts.leads],
          ] as const
        ).map(([label, n]) => (
          <div key={label} className="rounded-xl bg-stage px-3 py-2.5">
            <dt className="text-[12px] font-bold text-muted">{label}</dt>
            <dd className="display text-[20px]">{n.toLocaleString("en-NG")}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <a href="/api/admin/backup" download className="btn btn-primary">
          <AdminIcon name="download" size={16} />
          Download backup
        </a>
        <p className="text-[12px] text-muted">Backups contain customer names and phone numbers. Store them somewhere private.</p>
      </div>
    </Box>
  );
}

export function RestoreCard() {
  const router = useRouter();
  const inputId = useId();
  const backup = useRef<unknown>(null);
  const [file, setFile] = useState<{ name: string; size: number; counts: Counts; exportedAt: string } | null>(null);
  const [options, setOptions] = useState<Options>({ replaceCatalog: false, settings: true, offers: true, leads: true });
  const [plan, setPlan] = useState<Plan | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"check" | "restore" | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [done, setDone] = useState<Plan | null>(null);

  async function send(dryRun: boolean, opts: Options) {
    setBusy(dryRun ? "check" : "restore");
    setError("");
    setProblems([]);
    try {
      const res = await fetch("/api/admin/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ options: { ...opts, dryRun }, backup: backup.current }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; plan?: Plan; error?: string; problems?: string[] };
      if (!res.ok || !body.plan) {
        setPlan(null);
        setError(body.error ?? `Something went wrong (${res.status}).`);
        setProblems(body.problems ?? []);
        return;
      }
      if (dryRun) setPlan(body.plan);
      else {
        setDone(body.plan);
        setPlan(null);
        setFile(null);
        setConfirmed(false);
        backup.current = null;
        router.refresh();
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function onFile(f: File | undefined) {
    setPlan(null);
    setProblems([]);
    setError("");
    setDone(null);
    setConfirmed(false);
    setFile(null);
    backup.current = null;
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setError("That file is larger than 4 MB, which is more than the server accepts in one upload.");
      return;
    }
    let data: unknown;
    try {
      data = JSON.parse(await f.text());
    } catch {
      setError("That file isn't valid JSON. Pick a backup downloaded from this page.");
      return;
    }
    const d = data as { format?: unknown; exportedAt?: unknown; products?: unknown; orders?: unknown; offers?: unknown; leads?: unknown };
    if (!d || d.format !== "jdhub-backup") {
      setError("This doesn't look like a JDHub backup file.");
      return;
    }
    const len = (v: unknown) => (Array.isArray(v) ? v.length : 0);
    backup.current = data;
    setFile({
      name: f.name,
      size: f.size,
      exportedAt: typeof d.exportedAt === "string" ? d.exportedAt : "",
      counts: { products: len(d.products), orders: len(d.orders), offers: len(d.offers), leads: len(d.leads) },
    });
    await send(true, options);
  }

  const changeOption = (patch: Partial<Options>) => {
    const next = { ...options, ...patch };
    setOptions(next);
    setConfirmed(false);
    if (backup.current) void send(true, next);
  };

  return (
    <Box
      icon="upload"
      title="Restore from a backup"
      description="Bring back products, stock, offers, requests and settings from a backup file. Orders stay as they are, so live payments and reservations are never overwritten."
    >
      {done && (
        <div role="status" className="mb-4 flex items-start gap-3 rounded-xl border border-[#bfe6d1] bg-[#effaf4] px-4 py-3 text-[13px] text-[#075e33]">
          <AdminIcon name="check" size={18} strokeWidth={2} className="mt-0.5 shrink-0" />
          <p>
            <b>Restore complete.</b> {done.products.add + done.products.update} products written
            {done.products.remove ? `, ${done.products.remove} removed` : ""}
            {done.offers ? `, ${done.offers.add + done.offers.update} offers` : ""}
            {done.leads ? `, ${done.leads.add + done.leads.update} requests` : ""}
            {done.settings ? ", settings restored" : ""}. The storefront is refreshed.
          </p>
        </div>
      )}

      <label
        htmlFor={inputId}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#bdbdbd] bg-[#fbfbfc] px-4 py-7 text-center transition-colors hover:border-ink focus-within:ring-2 focus-within:ring-accent"
      >
        <span className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm">
          <AdminIcon name="upload" size={18} />
        </span>
        <span className="text-[14px] font-bold">{file ? file.name : "Choose a backup file"}</span>
        <span className="text-[12px] text-muted">
          {file ? `${Math.max(1, Math.round(file.size / 1024))} KB · exported ${fmtWhen(file.exportedAt)}` : "JSON, up to 4 MB"}
        </span>
        <input
          id={inputId}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>

      {error && (
        <div role="alert" className="mt-4 rounded-xl bg-[#fde8ef] px-4 py-3 text-[13px] text-sale">
          <p className="font-bold">{error}</p>
          {!!problems.length && (
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
              {problems.map((p) => (
                <li key={p} className="break-words">
                  {p}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Options and the server's dry-run plan, once the file has passed validation. */}
      {file && (plan || busy === "check") && (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="min-w-0">
            <fieldset>
              <legend className="mb-2 text-[13px] font-bold text-ink-2">Catalog</legend>
              <div className="flex flex-col gap-2">
                <Radio
                  name="catalogMode"
                  checked={!options.replaceCatalog}
                  onChange={() => changeOption({ replaceCatalog: false })}
                  label="Merge"
                  body="Update products that are in the backup, keep everything else."
                />
                <Radio
                  name="catalogMode"
                  checked={options.replaceCatalog}
                  onChange={() => changeOption({ replaceCatalog: true })}
                  label="Replace"
                  body="Make the catalog match the backup exactly. Products not in it are removed."
                />
              </div>
            </fieldset>
            <fieldset className="mt-4">
              <legend className="mb-2 text-[13px] font-bold text-ink-2">Also restore</legend>
              <div className="flex flex-col gap-1.5">
                <Check checked={options.settings} onChange={(v) => changeOption({ settings: v })} label="Store settings" />
                <Check checked={options.offers} onChange={(v) => changeOption({ offers: v })} label={`Offers and their stats (${file.counts.offers})`} />
                <Check checked={options.leads} onChange={(v) => changeOption({ leads: v })} label={`Requests (${file.counts.leads})`} />
              </div>
            </fieldset>
          </div>

          <div className="min-w-0 rounded-xl bg-stage p-4" aria-live="polite" aria-busy={busy === "check"}>
            <p className="text-[13px] font-bold text-ink-2">What will change</p>
            {busy === "check" && !plan && <p className="mt-2 text-[13px] text-muted">Checking the backup…</p>}
            {plan && (
              <ul className={`mt-2 space-y-1.5 text-[13px] ${busy === "check" ? "opacity-50" : ""}`}>
                <PlanRow label="Products" add={plan.products.add} update={plan.products.update} remove={plan.products.remove} />
                {plan.offers && <PlanRow label="Offers" add={plan.offers.add} update={plan.offers.update} />}
                {plan.leads && <PlanRow label="Requests" add={plan.leads.add} update={plan.leads.update} />}
                <li className="flex justify-between gap-3">
                  <span>Settings</span>
                  <span className="font-bold">{plan.settings ? "Replaced" : "Unchanged"}</span>
                </li>
                {plan.ordersSkipped > 0 && (
                  <li className="pt-1 text-[12px] text-muted">{plan.ordersSkipped} orders in the file are kept for your records and not restored.</li>
                )}
              </ul>
            )}
          </div>
        </div>
      )}

      {file && plan && (
        <div className="mt-5 border-t border-line pt-4">
          <label className="flex items-start gap-3 text-[13px]">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--ink)]"
            />
            <span>
              I understand this overwrites current product details and stock levels{options.replaceCatalog ? " and removes products that aren't in the backup" : ""}. Download a fresh
              backup first if you might need today&apos;s data.
            </span>
          </label>
          <button type="button" onClick={() => void send(false, options)} disabled={!confirmed || !!busy} className="btn btn-primary mt-4">
            {busy === "restore" ? "Restoring…" : "Restore now"}
          </button>
        </div>
      )}
    </Box>
  );
}

export function ResetCard() {
  const [state, action, pending] = useActionState<ResetState, FormData>(resetCatalogAction, {});
  const [typed, setTyped] = useState("");
  const id = useId();
  return (
    <Box
      icon="trash"
      tone="danger"
      title="Reset catalog to the seed"
      description="Deletes every product and writes the original seed catalog with its starting stock. Orders, offers, requests and settings are kept. This can't be undone."
    >
      <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor={id} className="mb-1.5 block text-[13px] font-bold text-ink-2">
            Type <span className="font-mono">RESET</span> to confirm
          </label>
          <input
            id={id}
            name="confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className={`${fieldCls()} font-mono`}
          />
        </div>
        <button
          disabled={typed !== "RESET" || pending}
          className="btn min-h-[46px] border-sale bg-sale text-white hover:bg-[#c00040] disabled:border-transparent"
        >
          {pending ? "Resetting…" : "Reset catalog"}
        </button>
      </form>
      {state.message && (
        <p role={state.ok ? "status" : "alert"} className={`mt-3 text-[13px] font-bold ${state.ok ? "text-ok" : "text-sale"}`}>
          {state.message}
        </p>
      )}
    </Box>
  );
}

export function SignOutEveryoneCard() {
  const [state, action, pending] = useActionState<ResetState, FormData>(signOutEveryoneAction, {});
  const [typed, setTyped] = useState("");
  const id = useId();
  return (
    <Box
      icon="lock"
      tone="danger"
      title="Sign out everyone"
      description="Ends every admin and shopper session on every device, including yours. Use it if a password or device may be compromised. Accounts and data are not changed."
    >
      {state.ok ? (
        <p role="status" className="text-[13px] font-bold text-ok">
          {state.message}{" "}
          <a href="/admin/login" className="underline underline-offset-2">
            Sign in again
          </a>
        </p>
      ) : (
        <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor={id} className="mb-1.5 block text-[13px] font-bold text-ink-2">
              Type <span className="font-mono">SIGN OUT</span> to confirm
            </label>
            <input id={id} name="confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} className={`${fieldCls()} font-mono`} />
          </div>
          <button
            disabled={typed !== "SIGN OUT" || pending}
            className="btn min-h-[46px] border-sale bg-sale text-white hover:bg-[#c00040] disabled:border-transparent"
          >
            {pending ? "Signing out…" : "Sign out everyone"}
          </button>
        </form>
      )}
      {state.message && !state.ok && (
        <p role="alert" className="mt-3 text-[13px] font-bold text-sale">
          {state.message}
        </p>
      )}
    </Box>
  );
}

function Box({
  icon,
  title,
  description,
  children,
  tone,
}: {
  icon: React.ComponentProps<typeof AdminIcon>["name"];
  title: string;
  description: string;
  children: React.ReactNode;
  tone?: "danger";
}) {
  return (
    <section className={`rounded-2xl border bg-white p-4 md:p-6 ${tone === "danger" ? "border-[#f3b6c9]" : "border-line"}`}>
      <div className="mb-4 flex items-start gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${tone === "danger" ? "bg-[#fde8ef] text-sale" : "bg-stage"}`}>
          <AdminIcon name={icon} size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="text-[16px] font-bold">{title}</h2>
          <p className="mt-0.5 text-[13px] text-ink-2">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Radio({ name, checked, onChange, label, body }: { name: string; checked: boolean; onChange: () => void; label: string; body: string }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${checked ? "border-ink" : "border-line hover:border-[#bbb]"}`}>
      <input type="radio" name={name} checked={checked} onChange={onChange} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--ink)]" />
      <span>
        <span className="block text-[14px] font-bold">{label}</span>
        <span className="block text-[12px] text-muted">{body}</span>
      </span>
    </label>
  );
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-[14px]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[var(--ink)]" />
      {label}
    </label>
  );
}

function PlanRow({ label, add, update, remove }: { label: string; add: number; update: number; remove?: number }) {
  return (
    <li className="flex justify-between gap-3">
      <span>{label}</span>
      <span className="text-right tabular-nums">
        <b className={add ? "text-ok" : "text-muted"}>{add} new</b>
        <span className="text-muted"> · </span>
        <b className="text-ink">{update} updated</b>
        {remove !== undefined && (
          <>
            <span className="text-muted"> · </span>
            <b className={remove ? "text-sale" : "text-muted"}>{remove} removed</b>
          </>
        )}
      </span>
    </li>
  );
}
