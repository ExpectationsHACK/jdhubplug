import "server-only";

import { connection } from "next/server";

/**
 * The current time for a request-time render. Waits for the request first, so the
 * clock is never baked into a prerendered shell.
 */
export async function requestNow() {
  await connection();
  return Date.now();
}
