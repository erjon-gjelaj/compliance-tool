import { headers } from "next/headers";

/**
 * A fixed-window rate limiter held in module memory.
 *
 * What it is for: a Scope B submission ends in a model call, so every one of
 * them costs money. This makes a script that hammers the endpoint expensive
 * for us in seconds rather than in requests.
 *
 * What it is not. Serverless instances don't share memory, so the real limit
 * is roughly this budget multiplied by however many instances are warm, and
 * a cold start forgets everything. That is a weak guarantee and it is
 * deliberate: it costs nothing, needs no extra service, and turns an
 * unbounded loop into a bounded one. If the site ever takes enough abuse for
 * this to matter, the fix is a shared store (Upstash, or a Postgres table),
 * not a cleverer version of this.
 */

type Window = { count: number; expiresAt: number };

const windows = new Map<string, Window>();

/** Keeps the map from growing without bound on a long-lived instance. */
function sweep(now: number) {
  if (windows.size < 512) return;
  for (const [key, window] of windows) {
    if (window.expiresAt <= now) windows.delete(key);
  }
}

/**
 * The caller's address, as far as we can tell.
 *
 * Behind Vercel this is x-forwarded-for, whose leftmost entry is the client.
 * It is trivially spoofable in general, which is another reason this is a
 * cost guard and not a security control.
 */
export async function callerKey(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || headerList.get("x-real-ip");
  return ip || "unknown";
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfter: number };

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = windows.get(key);

  if (!existing || existing.expiresAt <= now) {
    windows.set(key, { count: 1, expiresAt: now + windowMs });
    return { ok: true };
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      retryAfter: Math.ceil((existing.expiresAt - now) / 1000),
    };
  }

  existing.count += 1;
  return { ok: true };
}

/**
 * Starting an intake creates a row and is the step worth guarding. Later
 * steps update a row that already exists, so they are bounded by how many
 * rows a caller managed to create.
 */
export const INTAKE_START_LIMIT = { limit: 5, windowMs: 10 * 60 * 1000 };

/** Deliberately looser: one person editing their own intake makes several. */
export const INTAKE_STEP_LIMIT = { limit: 60, windowMs: 10 * 60 * 1000 };

/**
 * Requesting a sign-in link.
 *
 * Applied twice per request, on two different keys, because they stop two
 * different things. By address, it stops someone using the form to mail-bomb
 * one contractor — the address is the target and the attacker's own IP is not
 * the limit that matters. By caller, it stops a script walking a list of
 * addresses to find out which ones have an account.
 *
 * Tight numbers on purpose. Nobody legitimately needs a fourth link inside
 * ten minutes, and every send is an email we are paying for and a credential
 * put on the wire.
 */
export const SIGN_IN_EMAIL_LIMIT = { limit: 3, windowMs: 10 * 60 * 1000 };
export const SIGN_IN_CALLER_LIMIT = { limit: 10, windowMs: 10 * 60 * 1000 };
