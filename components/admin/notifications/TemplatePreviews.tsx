"use client";

import { useState } from "react";
import type { LogEvent } from "@/lib/notify/events";

// Email template previews: each rendered on the server for a sample order and shown in a
// sandboxed iframe (srcdoc, no scripts), with the subject line and the SMS text.

export type Preview = { event: LogEvent; label: string; subject: string; html: string; sms: string };

export function TemplatePreviews({ previews }: { previews: Preview[] }) {
  const [active, setActive] = useState(previews[0]?.event);
  const p = previews.find((x) => x.event === active) ?? previews[0];
  if (!p) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <div role="tablist" aria-label="Templates" aria-orientation="vertical" className="flex gap-1 overflow-x-auto lg:flex-col">
        {previews.map((x) => {
          const on = x.event === p.event;
          return (
            <button
              key={x.event}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls="notify-preview"
              onClick={() => setActive(x.event)}
              className={`shrink-0 rounded-xl px-3 py-2 text-left text-[13px] font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                on ? "bg-ink text-white" : "text-ink-2 hover:bg-stage hover:text-ink"
              }`}
            >
              {x.label}
            </button>
          );
        })}
      </div>
      <div id="notify-preview" role="tabpanel" className="min-w-0 space-y-3">
        <p className="text-[13px] text-ink-2">
          <span className="font-bold text-muted">Subject</span> <span className="font-bold text-ink">{p.subject}</span>
        </p>
        <iframe
          key={p.event}
          title={`${p.label} email preview`}
          srcDoc={p.html}
          sandbox=""
          loading="lazy"
          className="h-[640px] w-full rounded-xl border border-line bg-[#f4f4f4]"
        />
        <div className="rounded-xl bg-stage p-3">
          <p className="text-[12px] font-bold text-muted">
            SMS · {p.sms.length} characters{p.sms.length > 160 ? ` (${Math.ceil(p.sms.length / 153)} parts)` : ""}
          </p>
          <p className="mt-1 max-w-md whitespace-pre-wrap break-words rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-[13px]">{p.sms}</p>
        </div>
      </div>
    </div>
  );
}
