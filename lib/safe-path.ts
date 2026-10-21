/**
 * A same-site path to redirect to, or `fallback`. Browsers treat "\" like "/", so
 * "/\evil.com" would leave the site; parsing against a dummy origin catches that and
 * any other trick that changes the origin.
 */
export function safePath(raw: string, fallback: string, opts: { allowAdmin?: boolean } = {}): string {
  if (!raw.startsWith("/") || raw.length > 500 || /[\\\u0000-\u001f]/.test(raw)) return fallback;
  try {
    const u = new URL(raw, "http://x.invalid");
    if (u.origin !== "http://x.invalid") return fallback;
    if (!opts.allowAdmin && (u.pathname === "/admin" || u.pathname.startsWith("/admin/"))) return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}
