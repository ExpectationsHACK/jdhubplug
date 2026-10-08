// Orders → CSV (RFC 4180). Isomorphic and pure.

import type { Order } from "@/lib/types";
import { itemCount } from "./format";

export const ORDER_CSV_COLUMNS = ["id", "date", "status", "customer", "phone", "state", "items", "subtotal", "discount", "delivery", "total", "payment", "offer"] as const;

/**
 * Quote a cell when needed, and defuse spreadsheet formula injection: a customer
 * name like `=HYPERLINK(...)` is prefixed with an apostrophe so it stays text.
 */
export function csvCell(v: string | number | undefined | null): string {
  if (v === undefined || v === null) return "";
  let s = String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function orderCsvRow(o: Order): (string | number)[] {
  return [
    o.id,
    o.createdAt,
    o.status,
    o.customer.name,
    o.customer.phone,
    o.customer.state,
    itemCount(o),
    o.subtotal,
    o.discount,
    o.deliveryFee,
    o.total,
    o.payment.method,
    o.offerCode ?? "",
  ];
}

/** CSV text with a UTF-8 BOM so spreadsheet apps read ₦ and accents correctly. */
export function ordersToCsv(orders: Order[]) {
  const lines = [ORDER_CSV_COLUMNS.join(","), ...orders.map((o) => orderCsvRow(o).map(csvCell).join(","))];
  return `﻿${lines.join("\r\n")}\r\n`;
}
