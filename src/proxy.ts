import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, SESSION_HINT_COOKIE } from "@/lib/auth/cookie-names";
import { SESSION_TTL_SECONDS, verifyToken } from "@/lib/auth/tokens";

/**
 * Keeps the navbar's signed-in hint honest.
 *
 * The header is a client component and the session cookie is httpOnly, so the
 * header reads a second, unprivileged cookie to decide whether to say "Sign
 * in" or "Dashboard / Sign out". That hint used to be written only at sign-in,
 * which left it able to disagree with reality in a way that was not
 * hypothetical: every session created before the hint existed had no hint at
 * all, so the nav offered "Sign in" to people who were signed in — and
 * clicking it landed them on the dashboard, because the server knew perfectly
 * well who they were. A wrong answer that corrects itself only by confusing
 * someone first.
 *
 * So the hint stops being something we remember to set and becomes something
 * derived from the session on every request. The session cookie is the single
 * source of truth; this is a cache of one bit of it, refreshed here.
 *
 * It is still only a display hint. Nothing here decides access — every
 * decision that matters goes through currentClient() during the render, and a
 * forged hint changes a word in the header and nothing else.
 *
 * Why this rather than reading the session in the root layout: that would make
 * every page dynamic, and five of the six are statically prerendered marketing
 * pages whose job is to be indexed and fast. This keeps them static. The
 * remaining cost is honest and unavoidable — cached HTML cannot know who is
 * asking, so a signed-in visitor sees "Sign in" for one paint before the
 * client corrects it.
 */

/** The cookie is rewritten to match the session's own remaining life. */
function hintOptions() {
  return {
    httpOnly: false,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const hintPresent = request.cookies.has(SESSION_HINT_COOKIE);

  // Verified rather than merely counted. A cookie that is present but expired,
  // tampered with, or signed under a rotated secret is not a session, and the
  // header should not claim it is. The check is one HMAC over a short string.
  //
  // If AUTH_JWT_SECRET is missing, verifyToken returns null rather than
  // throwing, so an unconfigured environment degrades to "signed out" instead
  // of failing every request on the site.
  const signedIn = token ? Boolean(await verifyToken(token, "session")) : false;

  // The common case by far: the hint already agrees. Returning without
  // touching the response matters — a Set-Cookie header on a statically
  // cached page is the kind of thing that makes a CDN stop treating it as
  // shareable, and there is no reason to write a cookie that already says
  // what we would write.
  if (signedIn === hintPresent) return NextResponse.next();

  const response = NextResponse.next();

  if (signedIn) {
    response.cookies.set(SESSION_HINT_COOKIE, "1", hintOptions());
  } else {
    // Covers the session expiring on its own, and covers a secret rotation:
    // both leave a hint behind that would otherwise keep offering "Sign out"
    // to someone the server has already stopped recognising.
    response.cookies.delete(SESSION_HINT_COOKIE);
  }

  return response;
}

export const config = {
  /*
   * Everything except the things that are never a page.
   *
   * Without a matcher this runs on `_next/static`, `_next/image` and every
   * file in public/ as well, which would mean verifying a JWT before serving
   * a font. The negative lookahead is the documented way to exclude them.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.png$).*)"],
};
