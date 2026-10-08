import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { StorageStatus } from "../types";

// Minimal key-value driver used by the store. Two implementations:
//
//  - RedisDriver: Upstash Redis over its REST API (what Vercel's Upstash / KV
//    integration provides). Persistent and shared by every serverless instance.
//  - MemoryDriver: an in-process map. In development it is snapshotted to
//    .data/jdhub-store.json so local edits survive restarts. In production it is
//    per-instance and NOT persistent; the admin shows a warning until Redis is set up.
//
// Stock reservation is a dedicated operation so it can be atomic in both drivers
// (a Lua script in Redis, a synchronous block in memory).

export interface Driver {
  readonly status: StorageStatus;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  setNx(key: string, value: string, ttlSeconds: number): Promise<boolean>;
  del(key: string): Promise<void>;
  incr(key: string): Promise<number>;
  hget(key: string, field: string): Promise<string | null>;
  hgetall(key: string): Promise<Record<string, string>>;
  hmget(key: string, fields: string[]): Promise<(string | null)[]>;
  hset(key: string, values: Record<string, string>): Promise<void>;
  hdel(key: string, fields: string[]): Promise<void>;
  hincrby(key: string, field: string, by: number): Promise<number>;
  lpush(key: string, value: string): Promise<void>;
  ltrim(key: string, start: number, stop: number): Promise<void>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  /**
   * Atomically check and decrement stock for every line, moving the units to `soldKey`.
   * Either all lines are reserved, or none are and the first short line is returned.
   */
  reserve(stockKey: string, soldKey: string, lines: [string, number][]): Promise<{ ok: true } | { ok: false; id: string; available: number }>;
  /** Return units to stock (inverse of reserve). */
  release(stockKey: string, soldKey: string, lines: [string, number][]): Promise<void>;
}

// ---------------------------------------------------------------- Redis (REST)

const RESERVE_LUA = `
for i = 1, #ARGV, 2 do
  local have = tonumber(redis.call('HGET', KEYS[1], ARGV[i]) or '0')
  if have < tonumber(ARGV[i + 1]) then return {ARGV[i], tostring(have)} end
end
for i = 1, #ARGV, 2 do
  redis.call('HINCRBY', KEYS[1], ARGV[i], -tonumber(ARGV[i + 1]))
  redis.call('HINCRBY', KEYS[2], ARGV[i], tonumber(ARGV[i + 1]))
end
return 'OK'
`;

const RELEASE_LUA = `
for i = 1, #ARGV, 2 do
  redis.call('HINCRBY', KEYS[1], ARGV[i], tonumber(ARGV[i + 1]))
  local sold = tonumber(redis.call('HINCRBY', KEYS[2], ARGV[i], -tonumber(ARGV[i + 1])))
  if sold < 0 then redis.call('HSET', KEYS[2], ARGV[i], 0) end
end
return 'OK'
`;

class RedisDriver implements Driver {
  readonly status: StorageStatus = { kind: "redis", persistent: true, label: "Upstash Redis" };
  constructor(
    private url: string,
    private token: string,
  ) {}

