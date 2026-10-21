"use server";

import { redirect } from "next/navigation";
import { BADGES, MAX_PRICE, MAX_STOCK, STATUS_OPTIONS, describeChanges, roundTo500, validateProduct, type FieldErrors, type ProductInput } from "@/components/admin/products/validate";
import type { BulkOp, SaveState } from "@/components/admin/products/types";
import { audit } from "@/lib/auth";
import { TAGS } from "@/lib/data";
import { refreshFromAction } from "@/lib/revalidate";
import { queueStockAlerts } from "@/lib/stock-alerts";
import { adjustStock, deleteProducts, getProduct, getProducts, newProductId, saveProducts, setStock, withLock } from "@/lib/store";
import type { Product } from "@/lib/types";
import { PRODUCTS_LOCK, UserError, checkId, checkIds, checkInt, ok, runAction, type ActionResult } from "./_lib/run";

// Product and stock mutations for /admin/products and /admin/inventory.
// Field edits use saveProducts(..., { keepStock: true }) so they can never overwrite a
// purchase that happened meanwhile; stock edits go through setStock / adjustStock.

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

/** Join per-product notes for the activity log without letting one entry grow huge. */
function summarize(parts: string[], max = 1500) {
  let out = "";
  for (let i = 0; i < parts.length; i++) {
    const next = out ? `${out}; ${parts[i]}` : parts[i];
    if (next.length > max) return `${out}; … and ${parts.length - i} more`;
    out = next;
  }
  return out;
}

// ------------------------------------------------------------------ Inline edits

export async function updatePriceAction(id: string, price: number): Promise<ActionResult<{ price: number; wasCleared: boolean }>> {
  return runAction("products:write", async (s) => {
    const pid = checkId(id);
    const next = checkInt(price, 1, MAX_PRICE, "Price");
    return withLock(PRODUCTS_LOCK, async () => {
      const cur = await getProduct(pid);
      if (!cur) throw new UserError("This product no longer exists.");
      if (cur.price === next) return ok({ price: next, wasCleared: false });
      // A compare-at price only makes sense above the selling price.
      const wasCleared = !!cur.was && cur.was <= next;
      await saveProducts([{ ...cur, price: next, was: wasCleared ? undefined : cur.was }], { keepStock: true });
      await audit(s, "product.price", pid, `price ${cur.price} → ${next}${wasCleared ? `; was ${cur.was} cleared` : ""}`);
      refreshFromAction(TAGS.catalog);
      return ok({ price: next, wasCleared }, wasCleared ? `Price saved. The compare-at price (${naira(cur.was!)}) was cleared.` : "Price saved.");
    });
  });
}

export async function setStockAction(id: string, units: number): Promise<ActionResult<{ stock: number }>> {
  return runAction("inventory:write", async (s) => {
    const pid = checkId(id);
    const n = checkInt(units, 0, MAX_STOCK, "Stock");
    const cur = await getProduct(pid);
    if (!cur) throw new UserError("This product no longer exists.");
    if (cur.stock === n) return ok({ stock: n });
    await setStock(pid, n);
    await audit(s, "product.stock", pid, `stock ${cur.stock} → ${n}`);
    refreshFromAction(TAGS.catalog);
    if (n > 0) queueStockAlerts();
    return ok({ stock: n }, n === 0 ? "Marked as sold out." : `Stock set to ${n}.`);
  });
}

export async function adjustStockAction(id: string, delta: number): Promise<ActionResult<{ stock: number }>> {
  return runAction("inventory:write", async (s) => {
    const pid = checkId(id);
    const d = checkInt(delta, -MAX_STOCK, MAX_STOCK, "Change");
    if (d === 0) throw new UserError("Nothing to change.");
    const cur = await getProduct(pid);
    if (!cur) throw new UserError("This product no longer exists.");
    if (cur.stock + d > MAX_STOCK) throw new UserError(`Stock can be at most ${MAX_STOCK.toLocaleString("en-NG")}.`);
    const after = await adjustStock(pid, d);
    await audit(s, "product.stock", pid, `stock ${d > 0 ? "+" : ""}${d} → ${after}`);
    refreshFromAction(TAGS.catalog);
    if (after > 0) queueStockAlerts();
    return ok({ stock: after }, d > 0 ? `Added ${d} ${d === 1 ? "unit" : "units"}. ${after} in stock.` : `${after} in stock.`);
  });
}

// ------------------------------------------------------------------ Bulk actions

