// Product <-> CSV mapping and the import planner. Pure and isomorphic: the export and
// import Route Handlers use it on the server, and the import page uses the column
// list to offer a template.

import { unescapeFormula, type CsvCell } from "@/lib/csv";
import type { Product } from "@/lib/types";
import { PRODUCT_ID_RE, describeChanges, productToInput, validateProduct, withValidWas, type FieldErrors, type ProductInput } from "./validate";

export const CSV_COLUMNS = [
  "id",
  "name",
  "brand",
  "category",
  "grade",
  "price",
  "was",
  "stock",
  "status",
  "featured",
  "badge",
  "seller",
  "state",
  "verified",
  "spec",
  "photo",
  "imageUrl",
  "model",
  "attrs",
] as const;

/** Extra columns the importer understands but the export doesn't write. */
const EXTRA_COLUMNS = ["art", "tint"] as const;

type Column = (typeof CSV_COLUMNS)[number] | (typeof EXTRA_COLUMNS)[number];

export const MAX_IMPORT_ROWS = 2000;

const ALIASES: Record<string, Column> = {
  imageurl: "imageUrl",
  image_url: "imageUrl",
  "image url": "imageUrl",
  image: "imageUrl",
  compare_at: "was",
  "compare at": "was",
  "compare-at": "was",
  compareat: "was",
  "was price": "was",
  "ships from": "state",
  ships_from: "state",
  location: "state",
  "verified seller": "verified",
  attributes: "attrs",
  "model group": "model",
  model_group: "model",
  "spec line": "spec",
  commons: "photo",
  "commons file": "photo",
  quantity: "stock",
  qty: "stock",
};

export function productToCsvRow(p: Product): CsvCell[] {
  return [
    p.id,
    p.name,
    p.brand,
    p.category,
    p.grade,
    p.price,
    p.was && p.was > p.price ? p.was : "",
    p.stock,
    p.status,
    !!p.featured,
    p.badge ?? "",
    p.seller,
    p.state,
    p.verified,
    p.spec,
    p.photo ?? "",
    p.imageUrl ?? "",
    p.model,
    Object.keys(p.attrs ?? {}).length ? JSON.stringify(p.attrs) : "",
  ];
}

/** A header row plus one example product, for the "Download template" link. */
export function templateRows(): CsvCell[][] {
  return [
    [...CSV_COLUMNS],
    [
      "",
      "iPhone 15 Pro",
      "Apple",
      "phones",
      "great",
      850000,
      920000,
      1,
      "draft",
      false,
      "Hot deal",
      "JDHub Certified",
      "Lagos",
      true,
      "256GB · Natural Titanium · Battery 89%",
      "Apple_iPhone_15_Pro.jpg",
      "",
      "iphone-15-pro",
      JSON.stringify({ Storage: "256GB", Colour: "Natural Titanium", "Battery health": "89%" }),
    ],
  ];
}

function parseBool(s: string): boolean | null {
  const v = s.trim().toLowerCase();
  if (["true", "yes", "y", "1"].includes(v)) return true;
  if (["false", "no", "n", "0"].includes(v)) return false;
  return null;
}

/** attrs cell: a JSON object, or "Key: Value; Key: Value" for spreadsheet users. */
function parseAttrs(s: string): [string, string][] | null {
  const v = s.trim();
  if (!v) return [];
  if (v.startsWith("{")) {
    try {
      const o = JSON.parse(v) as unknown;
      if (!o || typeof o !== "object" || Array.isArray(o)) return null;
      return Object.entries(o as Record<string, unknown>).map(([k, x]) => [k, typeof x === "string" ? x : String(x ?? "")]);
    } catch {
      return null;
    }
  }
  const out: [string, string][] = [];
  for (const part of v.split(";")) {
    if (!part.trim()) continue;
    const i = part.indexOf(":");
    if (i < 1) return null;
    out.push([part.slice(0, i).trim(), part.slice(i + 1).trim()]);
  }
  return out;
}

const blankInput = (): ProductInput => ({
  name: "",
  brand: "",
  category: "",
  model: "",
  grade: "great",
  price: "",
  was: "",
  stock: "1",
  status: "draft",
  featured: false,
  badge: "",
  seller: "JDHub Certified",
  verified: false,
  state: "Lagos",
  spec: "",
  attrs: [],
  photo: "",
  imageUrl: "",
  art: "",
  tint: "",
});

// A blank cell clears these fields; for every other field a blank cell keeps the
// current value (updates) or the default (new products).
const CLEARABLE = new Set<Column>(["was", "badge", "photo", "imageUrl", "spec", "attrs"]);

export type ImportRowError = { row: number; message: string };

export type ImportPlan = {
  /** Data rows read (excluding the header and blank rows). */
  total: number;
  creates: { row: number; product: Product }[];
  updates: { row: number; before: Product; after: Product; changes: string[]; stockChanged: boolean }[];
  unchanged: number;
  errors: ImportRowError[];
  warnings: string[];
};

const FIELD_LABEL: Partial<Record<keyof ProductInput, string>> = { imageUrl: "imageUrl", was: "was", attrs: "attrs" };

function errorText(errors: FieldErrors) {
  return Object.entries(errors)
    .map(([k, m]) => `${FIELD_LABEL[k as keyof ProductInput] ?? k}: ${m}`)
    .join(" ");
}

/**
 * Work out what an import would do. `records` is the parsed CSV including the header
 * row. Nothing is written; the caller applies the plan.
 */