  private async cmd<T = unknown>(...args: (string | number)[]): Promise<T> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(args.map(String)),
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as { result?: T; error?: string };
    if (!res.ok || body.error) throw new Error(`Redis ${args[0]} failed: ${body.error ?? res.status}`);
    return body.result as T;
  }

  async get(key: string) {
    return (await this.cmd<string | null>("GET", key)) ?? null;
  }
  async set(key: string, value: string) {
    await this.cmd("SET", key, value);
  }
  async setNx(key: string, value: string, ttl: number) {
    return (await this.cmd<string | null>("SET", key, value, "NX", "EX", ttl)) === "OK";
  }
  async del(key: string) {
    await this.cmd("DEL", key);
  }
  async incr(key: string) {
    return Number(await this.cmd("INCR", key));
  }
  async hget(key: string, field: string) {
    return (await this.cmd<string | null>("HGET", key, field)) ?? null;
  }
  async hgetall(key: string) {
    const flat = (await this.cmd<string[] | null>("HGETALL", key)) ?? [];
    const out: Record<string, string> = {};
    for (let i = 0; i < flat.length; i += 2) out[flat[i]] = flat[i + 1];
    return out;
  }
  async hmget(key: string, fields: string[]) {
    if (!fields.length) return [];
    return (await this.cmd<(string | null)[]>("HMGET", key, ...fields)) ?? fields.map(() => null);
  }
  async hset(key: string, values: Record<string, string>) {
    const entries = Object.entries(values);
    // Keep each request comfortably below Upstash's request size limit.
    for (let i = 0; i < entries.length; i += 100) {
      await this.cmd("HSET", key, ...entries.slice(i, i + 100).flat());
    }
  }
  async hdel(key: string, fields: string[]) {
    if (fields.length) await this.cmd("HDEL", key, ...fields);
  }
  async hincrby(key: string, field: string, by: number) {
    return Number(await this.cmd("HINCRBY", key, field, by));
  }
  async lpush(key: string, value: string) {
    await this.cmd("LPUSH", key, value);
  }
  async ltrim(key: string, start: number, stop: number) {
    await this.cmd("LTRIM", key, start, stop);
  }
  async lrange(key: string, start: number, stop: number) {
    return (await this.cmd<string[]>("LRANGE", key, start, stop)) ?? [];
  }
  async reserve(stockKey: string, soldKey: string, lines: [string, number][]) {
    const res = await this.cmd<string | [string, string]>("EVAL", RESERVE_LUA, 2, stockKey, soldKey, ...lines.flat());
    if (res === "OK") return { ok: true as const };
    const [id, available] = res as [string, string];
    return { ok: false as const, id, available: Number(available) };
  }
  async release(stockKey: string, soldKey: string, lines: [string, number][]) {
    if (lines.length) await this.cmd("EVAL", RELEASE_LUA, 2, stockKey, soldKey, ...lines.flat());
  }
}

// --------------------------------------------------------------------- Memory

type Snapshot = {
  strings: Record<string, string>;
  hashes: Record<string, Record<string, string>>;
  lists: Record<string, string[]>;
};

