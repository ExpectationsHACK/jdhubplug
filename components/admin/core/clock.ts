import "server-only";

import { connection } from "next/server";

/**
 * The current time for a request-time render. Waits for the request first, so the
 * value is never baked into a prerendered shell.
 */
export async function requestNow(): Promise<number> {
  await connection();
  return Date.now();
}
