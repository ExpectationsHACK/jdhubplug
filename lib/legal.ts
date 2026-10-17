// Legal content model (privacy, terms, returns, cookies). Isomorphic: the admin
// form, the public pages and the store all use these types and defaults.
//
// The live values are stored in `jd:legal` (lib/legal-store.ts), edited in
// /admin/privacy and read on the storefront with getLegalContent().

export const LEGAL_PAGES = ["privacy", "terms", "returns", "cookies"] as const;
export type LegalPage = (typeof LEGAL_PAGES)[number];

export const LEGAL_PAGE_LABEL: Record<LegalPage, string> = {
  privacy: "Privacy Policy",
  terms: "Terms of Use",
  returns: "Returns & Warranty",
  cookies: "Cookie Policy",
};

export type LegalDetails = {
  /** Registered business name, as on the CAC certificate. */
  legalName: string;
  /** Name customers know you by. Empty means "use settings.storeName". */
  tradingName: string;
  /** CAC registration number (RC… for a company, BN… for a business name). */
  rcNumber: string;
  registeredAddress: string;
  contactEmail: string;
  contactPhone: string;
  dpoName: string;
  dpoEmail: string;
  /** YYYY-MM-DD. Shown as the effective date on every legal page. */
  effectiveDate: string;
  /** ISO timestamp of the last admin save. */
  updatedAt?: string;
  updatedBy?: string;
  /** Days a buyer has to return an item that isn't as described. */
  returnDays: number;
  /** Warranty on graded phones and gadgets. */
  warrantyDays: number;
  /** Days a car buyer has to inspect before the escrow is released. */
  carInspectionDays: number;
  /** Show the cookie banner and wait for consent before analytics. */
  requireConsent: boolean;
  /** Optional extra clauses per page (markdown-lite: paragraphs, "- " lists, **bold**, [links](https://…)). */
  clauses: Record<LegalPage, string>;
};

export const DEFAULT_LEGAL: LegalDetails = {
  legalName: "",
  tradingName: "",
  rcNumber: "",
  registeredAddress: "",
  contactEmail: "",
  contactPhone: "",
  dpoName: "",
  dpoEmail: "",
  effectiveDate: "2026-10-17",
  returnDays: 7,
  warrantyDays: 90,
  carInspectionDays: 3,
  requireConsent: true,
  clauses: { privacy: "", terms: "", returns: "", cookies: "" },
};

export function withLegalDefaults(s: Partial<LegalDetails> | null | undefined): LegalDetails {
  return {
    ...DEFAULT_LEGAL,
    ...(s ?? {}),
    clauses: { ...DEFAULT_LEGAL.clauses, ...(s?.clauses ?? {}) },
  };
}

/** What the public pages render with: the stored details plus store-wide fallbacks. */
export type ResolvedLegal = LegalDetails & {
  /** Trading name, falling back to the store name. */
  brand: string;
  /** Legal name, falling back to the brand. */
  entity: string;
  email: string;
  phone: string;
  privacyEmail: string;
  whatsapp: string;
};

export function resolveLegal(l: LegalDetails, store: { storeName: string; email: string; phone: string; whatsapp: string }): ResolvedLegal {
  const brand = l.tradingName.trim() || store.storeName;
  const email = l.contactEmail.trim() || store.email;
  return {
    ...l,
    brand,
    entity: l.legalName.trim() || brand,
    email,
    phone: l.contactPhone.trim() || store.phone,
    privacyEmail: l.dpoEmail.trim() || email,
    whatsapp: store.whatsapp,
  };
}

/** "17 October 2026" from YYYY-MM-DD or an ISO timestamp. Timezone-stable. */
export function legalDate(value: string | undefined): string {
  if (!value) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

// ---------------------------------------------------------------- Validation

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_CLAUSES = 8_000;

export type LegalErrors = Partial<Record<string, string>>;

/** Validate and normalise admin input. Returns the clean record or field errors. */
export function parseLegalInput(input: Record<string, string | boolean | undefined>): { ok: true; value: LegalDetails } | { ok: false; errors: LegalErrors } {
  const s = (k: string, max: number) => String(input[k] ?? "").trim().slice(0, max);
  const errors: LegalErrors = {};
  const int = (k: string, min: number, max: number) => {
    const raw = String(input[k] ?? "").trim();
    const n = Number(raw);
    if (!raw || !Number.isInteger(n) || n < min || n > max) errors[k] = `Enter a whole number from ${min} to ${max}.`;
    return n;
  };

  const value: LegalDetails = {
    legalName: s("legalName", 160),
    tradingName: s("tradingName", 80),
    rcNumber: s("rcNumber", 30).toUpperCase(),
    registeredAddress: s("registeredAddress", 300),
    contactEmail: s("contactEmail", 120).toLowerCase(),
    contactPhone: s("contactPhone", 40),
    dpoName: s("dpoName", 120),
    dpoEmail: s("dpoEmail", 120).toLowerCase(),
    effectiveDate: s("effectiveDate", 10),
    returnDays: int("returnDays", 0, 90),
    warrantyDays: int("warrantyDays", 0, 730),
    carInspectionDays: int("carInspectionDays", 0, 30),
    requireConsent: input.requireConsent === true || input.requireConsent === "on",
    clauses: {
      privacy: String(input["clauses.privacy"] ?? "").trim(),
      terms: String(input["clauses.terms"] ?? "").trim(),
      returns: String(input["clauses.returns"] ?? "").trim(),
      cookies: String(input["clauses.cookies"] ?? "").trim(),
    },
  };

  if (!value.legalName) errors.legalName = "Enter the business name registered with the CAC.";
  if (value.rcNumber && !/^(RC|BN|IT|LP|LLP)?\s?-?\d{3,10}$/.test(value.rcNumber)) errors.rcNumber = "Use the CAC number format, e.g. RC 1234567 or BN 3456789.";
  if (value.contactEmail && !EMAIL.test(value.contactEmail)) errors.contactEmail = "Enter a valid email address.";
  if (value.dpoEmail && !EMAIL.test(value.dpoEmail)) errors.dpoEmail = "Enter a valid email address.";
  if (value.contactPhone && !/^\+?[\d\s()-]{7,20}$/.test(value.contactPhone)) errors.contactPhone = "Enter a valid phone number.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.effectiveDate) || Number.isNaN(Date.parse(value.effectiveDate))) errors.effectiveDate = "Pick a valid date.";
  for (const p of LEGAL_PAGES) {
    if (value.clauses[p].length > MAX_CLAUSES) errors[`clauses.${p}`] = `Keep this under ${MAX_CLAUSES.toLocaleString()} characters.`;
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}

// ------------------------------------------------------- Data-subject requests

export type DsrType = "erasure" | "access" | "rectification" | "objection" | "other";
export type DsrStatus = "new" | "in_progress" | "done";

export const DSR_TYPE_LABEL: Record<DsrType, string> = {
  erasure: "Delete account",
  access: "Access / copy of data",
  rectification: "Correct my data",
  objection: "Object / withdraw consent",
  other: "Other privacy request",
};

export const DSR_STATUS_LABEL: Record<DsrStatus, string> = { new: "New", in_progress: "In progress", done: "Done" };

export type DataRequest = {
  id: string;
  type: DsrType;
  status: DsrStatus;
  customerId?: string;
  /** Contact snapshot at request time, so the team can reply even after anonymisation. */
  contact?: string;
  message?: string;
  createdAt: string;
  updatedAt: string;
  /** Set once the customer's profile has been anonymised. */
  anonymisedAt?: string;
  history: { at: string; by: string; note: string }[];
};