class MemoryDriver implements Driver {
  readonly status: StorageStatus;
  private strings = new Map<string, string>();
  private hashes = new Map<string, Map<string, string>>();
  private lists = new Map<string, string[]>();
  private expiries = new Map<string, number>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private file: string | null) {
    this.status = file
      ? { kind: "file", persistent: true, label: "Local file (.data/jdhub-store.json)", hint: "Development only. Connect Upstash Redis on Vercel for production." }
      : {
          kind: "memory",
          persistent: false,
          label: "Temporary memory",
          hint: "Changes and orders are lost when the server restarts and are not shared between server instances. Add Upstash Redis in Vercel (Storage → Upstash for Redis) to make them permanent.",
        };
    if (file) this.load();
  }

  private load() {
    try {
      if (!existsSync(this.file!)) return;
      const snap = JSON.parse(readFileSync(this.file!, "utf8")) as Snapshot;
      for (const [k, v] of Object.entries(snap.strings ?? {})) this.strings.set(k, v);
      for (const [k, v] of Object.entries(snap.hashes ?? {})) this.hashes.set(k, new Map(Object.entries(v)));
      for (const [k, v] of Object.entries(snap.lists ?? {})) this.lists.set(k, v);
    } catch (e) {
      console.warn("[store] could not load local store file, starting empty", e);
    }
  }

  private persist() {
    if (!this.file || this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      try {
        const snap: Snapshot = {
          strings: Object.fromEntries(this.strings),
          hashes: Object.fromEntries([...this.hashes].map(([k, v]) => [k, Object.fromEntries(v)])),
          lists: Object.fromEntries(this.lists),
        };
        mkdirSync(dirname(this.file!), { recursive: true });
        writeFileSync(this.file!, JSON.stringify(snap));
      } catch (e) {
        console.warn("[store] could not write local store file", e);
      }
    }, 150);
  }

  private hash(key: string, create = false) {
    let h = this.hashes.get(key);
    if (!h && create) this.hashes.set(key, (h = new Map()));
    return h;
  }

  private alive(key: string) {
    const exp = this.expiries.get(key);
    if (exp !== undefined && exp < Date.now()) {
      this.expiries.delete(key);
      this.strings.delete(key);
      return false;
    }
    return this.strings.has(key);
  }

  async get(key: string) {
    return this.alive(key) ? this.strings.get(key)! : null;
  }
  async set(key: string, value: string) {
    this.strings.set(key, value);
    this.expiries.delete(key);
    this.persist();
  }
  async setNx(key: string, value: string, ttl: number) {
    if (this.alive(key)) return false;
    this.strings.set(key, value);
    this.expiries.set(key, Date.now() + ttl * 1000);
    return true;
  }
  async del(key: string) {
    this.strings.delete(key);
    this.hashes.delete(key);
    this.lists.delete(key);
    this.persist();
  }
  async incr(key: string) {
    const n = Number(this.strings.get(key) ?? 0) + 1;
    this.strings.set(key, String(n));
    this.persist();
    return n;
  }
  async hget(key: string, field: string) {
    return this.hash(key)?.get(field) ?? null;
  }
  async hgetall(key: string) {
    return Object.fromEntries(this.hash(key) ?? []);
  }
  async hmget(key: string, fields: string[]) {
    const h = this.hash(key);
    return fields.map((f) => h?.get(f) ?? null);
  }
  async hset(key: string, values: Record<string, string>) {
    const h = this.hash(key, true)!;
    for (const [k, v] of Object.entries(values)) h.set(k, v);
    this.persist();
  }
  async hdel(key: string, fields: string[]) {
    const h = this.hash(key);
    for (const f of fields) h?.delete(f);
    this.persist();
  }
  async hincrby(key: string, field: string, by: number) {
    const h = this.hash(key, true)!;
    const n = Number(h.get(field) ?? 0) + by;
    h.set(field, String(n));
    this.persist();
    return n;
  }
  async lpush(key: string, value: string) {
    const l = this.lists.get(key) ?? [];
    l.unshift(value);
    this.lists.set(key, l);
    this.persist();
  }
  async ltrim(key: string, start: number, stop: number) {
    const l = this.lists.get(key);
    if (l) this.lists.set(key, l.slice(start, stop === -1 ? undefined : stop + 1));
    this.persist();
  }
  async lrange(key: string, start: number, stop: number) {
    return (this.lists.get(key) ?? []).slice(start, stop === -1 ? undefined : stop + 1);
  }
  async reserve(stockKey: string, soldKey: string, lines: [string, number][]) {
    // Synchronous between the check and the writes, so it is atomic within this process.
    const stock = this.hash(stockKey, true)!;
    const sold = this.hash(soldKey, true)!;
    for (const [id, qty] of lines) {
      const have = Number(stock.get(id) ?? 0);
      if (have < qty) return { ok: false as const, id, available: have };
    }
    for (const [id, qty] of lines) {
      stock.set(id, String(Number(stock.get(id) ?? 0) - qty));
      sold.set(id, String(Number(sold.get(id) ?? 0) + qty));
    }
    this.persist();
    return { ok: true as const };
  }
  async release(stockKey: string, soldKey: string, lines: [string, number][]) {
    const stock = this.hash(stockKey, true)!;
    const sold = this.hash(soldKey, true)!;
    for (const [id, qty] of lines) {
      stock.set(id, String(Number(stock.get(id) ?? 0) + qty));
      sold.set(id, String(Math.max(0, Number(sold.get(id) ?? 0) - qty)));
    }
    this.persist();
  }
}

// --------------------------------------------------------------------- Select

const g = globalThis as unknown as { __jdhubDriver?: Driver };

export function getDriver(): Driver {
  if (g.__jdhubDriver) return g.__jdhubDriver;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    g.__jdhubDriver = new RedisDriver(url.replace(/\/$/, ""), token);
  } else {
    // Vercel's filesystem is read-only, so only snapshot to disk outside of Vercel.
    const useFile = !process.env.VERCEL && process.env.JDHUB_MEMORY_ONLY !== "1";
    const file = useFile ? join(process.cwd(), ".data", "jdhub-store.json") : null;
    g.__jdhubDriver = new MemoryDriver(file);
  }
  return g.__jdhubDriver;
}

export function storageStatus(): StorageStatus {
  return getDriver().status;
}