function checkOp(op: unknown): BulkOp {
  const o = (op ?? {}) as Record<string, unknown>;
  switch (o.type) {
    case "status":
      if (!STATUS_OPTIONS.some((x) => x.value === o.status)) break;
      return { type: "status", status: o.status as Extract<BulkOp, { type: "status" }>["status"] };
    case "featured":
      if (typeof o.featured !== "boolean") break;
      return { type: "featured", featured: o.featured };
    case "badge":
      if (o.badge !== null && !BADGES.includes(o.badge as never)) break;
      return { type: "badge", badge: o.badge as Extract<BulkOp, { type: "badge" }>["badge"] };
    case "price": {
      const p = o.percent;
      if (typeof p !== "number" || !Number.isFinite(p) || p === 0 || p < -90 || p > 200) {
        throw new UserError("Enter a percentage between -90 and 200 (not 0).");
      }
      return { type: "price", percent: Math.round(p * 100) / 100 };
    }
    case "stock":
      return { type: "stock", units: checkInt(o.units, 0, MAX_STOCK, "Stock") };
    case "delete":
      return { type: "delete" };
  }
  throw new UserError("Unknown bulk action.");
}

/** New price after a percentage change, rounded to the nearest ₦500. */
const bump = (price: number, percent: number) => Math.min(MAX_PRICE, roundTo500(price * (1 + percent / 100)));

export async function bulkProductsAction(ids: string[], op: BulkOp): Promise<ActionResult<{ count: number }>> {
  // Stock-only changes are allowed for inventory staff; everything else needs products:write.
  const perm = (op as { type?: unknown } | null)?.type === "stock" ? "inventory:write" : "products:write";
  return runAction(perm, async (s) => {
    const list = checkIds(ids);
    const action = checkOp(op);

    if (action.type === "stock") {
      const found = await getProducts(list);
      const parts: string[] = [];
      for (const p of found.values()) {
        if (p.stock === action.units) continue;
        await setStock(p.id, action.units);
        parts.push(`${p.id} ${p.stock} → ${action.units}`);
      }
      if (parts.length) {
        await audit(s, "product.bulk-stock", [...found.keys()].join(","), `stock → ${action.units} on ${parts.length} products: ${summarize(parts)}`);
        refreshFromAction(TAGS.catalog);
        if (action.units > 0) queueStockAlerts();
      }
      return ok({ count: parts.length }, `Stock set to ${action.units} on ${parts.length} ${parts.length === 1 ? "product" : "products"}.`);
    }

    if (action.type === "delete") {
      const found = await getProducts(list);
      if (!found.size) throw new UserError("Those products no longer exist.");
      await deleteProducts([...found.keys()]);
      const names = [...found.values()].map((p) => `${p.id} (${p.name}, stock ${p.stock}, sold ${p.sold})`);
      await audit(s, "product.delete", [...found.keys()].join(","), `deleted ${found.size} products: ${summarize(names)}`);
      refreshFromAction(TAGS.catalog);
      return ok({ count: found.size }, `Deleted ${found.size} ${found.size === 1 ? "product" : "products"}.`);
    }

    return withLock(PRODUCTS_LOCK, async () => {
      const found = await getProducts(list);
      const changed: Product[] = [];
      const parts: string[] = [];
      for (const p of found.values()) {
        let next: Product = p;
        if (action.type === "status" && p.status !== action.status) {
          next = { ...p, status: action.status };
          parts.push(`${p.id} ${p.status} → ${action.status}`);
        } else if (action.type === "featured" && !!p.featured !== action.featured) {
          next = { ...p, featured: action.featured };
          parts.push(p.id);
        } else if (action.type === "badge" && (p.badge ?? null) !== action.badge) {
          next = { ...p, badge: action.badge ?? undefined };
          parts.push(`${p.id} ${p.badge ?? "none"} → ${action.badge ?? "none"}`);
        } else if (action.type === "price") {
          const price = bump(p.price, action.percent);
          if (price !== p.price) {
            next = { ...p, price, was: p.was && p.was > price ? p.was : undefined };
            parts.push(`${p.id} ${p.price} → ${price}${p.was && !next.was ? " (was cleared)" : ""}`);
          }
        }
        if (next !== p) changed.push(next);
      }
      if (!changed.length) return ok({ count: 0 }, "Nothing needed changing.");
      await saveProducts(changed, { keepStock: true });

      const what =
        action.type === "status"
          ? `status → ${action.status}`
          : action.type === "featured"
            ? action.featured
              ? "featured"
              : "unfeatured"
            : action.type === "badge"
              ? `badge → ${action.badge ?? "none"}`
              : `price ${action.percent > 0 ? "+" : ""}${action.percent}% (rounded to ₦500)`;
      await audit(s, `product.bulk-${action.type}`, changed.map((p) => p.id).join(","), `${what} on ${changed.length} products: ${summarize(parts)}`);
      refreshFromAction(TAGS.catalog);
      if (action.type === "status" && action.status === "active") queueStockAlerts();
      return ok({ count: changed.length }, `Updated ${changed.length} ${changed.length === 1 ? "product" : "products"}.`);
    });
  });
}

