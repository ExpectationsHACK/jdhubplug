import "server-only";

import { can, requireAdmin, type Permission } from "@/lib/auth";
import type { Session } from "@/lib/session";

/**
 * For Server Actions that report errors as state: redirects to sign-in when signed out
 * (like requireAdmin), and returns null instead of throwing when the role lacks `perm`,
 * so the form can show a friendly message.
 */
export async function sessionWith(perm: Permission): Promise<Session | null> {
  const s = await requireAdmin();
  return can(s.role, perm) ? s : null;
}
