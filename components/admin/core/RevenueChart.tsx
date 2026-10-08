"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { RevenueDay } from "./dashboard-metrics";
import { dayLabel, naira, nairaCompact } from "./format";
import s from "./core.module.css";

// 14-day revenue column chart as inline SVG. Sized to its container in real pixels (so
// text never scales), with a per-bar tooltip on hover and keyboard focus, arrow-key
// navigation between bars, and a table view carrying every value.

const H = 220;
const PAD = { top: 16, right: 8, bottom: 30, left: 52 };
const BAR_MAX = 24;
const PAST = "#3d4350";
const TODAY = "var(--accent)";
const GRID = "#e8e8e8";

/** Clean axis steps: 1, 2 or 5 × 10^n. */
function niceTicks(max: number, count = 4) {
  if (max <= 0) return [0, 25_000, 50_000, 75_000, 100_000];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((v) => v >= raw) ?? 10 * mag;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

/** A column with a 4px rounded data end and a square baseline. */
function columnPath(x: number, y: number, w: number, h: number) {
  if (h <= 0) return "";
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export function RevenueChart({ data, todayKey }: { data: RevenueDay[]; todayKey: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  const [focusIdx, setFocusIdx] = useState(data.length - 1);
  const [showTable, setShowTable] = useState(false);
  const bars = useRef<(SVGRectElement | null)[]>([]);
  const titleId = useId();

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const max = Math.max(...data.map((d) => d.revenue));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const plotW = width - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / data.length;
  const barW = Math.max(6, Math.min(BAR_MAX, slot * 0.62));
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const everyOther = slot < 34;

  const total = data.reduce((sum, d) => sum + d.revenue, 0);
  const orders = data.reduce((sum, d) => sum + d.orders, 0);
  const best = data.reduce((b, d) => (d.revenue > b.revenue ? d : b), data[0]);
  const summary = total
    ? `${naira(total)} from ${orders} order${orders === 1 ? "" : "s"} in the last 14 days. Best day ${dayLabel(best.day)} with ${naira(best.revenue)}.`
    : "No paid orders in the last 14 days yet.";

  const label = (d: RevenueDay) => `${d.day === todayKey ? "Today" : dayLabel(d.day)}: ${naira(d.revenue)} from ${d.orders} order${d.orders === 1 ? "" : "s"}`;

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? data.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const clamped = Math.max(0, Math.min(data.length - 1, next));
    setFocusIdx(clamped);
    setHover(clamped);
    bars.current[clamped]?.focus();
  };

  const tip = hover !== null ? data[hover] : null;
  const tipX = hover !== null ? PAD.left + slot * hover + slot / 2 : 0;
  const tipY = tip ? Math.min(y(tip.revenue), PAD.top + plotH - 4) : 0;

  return (
    <div>
      <p id={titleId} className="sr-only">
        Revenue per day, last 14 days. {summary}
      </p>
      <div ref={wrap} className="relative w-full" onPointerLeave={() => setHover(null)}>
        <svg width={width} height={H} role="group" aria-labelledby={titleId} className="block max-w-full">
          {ticks.map((t) => (
            <g key={t} aria-hidden>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} shapeRendering="crispEdges" />
              <text x={PAD.left - 10} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)" style={{ fontVariantNumeric: "tabular-nums" }}>
                {nairaCompact(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const isToday = d.day === todayKey;
            const h = Math.max(0, PAD.top + plotH - y(d.revenue));
            const x = PAD.left + slot * i + (slot - barW) / 2;
            const showLabel = isToday || !everyOther || (data.length - 1 - i) % 2 === 0;
            return (
              <g key={d.day}>
                <path
                  d={columnPath(x, y(d.revenue), barW, h)}
                  fill={isToday ? TODAY : PAST}
                  opacity={hover === null || hover === i ? 1 : 0.45}
                  className={s.bar}
                  style={{ ["--i" as string]: i, transition: "opacity .15s" }}
                  aria-hidden
                />
                {showLabel && (
                  <text
                    x={x + barW / 2}
                    y={H - 10}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={isToday ? 700 : 400}
                    fill={isToday ? "var(--ink)" : "var(--muted)"}
                    aria-hidden
                  >
                    {isToday ? "Today" : dayLabel(d.day, { day: "numeric" })}
                  </text>
                )}
                {/* Hit target: the whole slot, taller and wider than the mark. */}
                <rect
                  ref={(el) => {
                    bars.current[i] = el;
                  }}
                  x={PAD.left + slot * i}
                  y={PAD.top}
                  width={slot}
                  height={plotH}
                  fill="transparent"
                  role="img"
                  aria-label={label(d)}
                  tabIndex={i === focusIdx ? 0 : -1}
                  onPointerEnter={() => setHover(i)}
                  onFocus={() => {
                    setHover(i);
                    setFocusIdx(i);
                  }}
                  onBlur={() => setHover(null)}
                  onKeyDown={(e) => onKey(e, i)}
                  className="cursor-default outline-none focus-visible:[stroke:var(--accent)] focus-visible:[stroke-width:2px]"
                />
              </g>
            );
          })}
          <line x1={PAD.left} x2={width - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} stroke="#cfcfcf" strokeWidth={1} shapeRendering="crispEdges" aria-hidden />
        </svg>

        {tip && (
          <div
            aria-hidden
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-xl border border-line bg-white px-3 py-2 text-[12px] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.35)]"
            style={{ left: Math.min(Math.max(tipX, 80), width - 80), top: tipY - 8 }}
          >
            <p className="text-[14px] font-bold text-ink" style={{ fontVariantNumeric: "tabular-nums" }}>
              {naira(tip.revenue)}
            </p>
            <p className="text-muted">
              {tip.day === todayKey ? "Today" : dayLabel(tip.day)} · {tip.orders} order{tip.orders === 1 ? "" : "s"}
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-muted">{summary}</p>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          aria-expanded={showTable}
          className="rounded-full px-2 py-1 text-[12px] font-bold text-ink-2 underline underline-offset-4 outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
        >
          {showTable ? "Hide table" : "View as table"}
        </button>
      </div>

      {showTable && (
        <div className="mt-3 max-h-72 overflow-auto rounded-xl border border-line">
          <table className="w-full text-left text-[13px]">
            <caption className="sr-only">Revenue per day, last 14 days</caption>
            <thead className="sticky top-0 bg-stage text-[11px] uppercase tracking-[0.04em] text-muted">
              <tr>
                <th scope="col" className="px-3 py-2">Day</th>
                <th scope="col" className="px-3 py-2 text-right">Orders</th>
                <th scope="col" className="px-3 py-2 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
              {[...data].reverse().map((d) => (
                <tr key={d.day} className="border-t border-line">
                  <th scope="row" className="px-3 py-2 font-normal">
                    {d.day === todayKey ? "Today" : dayLabel(d.day)}
                  </th>
                  <td className="px-3 py-2 text-right">{d.orders}</td>
                  <td className="px-3 py-2 text-right font-bold">{naira(d.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
