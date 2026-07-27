import "server-only";

import { cookies } from "next/headers";

import { SESSION_HINT_COOKIE } from "@/lib/auth/cookie-names";

import {
  SESSION_TTL_SECONDS,
  signToken,
  verifyToken,
  type ClientToken,
} from "@/lib/auth/tokens";

/**
 * The client session cookie.
 *
 * A cookie rather than localStorage, and that is load-bearing rather than a
 * preference. The dashboard is rendered on the server, so the server has to
 * know who is asking before it renders anything — localStorage is not
 * readable at that point, which would mean shipping an empty shell and
 * fetching the real content from the browser afterwards. Every page would
 * flash blank, and the documents would arrive over an extra round trip.
 *
 * httpOnly closes the other half of it: no script on the page can read the
 * token, so an injected script cannot post the session somewhere. That is not
 * available to localStorage at all, by construction.
 *
 * sameSite is `lax`, not `strict`, and this is the one place it matters. The
 * sign-in link is clicked in a mail client, which makes the navigation
 * cross-site; under `strict` the browser would withhold the cookie on the way
 * back and the person would land on the dashboard signed out, having just
 * signed in. `lax` still withholds it on cross-site POSTs, which is the CSRF
 * case worth caring about.
 */

const COOKIE = "certloop_session";

/**
 * A second cookie that exists only so the navbar can say "Sign out".
 *
 * It carries no authority whatsoever. It is not signed, it is not httpOnly,
 * anyone can set it in a console, and nothing server-side ever reads it — the
 * real session is COOKIE above and every access decision goes through
 * currentClient(). Forging this one changes a word in the header and nothing
 * else, which is exactly the amount of power it is meant to have.
 *
 * It exists because the alternatives are worse. The header is a client
 * component and cannot read an httpOnly cookie; reading the session in the
 * root layout instead would make every page dynamic, and five of the six are
 * static marketing pages whose whole job is to be indexed and fast. Fetching
 * a /api/session endpoint on mount would cost a request on every page load.
 * This costs nothing and leaks nothing: whether you are signed in is already
 * obvious to whoever is holding the browser.
 *
 * It can go stale — rotating AUTH_JWT_SECRET invalidates the session but
 * leaves this behind, so the header would offer "Sign out" to someone already
 * signed out. That heals itself on the click: signing out clears both and
 * lands on the sign-in page, which is where they needed to go anyway.
 *
 * The name lives in lib/auth/cookie-names.ts because the header needs it too
 * and this module is deliberately server-only.
 */
const HINT_COOKIE = SESSION_HINT_COOKIE;

export type ClientSession = {
  email: string;
  /** When the seven days run out, as a Date, for the "signed in until" line. */
  expiresAt: Date;
};

function toSession(token: ClientToken): ClientSession {
  return { email: token.email, expiresAt: new Date(token.expiresAt * 1000) };
}

/** Mints a fresh seven-day session and writes it to the cookie jar. */
export async function openClientSession(email: string): Promise<void> {
  const token = await signToken(email, "session");
  const jar = await cookies();

  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // Matched to the token's own expiry. The cookie lifetime is a hint to the
    // browser and the token's `exp` is what is actually enforced, but leaving
    // a dead cookie in the jar would mean every request carrying a token that
    // is only going to be rejected.
    maxAge: SESSION_TTL_SECONDS,
  });

  // Same lifetime as the session it describes, so the two expire together and
  // the header stops offering "Sign out" at the moment it stops being true.
  jar.set(HINT_COOKIE, "1", {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function closeClientSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
  jar.delete(HINT_COOKIE);
}

/**
 * Who is asking, or null.
 *
 * The only way anything server-side learns the caller's identity. Note it
 * re-verifies the signature on every call rather than trusting that the
 * cookie was ours because it is in our jar — a cookie is client-controlled
 * storage and the signature is the only thing that makes it evidence.
 */
export async function currentClient(): Promise<ClientSession | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;

  const token = await verifyToken(raw, "session");
  if (!token) return null;

  return toSession(token);
}
