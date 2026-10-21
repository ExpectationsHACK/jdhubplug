"use client";

import { useRef, useState } from "react";
import type { Hub } from "@/lib/types";
import { fieldCls } from "./form-bits";
import { AdminIcon } from "./icons";
import { LIMITS, type SettingsErrors } from "./settings-schema";

type Row = Hub & { key: number };

/** Editable list of pickup hubs. Rows submit as repeated hub_city / hub_address / hub_hours fields. */
export function HubsEditor({ initial, errors, disabled, onChange }: { initial: Hub[]; errors?: SettingsErrors; disabled?: boolean; onChange?: () => void }) {
  const seq = useRef(initial.length);
  const [rows, setRows] = useState<Row[]>(() => initial.map((h, i) => ({ ...h, key: i })));
  const lastCity = useRef<HTMLInputElement | null>(null);

  const update = (key: number, patch: Partial<Hub>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    onChange?.();
  };
  const add = () => {
    setRows((rs) => [...rs, { key: ++seq.current, city: "", address: "", hours: "Mon–Sat, 9am–6pm" }]);
    onChange?.();
    requestAnimationFrame(() => lastCity.current?.focus());
  };
  const remove = (key: number) => {
    setRows((rs) => rs.filter((r) => r.key !== key));
    onChange?.();
  };
  const move = (idx: number, dir: -1 | 1) => {
    setRows((rs) => {
      const next = [...rs];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return rs;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
    onChange?.();
  };

  return (
    <div>
      {errors?.hubs && (
        <p role="alert" className="mb-3 text-[12px] font-bold text-sale">
          {errors.hubs}
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {rows.map((r, i) => {
          const err = (f: string) => errors?.[`hub.${i}.${f}`];
          const last = i === rows.length - 1;
          return (
            <li key={r.key} className="rounded-xl border border-line bg-[#fbfbfc] p-3 md:p-4">
              <fieldset disabled={disabled}>
                <legend className="sr-only">Hub {i + 1}</legend>
                <div className="grid gap-3 md:grid-cols-[1fr_1.5fr_1.4fr_auto] md:items-end">
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-bold text-ink-2">City</span>
                    <input
                      ref={last ? lastCity : undefined}
                      name="hub_city"
                      value={r.city}
                      onChange={(e) => update(r.key, { city: e.target.value })}
                      maxLength={40}
                      placeholder="Lagos"
                      aria-invalid={err("city") ? true : undefined}
                      className={fieldCls(err("city"))}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-bold text-ink-2">Address</span>
                    <input
                      name="hub_address"
                      value={r.address}
                      onChange={(e) => update(r.key, { address: e.target.value })}
                      maxLength={160}
                      placeholder="Computer Village, Ikeja"
                      aria-invalid={err("address") ? true : undefined}
                      className={fieldCls(err("address"))}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-bold text-ink-2">Opening hours</span>
                    <input
                      name="hub_hours"
                      value={r.hours}
                      onChange={(e) => update(r.key, { hours: e.target.value })}
                      maxLength={80}
                      placeholder="Mon–Sat, 9am–6pm"
                      aria-invalid={err("hours") ? true : undefined}
                      className={fieldCls(err("hours"))}
                    />
                  </label>
                  {!disabled && (
                    <div className="flex items-center gap-1 md:pb-1">
                      <IconBtn label={`Move hub ${i + 1} up`} icon="arrowUp" onClick={() => move(i, -1)} disabled={i === 0} />
                      <IconBtn label={`Move hub ${i + 1} down`} icon="arrowDown" onClick={() => move(i, 1)} disabled={last} />
                      <IconBtn label={`Remove hub ${r.city || i + 1}`} icon="trash" onClick={() => remove(r.key)} disabled={rows.length <= 1} danger />
                    </div>
                  )}
                </div>
                {(err("city") || err("address") || err("hours")) && (
                  <p className="mt-2 text-[12px] font-bold text-sale">{err("city") ?? err("address") ?? err("hours")}</p>
                )}
              </fieldset>
            </li>
          );
        })}
      </ul>
      {!disabled && (
        <button
          type="button"
          onClick={add}
          disabled={rows.length >= LIMITS.hubs}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-dashed border-[#bdbdbd] px-4 py-2 text-[13px] font-bold text-ink-2 outline-none transition-colors hover:border-ink hover:text-ink focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
        >
          <AdminIcon name="plus" size={15} />
          Add hub
        </button>
      )}
    </div>
  );
}

export function IconBtn({
  label,
  icon,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  icon: React.ComponentProps<typeof AdminIcon>["name"];
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid h-9 w-9 place-items-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-30 ${
        danger ? "text-ink-2 hover:bg-[#fde8ef] hover:text-sale" : "text-ink-2 hover:bg-stage hover:text-ink"
      }`}
    >
      <AdminIcon name={icon} size={16} />
    </button>
  );
}
