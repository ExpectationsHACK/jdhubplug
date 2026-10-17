"use client";

import { useState } from "react";
import { Icon } from "./Icon";

// IMEI / VIN format check. It runs in the browser and only validates the number
// itself (IMEI checksum, VIN characters and check digit). It does not search any
// blacklist or history database, and says so, so a pass is never read as "clean".

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

// ISO 3779 check digit (position 9). Used by North American VINs; many imports omit it.
const VIN_VALUE: Record<string, number> = Object.fromEntries(
  [..."ABCDEFGHJKLMNPRSTUVWXYZ"].map((c, i) => [c, [1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 7, 9, 2, 3, 4, 5, 6, 7, 8, 9][i]]),
);
const VIN_WEIGHT = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
const vinCheckDigitOk = (vin: string) => {
  const sum = [...vin].reduce((s, c, i) => s + (/\d/.test(c) ? Number(c) : VIN_VALUE[c]) * VIN_WEIGHT[i], 0);
  const r = sum % 11;
  return vin[8] === (r === 10 ? "X" : String(r));
};

type Result = { ok: boolean; title: string; body: string } | null;

const NOT_A_HISTORY_CHECK =
  "This only checks the number's format. It doesn't search lost, stolen or salvage records. Every phone and car JDHub sells is checked by our team before it's listed.";

export function TrustLookup() {
  const [q, setQ] = useState("");
  const [result, setResult] = useState<Result>(null);

  const check = (e: React.FormEvent) => {
    e.preventDefault();
    const v = q.replace(/\s|-/g, "").toUpperCase();
    if (/^\d{15}$/.test(v)) {
      setResult(
        luhn(v)
          ? { ok: true, title: "Valid IMEI format", body: NOT_A_HISTORY_CHECK }
          : { ok: false, title: "Invalid IMEI", body: "That number fails the IMEI checksum. Dial *#06# on the phone to read the real one." },
      );
    } else if (/^[A-HJ-NPR-Z0-9]{17}$/.test(v)) {
      setResult(
        vinCheckDigitOk(v)
          ? { ok: true, title: "Valid VIN format", body: NOT_A_HISTORY_CHECK }
          : {
              ok: true,
              title: "VIN characters look valid",
              body: `The check digit doesn't match, which is normal for many non-US cars. ${NOT_A_HISTORY_CHECK}`,
            },
      );
    } else {
      setResult({ ok: false, title: "Check the number", body: "Enter a 15-digit IMEI or a 17-character VIN (no I, O or Q)." });
    }
  };

  return (
    <div className="rounded-tile bg-stage p-6 md:p-10">
      <p className="text-[16px] font-bold">IMEI / VIN format check</p>
      <form onSubmit={check} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Enter IMEI (15 digits) or VIN (17 characters)"
          className="field flex-1"
          aria-label="IMEI or VIN"
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
