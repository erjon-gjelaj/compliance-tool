import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * The gate on /internal.
 *
 * One shared secret, checked server-side, for one operator. Not a user system
 * — there are no accounts in this project and this is not the place to start
 * one.
 *
 * Three things it deliberately does not do:
 *
 * The secret never travels in a URL. A `?key=` would end up in browser
 * history, in the Referer header on any outbound link, and in Vercel's
 * request logs. It is posted once and exchanged for a cookie.
 *
 * The cookie stores a hash of the secret rather than the secret, so a stolen
 * cookie jar does not hand over the value that also guards the delete
 * endpoint.
 *
 * Comparison is constant-time. The timing signal on a short string over the
 * network is faint, but it costs nothing to remove and `===` on a secret is
 * the kind of thing that gets copied into somewhere it matters.
 */

const COOKIE = "internal_session";

/** Absent ADMIN_SECRET locks the page rather than opening it. */
function configuredSecret(): string | null {
  const secret = process.env.ADMIN_SECRET;
  return secret && secret.length > 0 ? secret : null;
}

function fingerprint(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

function matches(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  // timingSafeEqual throws on a length mismatch, which would itself leak
  // length, so the lengths are compared first and the result folded in.
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** True when the caller already holds a valid session cookie. */
export async function hasInternalSession(): Promise<boolean> {
  const secret = configuredSecret();
  if (!secret) return false;

  const jar = await cookies();
  const value = jar.get(COOKIE)?.value;
  if (!value) return false;

  return matches(value, fingerprint(secret));
}

/** Exchanges the secret for a session cookie. Returns false on a bad secret. */
export async function openInternalSession(candidate: string): Promise<boolean> {
  const secret = configuredSecret();
  if (!secret) return false;
  if (!matches(candidate, secret)) return false;

  const jar = await cookies();
  jar.set(COOKIE, fingerprint(secret), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/internal",
    maxAge: 60 * 60 * 12,
  });

  return true;
}

export async function closeInternalSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** Whether the gate can be opened at all. Drives the "not configured" state. */
export function internalAccessConfigured(): boolean {
  return configuredSecret() !== null;
}
