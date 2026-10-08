"use client";

import { useState } from "react";
import { Icon } from "./Icon";

// Front-end for IMEI/VIN verification and the public scam-report lookup.
// Results are placeholder logic until the verification provider API is wired in.

const luhn = (digits: string) => {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
};

const reported = new Set(["08000000001"]);

type Result = { ok: boolean; title: string; body: string } | null;

export function TrustLookup() {
  const [tab, setTab] = useState<"device" | "seller">("device");
  const [q, setQ] = useState("");
  const [result, setResult] = useState<Result>(null);

  const check = (e: React.FormEvent) => {
    e.preventDefault();
    const v = q.replace(/\s|-/g, "").toUpperCase();
    if (tab === "device") {
      if (/^\d{15}$/.test(v)) {
        setResult(
          luhn(v)
            ? { ok: true, title: "IMEI looks clean", body: "Not reported lost or stolen on the networks we check. Always confirm at handover." }
            : { ok: false, title: "Invalid IMEI", body: "That number fails the IMEI checksum. Dial *#06# on the phone to read the real one." },
        );
      } else if (/^[A-HJ-NPR-Z0-9]{17}$/.test(v)) {
        setResult({ ok: true, title: "VIN format valid", body: "No salvage or theft records found. Full history is included with JDHub car listings." });
      } else {
        setResult({ ok: false, title: "Check the number", body: "Enter a 15-digit IMEI or a 17-character VIN." });
      }
    } else {
      const phone = v.replace(/^\+?234/, "0");
      if (!/^0\d{10}$/.test(phone)) {
        setResult({ ok: false, title: "Check the number", body: "Enter an 11-digit Nigerian phone number, e.g. 0803 123 4567." });
      } else if (reported.has(phone)) {
        setResult({ ok: false, title: "Reported by the community", body: "This number has open scam reports. Do not pay outside JDHub escrow." });
      } else {
        setResult({ ok: true, title: "No reports found", body: "Nobody has reported this number. Still, pay through escrow so you never have to go first." });
      }
    }
  };

  return (
    <div className="rounded-tile bg-stage p-6 md:p-10">
      <div role="tablist" className="flex gap-8">
        {(
          [
            ["device", "IMEI / VIN check"],
            ["seller", "Scam report lookup"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => {
              setTab(id);
              setResult(null);
              setQ("");
            }}
            className="tab"
          >
            {label}
          </button>
        ))}
      </div>
      <form onSubmit={check} className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tab === "device" ? "Enter IMEI (15 digits) or VIN (17 characters)" : "Enter seller's phone number"}
          className="field flex-1"
          inputMode={tab === "seller" ? "tel" : "text"}
          aria-label={tab === "device" ? "IMEI or VIN" : "Seller phone number"}
        />
        <button className="btn btn-primary btn-lg">Check now</button>
      </form>
      {result && (
        <div className={`fade-in mt-5 flex gap-3 rounded-xl bg-white p-4 ${result.ok ? "text-ok" : "text-sale"}`} role="status">
          <Icon name={result.ok ? "checkCircle" : "alert"} size={24} />
          <div className="text-ink">
            <p className="font-bold">{result.title}</p>
            <p className="text-[14px] text-ink-2">{result.body}</p>
          </div>
        </div>
      )}
    </div>
  );
}
