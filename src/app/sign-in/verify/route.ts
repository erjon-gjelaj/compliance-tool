import { NextResponse, type NextRequest } from "next/server";

import { openClientSession } from "@/lib/auth/session";
import { verifyToken } from "@/lib/auth/tokens";

/**
 * Where a sign-in link lands: exchange the short token for the seven-day
 * session cookie, then get out of the way.
 *
 * A route handler rather than a page so nothing renders with the token still
 * in the address bar. The redirect happens before any HTML exists, which
 * keeps the token out of the page, out of any Referer header the next
 * navigation would send, and out of the browser history entry the person is
 * left on.
 *
 * Note it is deliberately not single-use. Making it so would need a row per
 * link — the store this project set out not to have — and it would also break
 * the common case rather than an attack: corporate mail scanners follow every
 * link in an incoming email, so a one-shot link is routinely burned before
 * its owner ever clicks it. The fifteen-minute expiry is what bounds the
 * exposure instead.
 */

export const dynamic = "force-dynamic";

/**
 * Resolved against the incoming request rather than SITE_URL, and that is a
 * correctness fix rather than a style choice.
 *
 * The cookie is set on whatever host this request arrived at. certloop.net
 * and www.certloop.net are different origins to a cookie jar, and DEPLOY.md
 * records that the apex currently 308s to www while SITE_URL names the apex —
 * so redirecting to SITE_URL could land the person on a host that was never
 * sent the cookie we just issued. They would sign in successfully and arrive
 * signed out.
 *
 * Only ever used with a fixed internal path, so nothing from the request
 * decides where this goes — just which host it stays on.
 */
function back(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.nextUrl.origin), {
    // 303: the browser must not repeat this as anything but a GET, and the
    // consumed token should not be re-fetched from cache.
    status: 303,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) return back(request, "/sign-in?error=expired");

  const verified = await verifyToken(token, "sign-in");

  // One destination for every failure — expired, tampered, wrong purpose.
  // The copy says "expired or already used" because that is overwhelmingly
  // what it is, and the remedy is the same in every case: ask for another.
  if (!verified) return back(request, "/sign-in?error=expired");

  await openClientSession(verified.email);

  return back(request, "/dashboard");
}