// ------------------------------------------------------------------ Create / edit

const str = (form: FormData, k: string, max = 4000) => {
  const v = form.get(k);
  return typeof v === "string" ? v.slice(0, max) : "";
};

function readInput(form: FormData): ProductInput {
  const keys = form.getAll("attrKey").slice(0, 60);
  const vals = form.getAll("attrValue").slice(0, 60);
  return {
    name: str(form, "name", 500),
    brand: str(form, "brand", 200),
    category: str(form, "category", 40),
    model: str(form, "model", 200),
    grade: str(form, "grade", 40),
    price: str(form, "price", 40),
    was: str(form, "was", 40),
    stock: str(form, "stock", 40),
    status: str(form, "status", 40),
    featured: form.get("featured") === "1",
    badge: str(form, "badge", 40),
    seller: str(form, "seller", 200),
    verified: form.get("verified") === "1",
    state: str(form, "state", 80),
    spec: str(form, "spec", 500),
    attrs: keys.map((k, i) => [typeof k === "string" ? k.slice(0, 200) : "", typeof vals[i] === "string" ? (vals[i] as string).slice(0, 1000) : ""]),
    photo: str(form, "photo", 1000),
    imageUrl: str(form, "imageUrl", 2100),
    art: str(form, "art", 40),
    tint: str(form, "tint", 40),
  };
}

type SaveData = { errors: FieldErrors } | { id: string; created: boolean };

export async function saveProductAction(prev: SaveState, form: FormData): Promise<SaveState> {
  const nonce = (prev?.nonce ?? 0) + 1;
  const res = await runAction<SaveData>("products:write", async (s) => {
    const v = validateProduct(readInput(form));
    if (!v.ok) return ok({ errors: v.errors });
    const fields = v.value;
    const intent = form.get("intent") === "duplicate" ? "duplicate" : "save";
    const sourceId = str(form, "id", 200);

    if (sourceId && intent === "save") {
      const id = checkId(sourceId);
      return withLock(PRODUCTS_LOCK, async () => {
        const cur = await getProduct(id);
        if (!cur) throw new UserError("This product was deleted. Use “Save as new” to keep your changes.");
        const next: Product = { ...cur, ...fields, id, stock: cur.stock, sold: cur.sold };
        const changes = describeChanges(cur, next);
        if (changes.length) await saveProducts([next], { keepStock: true });

        // Stock changes apply relative to what the form loaded, so a sale made while the
        // page was open isn't overwritten.
        const loaded = Number(str(form, "stockOriginal", 20));
        const base = Number.isInteger(loaded) && loaded >= 0 ? loaded : cur.stock;
        if (fields.stock !== base) {
          const after = await adjustStock(id, fields.stock - base);
          changes.push(`stock ${base} → ${fields.stock}${after !== fields.stock ? ` (now ${after} after sales)` : ""}`);
        }
        if (!changes.length) return ok({ id, created: false }, "No changes to save.");
        await audit(s, "product.update", id, changes.join("; "));
        refreshFromAction(TAGS.catalog);
        queueStockAlerts();
        return ok({ id, created: false }, "Product saved.");
      });
    }

    // Create, or "save as new" from an existing product.
    const id = newProductId(fields.name);
    const product: Product = { ...fields, id, rating: 0, reviews: 0, sold: 0, createdAt: "", updatedAt: "" };
    await saveProducts([product]); // writes the initial stock
    const dup = intent === "duplicate" && sourceId ? ` (copy of ${sourceId.slice(0, 120)})` : "";
    await audit(s, dup ? "product.duplicate" : "product.create", id, `${fields.name} · ${naira(fields.price)} · stock ${fields.stock} · ${fields.status}${dup}`);
    refreshFromAction(TAGS.catalog);
    queueStockAlerts();
    return ok({ id, created: true }, dup ? "Saved as a new product." : "Product created.");
  });

  if (!res.ok) return { nonce, ok: false, error: res.error };
  if ("errors" in res.data) return { nonce, ok: false, errors: res.data.errors, error: "Check the highlighted fields." };
  return { nonce, ok: true, message: res.message, id: res.data.id, created: res.data.created };
}

export async function deleteProductAction(id: string): Promise<ActionResult> {
  const res = await runAction("products:write", async (s) => {
    const pid = checkId(id);
    const cur = await getProduct(pid);
    if (!cur) throw new UserError("This product no longer exists.");
    await deleteProducts([pid]);
    await audit(s, "product.delete", pid, `${cur.name} (stock ${cur.stock}, sold ${cur.sold})`);
    refreshFromAction(TAGS.catalog);
    return ok(undefined);
  });
  if (!res.ok) return res;
  redirect("/admin/products?deleted=1");
}
