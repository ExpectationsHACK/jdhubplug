import "server-only";

import { getDriver } from "../store/driver";
import { notifyWithDefaults, type NotifyLogEntry, type NotifySettings } from "./events";

// Storage for order notifications:
//   jd:notify:settings        string NotifySettings JSON (per-event email/SMS toggles)
//   jd:notify:log             list   NotifyLogEntry JSON, newest first, capped at 1000
//   jd:notify:order:{orderId} list   the same entries for one order, capped at 50

const K = {
  settings: "jd:notify:settings",
  log: "jd:notify:log",
  order: (id: string) => `jd:notify:order:${id.toUpperCase()}`,
};

const LOG_CAP = 1000;
const ORDER_CAP = 50;

const parse = <T>(s: string | null | undefined): T | null => {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
};

export async function getNotifySettings(): Promise<NotifySettings> {
  return notifyWithDefaults(parse<NotifySettings>(await getDriver().get(K.settings)));
}

export async function saveNotifySettings(s: NotifySettings) {
  await getDriver().set(K.settings, JSON.stringify(notifyWithDefaults(s)));
}

export async function appendNotifyLog(entry: NotifyLogEntry) {
  const d = getDriver();
  const row = JSON.stringify(entry);
  await d.lpush(K.log, row);
  await d.ltrim(K.log, 0, LOG_CAP - 1);
  if (entry.orderId) {
    await d.lpush(K.order(entry.orderId), row);
    await d.ltrim(K.order(entry.orderId), 0, ORDER_CAP - 1);
  }
}

const rows = (list: string[]) => list.map((r) => parse<NotifyLogEntry>(r)).filter((r): r is NotifyLogEntry => !!r);

/** Newest first. */
export async function listNotifyLog(limit = LOG_CAP): Promise<NotifyLogEntry[]> {
  return rows(await getDriver().lrange(K.log, 0, Math.min(limit, LOG_CAP) - 1));
}

/** Messages for one order, newest first. */
export async function listOrderNotifyLog(orderId: string): Promise<NotifyLogEntry[]> {
  return rows(await getDriver().lrange(K.order(orderId), 0, ORDER_CAP - 1));
}
