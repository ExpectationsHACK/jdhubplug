import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

// Clears the admin session cookie and returns to the sign-in page. The admin shell sends
// a browser here when its staff account was deactivated, deleted or given a new role,
// because a Server Component can't change cookies itself.
export async function GET(request: NextRequest) {
  const reason = request.nextUrl.searchParams.get("reason") === "revoked" ? "revoked" : "signedout";
  const res = NextResponse.redirect(new URL(`/admin/login?reason=${reason}`, request.url), 303);
  res.cookies.delete(SESSION_COOKIE);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
