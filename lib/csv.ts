// Small RFC 4180 CSV parser and serializer. Isomorphic, no dependencies.
//
// Handles quoted fields with commas, doubled quotes ("") and line breaks, CRLF or LF
// line endings, a UTF-8 byte-order mark, and a missing trailing newline. A quote inside
// an unquoted cell (5" screen) is kept as a literal, as spreadsheet apps do. Records are
// returned exactly as written (no trimming or type coercion); callers decide what a
// cell means.

export type CsvCell = string | number | boolean | null | undefined;

export class CsvError extends Error {
  constructor(
    message: string,
    /** 1-based record number where parsing failed (header = 1). */
    readonly record: number,
  ) {
    super(message);
    this.name = "CsvError";
  }
}

/**
 * Parse CSV text into records (arrays of cells). Blank lines are skipped.
 * Throws CsvError for an unterminated quoted field or text after a closing quote.
 */
export function parseCsv(text: string, opts: { maxRecords?: number } = {}): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const out: string[][] = [];
  let record: string[] = [];
  let cell = "";
  let i = 0;
  // True once the current record has any content (so a lone newline isn't a record).
  let dirty = false;
  const max = opts.maxRecords ?? Infinity;

  const endCell = () => {
    record.push(cell);
    cell = "";
  };
  const endRecord = () => {
    endCell();
    if (dirty || record.length > 1) out.push(record);
    record = [];
    dirty = false;
    if (out.length > max) throw new CsvError(`Too many rows (the limit is ${max}).`, out.length);
  };

  while (i < src.length) {
    const ch = src[i];
    if (ch === '"' && cell === "") {
      // Quoted field: read until the closing quote (a doubled quote is a literal quote).
      dirty = true;
      i++;
      let closed = false;
      while (i < src.length) {
        const c = src[i];
        if (c === '"') {
          if (src[i + 1] === '"') {
            cell += '"';
            i += 2;
            continue;
          }
          closed = true;
          i++;
          break;
        }
        cell += c;
        i++;
      }
      if (!closed) throw new CsvError("A quoted cell is never closed.", out.length + 1);
      // After a closing quote only spaces, a delimiter or a line break may follow.
      while (src[i] === " " || src[i] === "\t") i++;
      const next = src[i];
      if (next !== undefined && next !== "," && next !== "\n" && next !== "\r") {
        throw new CsvError("Unexpected text after a closing quote.", out.length + 1);
      }
      continue;
    }
    if (ch === ",") {
      dirty = true;
      endCell();
      i++;
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      endRecord();
      i += ch === "\r" && src[i + 1] === "\n" ? 2 : 1;
      continue;
    }
    dirty = true;
    cell += ch;
    i++;
  }
  if (dirty || cell !== "" || record.length) endRecord();
  return out;
}

const FORMULA_START = /^[=+\-@\t\r]/;

function encodeCell(v: CsvCell, escapeFormulas: boolean): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "boolean") return v ? "true" : "false";
  // Spreadsheet apps execute cells that start with = + - @; prefix them with a quote
  // so an exported file can't run formulas. parseCsv callers can strip it back off.
  const s = escapeFormulas && FORMULA_START.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Serialize records to CSV with CRLF line endings (RFC 4180). Numbers and booleans are
 * written bare; strings are quoted only when needed.
 */
export function toCsv(rows: CsvCell[][], opts: { bom?: boolean; escapeFormulas?: boolean } = {}): string {
  const body = rows.map((r) => r.map((c) => encodeCell(c, opts.escapeFormulas ?? true)).join(",")).join("\r\n") + "\r\n";
  return opts.bom ? `﻿${body}` : body;
}

/** Undo the formula-guard prefix added by toCsv (a leading ' before = + - @). */
export function unescapeFormula(cell: string): string {
  return /^'[=+\-@\t\r]/.test(cell) ? cell.slice(1) : cell;
}