export function planImport(records: string[][], existing: Map<string, Product>, makeId: (name: string) => string): ImportPlan {
  const plan: ImportPlan = { total: 0, creates: [], updates: [], unchanged: 0, errors: [], warnings: [] };
  if (!records.length) {
    plan.errors.push({ row: 1, message: "The file is empty." });
    return plan;
  }

  // Map header cells to known columns.
  const header = records[0].map((h) => h.trim());
  const cols = new Map<Column, number>();
  const known = new Set<string>([...CSV_COLUMNS, ...EXTRA_COLUMNS]);
  header.forEach((h, i) => {
    const lower = h.toLowerCase();
    const col = (known.has(h) ? h : ([...known].find((k) => k.toLowerCase() === lower) ?? ALIASES[lower])) as Column | undefined;
    if (!h) return;
    if (!col) plan.warnings.push(`Ignored unknown column "${h.slice(0, 40)}".`);
    else if (cols.has(col)) plan.warnings.push(`Column "${h.slice(0, 40)}" appears twice; the first one is used.`);
    else cols.set(col, i);
  });
  if (!cols.has("id") && !cols.has("name")) {
    plan.errors.push({ row: 1, message: "The header row needs at least an id or a name column. Download the template to see the format." });
    return plan;
  }

  const dataRows = records.slice(1);
  if (dataRows.length > MAX_IMPORT_ROWS) {
    plan.errors.push({ row: 1, message: `The file has ${dataRows.length} rows. Import at most ${MAX_IMPORT_ROWS} at a time.` });
    return plan;
  }

  const seenIds = new Map<string, number>();
  const taken = new Set(existing.keys());

  dataRows.forEach((cells, idx) => {
    const row = idx + 2;
    if (cells.every((c) => !c.trim())) return;
    plan.total++;

    const cell = (c: Column): string | undefined => {
      const i = cols.get(c);
      if (i === undefined) return undefined;
      return unescapeFormula((cells[i] ?? "").trim());
    };

    const id = (cell("id") ?? "").toLowerCase();
    if (id) {
      if (!PRODUCT_ID_RE.test(id)) {
        plan.errors.push({ row, message: `id "${id.slice(0, 40)}" can only use lowercase letters, numbers and dashes.` });
        return;
      }
      const prev = seenIds.get(id);
      if (prev) {
        plan.errors.push({ row, message: `id "${id}" is also on row ${prev}.` });
        return;
      }
      seenIds.set(id, row);
    }

    const current = id ? existing.get(id) : undefined;
    const input: ProductInput = current ? productToInput(current) : blankInput();
    const problems: string[] = [];

    for (const col of cols.keys()) {
      if (col === "id") continue;
      const v = cell(col)!;
      if (!v) {
        if (CLEARABLE.has(col)) {
          if (col === "attrs") input.attrs = [];
          else input[col as Exclude<keyof ProductInput, "attrs" | "featured" | "verified">] = "";
        }
        continue;
      }
      if (col === "featured" || col === "verified") {
        const b = parseBool(v);
        if (b === null) problems.push(`${col} must be true or false.`);
        else input[col] = b;
      } else if (col === "attrs") {
        const a = parseAttrs(v);
        if (!a) problems.push('attrs must be JSON like {"Storage":"256GB"} or "Storage: 256GB; Colour: Black".');
        else input.attrs = a;
      } else if (col === "category" || col === "grade" || col === "status") {
        input[col] = v.toLowerCase().replace(/\s+/g, "-");
      } else {
        input[col] = v;
      }
    }

    if (problems.length) {
      plan.errors.push({ row, message: problems.join(" ") });
      return;
    }

    const res = validateProduct(input);
    if (!res.ok) {
      plan.errors.push({ row, message: errorText(res.errors) });
      return;
    }
    const v = res.value;

    if (current) {
      const after: Product = { ...current, ...v, id: current.id };
      const changes = describeChanges(withValidWas(current), after);
      const stockChanged = v.stock !== current.stock;
      if (stockChanged) changes.push(`stock ${current.stock} → ${v.stock}`);
      if (!changes.length) plan.unchanged++;
      else plan.updates.push({ row, before: current, after, changes, stockChanged });
      return;
    }

    let newId = id;
    if (!newId) {
      do newId = makeId(v.name);
      while (taken.has(newId));
    }
    taken.add(newId);
    plan.creates.push({
      row,
      product: { ...v, id: newId, rating: 0, reviews: 0, sold: 0, createdAt: "", updatedAt: "" },
    });
  });

  if (!plan.total && !plan.errors.length) plan.errors.push({ row: 2, message: "No product rows found under the header." });
  return plan;
}

/** What the import endpoint sends back for a preview or an applied import. */
export type ImportSummary = {
  total: number;
  unchanged: number;
  creates: { row: number; id: string; name: string; category: string; price: number; stock: number; status: string }[];
  updates: { row: number; id: string; name: string; changes: string[] }[];
  errors: ImportRowError[];
  warnings: string[];
  /** Set when the import was applied. */
  applied?: { created: number; updated: number; skipped: number };
  /** Set when the request itself was refused (e.g. errors present without skipping them). */
  error?: string;
};

export function summarizePlan(plan: ImportPlan): ImportSummary {
  return {
    total: plan.total,
    unchanged: plan.unchanged,
    creates: plan.creates.map(({ row, product: p }) => ({ row, id: p.id, name: p.name, category: p.category, price: p.price, stock: p.stock, status: p.status })),
    updates: plan.updates.map(({ row, after, changes }) => ({ row, id: after.id, name: after.name, changes })),
    errors: plan.errors,
    warnings: plan.warnings,
  };
}
