import "server-only";

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Signing and verifying the two tokens this project uses.
 *
 * Both are JWTs signed with one HMAC secret, and nothing about a session is
 * stored in the database — the token is the session. That is a deliberate
 * trade and it is worth being honest about what it costs:
 *
 *  - There is no way to revoke one token. Signing out clears the cookie in
 *    that browser; a copy of the cookie taken beforehand keeps working until
 *    it expires. The only global revocation is rotating AUTH_JWT_SECRET,
 *    which signs everyone out at once.
 *  - So the expiry is the whole security budget. Seven days for the session
 *    is what was asked for; the sign-in link is deliberately much shorter,
 *    because a link sits in an inbox and inboxes get forwarded, backed up and
 *    breached.
 *
 * `purpose` exists so the two can never be swapped. Without it a sign-in link
 * token would be a perfectly valid session cookie — same secret, same issuer
 * — and a fifteen-minute token would silently become a seven-day one. It is
 * checked on the way in, not just written on the way out.
 */

const ISSUER = "certloop";

export type TokenPurpose =
  | "session"
  | "sign-in"
  | "sign-in-code"
  | "company-invite";

/** How long each kind of token lives. The link is short on purpose. */
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
export const SIGN_IN_TTL_SECONDS = 15 * 60;
export const SIGN_IN_CODE_TTL_SECONDS = 10 * 60;
export const SIGN_IN_CODE_MAX_ATTEMPTS = 5;
export const COMPANY_INVITE_TTL_SECONDS = 7 * 24 * 60 * 60;

export type ClientToken = {
  /** The email address the token speaks for, already normalised. */
  email: string;
  purpose: TokenPurpose;
  /** Seconds since the epoch, from the token itself. */
  expiresAt: number;
};

/**
 * Addresses are compared as identity here, so they have to be compared the
 * same way every time.
 *
 * Only the domain is lowercased and whitespace trimmed. The local part is
 * left alone: it is case-sensitive per RFC 5321, and stripping dots or plus
 * tags — the usual "normalisation" — would let one person claim another
 * person's submissions at providers that treat them as distinct.
 */
export function normaliseEmail(raw: string): string {
  const trimmed = raw.trim();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0) return trimmed;

  return `${trimmed.slice(0, at)}@${trimmed.slice(at + 1).toLowerCase()}`;
}

/**
 * The signing key.
 *
 * Absent or too short is a hard error rather than a fallback to some default.
 * A development default is exactly the kind of thing that reaches production
 * once and forges everybody's session, and there is no safe placeholder for
 * this value.
 *
 * 32 characters is the floor because the secret is the entire security of
 * every token; HS256 with a guessable passphrase is worse than no auth at
 * all, because it looks like auth.
 */
const MIN_SECRET_LENGTH = 32;

let cachedKey: Uint8Array | null = null;

function signingKey(): Uint8Array {
  if (cachedKey) return cachedKey;

  const secret = process.env.AUTH_JWT_SECRET?.trim();

  if (!secret) {
    throw new Error(
      "AUTH_JWT_SECRET is not set. Client sign-in cannot work without it — " +
        "generate one with: openssl rand -base64 48",
    );
  }

  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `AUTH_JWT_SECRET is ${secret.length} characters; ${MIN_SECRET_LENGTH} ` +
        "is the minimum. Generate one with: openssl rand -base64 48",
    );
  }

  cachedKey = new TextEncoder().encode(secret);
  return cachedKey;
}

/** Whether sign-in can work at all in this environment. Drives the "not configured" state. */
export function authConfigured(): boolean {
  try {
    signingKey();
    return true;
  } catch {
    return false;
  }
}

export async function signToken(
  email: string,
  purpose: TokenPurpose,
): Promise<string> {
  const ttl =
    purpose === "session"
      ? SESSION_TTL_SECONDS
      : purpose === "company-invite"
        ? COMPANY_INVITE_TTL_SECONDS
        : purpose === "sign-in-code"
          ? SIGN_IN_CODE_TTL_SECONDS
        : SIGN_IN_TTL_SECONDS;

  return new SignJWT({ purpose } satisfies JWTPayload & { purpose: TokenPurpose })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(purpose)
    .setSubject(normaliseEmail(email))
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(signingKey());
}

export type EmailCodeChallenge = ClientToken & {
  purpose: "sign-in-code";
  digest: string;
  attempts: number;
};

function digestCode(code: string): string {
  return createHmac("sha256", signingKey()).update(code).digest("base64url");
}

export function generateSignInCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

async function signCodeChallenge({
  email,
  digest,
  attempts,
  expiresAt,
}: {
  email: string;
  digest: string;
  attempts: number;
  expiresAt?: number;
}): Promise<string> {
  return new SignJWT({
    purpose: "sign-in-code",
    code_digest: digest,
    attempts,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience("sign-in-code")
    .setSubject(normaliseEmail(email))
    .setIssuedAt()
    .setExpirationTime(expiresAt ?? `${SIGN_IN_CODE_TTL_SECONDS}s`)
    .sign(signingKey());
}

export async function createSignInCodeChallenge(
  email: string,
  code: string,
): Promise<string> {
  return signCodeChallenge({ email, digest: digestCode(code), attempts: 0 });
}

export async function verifySignInCodeChallenge(
  token: string,
): Promise<EmailCodeChallenge | null> {
  try {
    const { payload } = await jwtVerify(token, signingKey(), {
      issuer: ISSUER,
      audience: "sign-in-code",
      algorithms: ["HS256"],
    });

    if (payload.purpose !== "sign-in-code") return null;
    if (typeof payload.sub !== "string" || !payload.sub) return null;
    if (typeof payload.exp !== "number") return null;
    if (typeof payload.code_digest !== "string") return null;
    if (
      typeof payload.attempts !== "number" ||
      !Number.isInteger(payload.attempts) ||
      payload.attempts < 0
    ) {
      return null;
    }

    return {
      email: payload.sub,
      purpose: "sign-in-code",
      expiresAt: payload.exp,
      digest: payload.code_digest,
      attempts: payload.attempts,
    };
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : "unknown";
    console.warn(`Rejected a sign-in-code token: ${reason}`);
    return null;
  }
}

export function signInCodeMatches(
  challenge: EmailCodeChallenge,
  code: string,
): boolean {
  const expected = Buffer.from(challenge.digest);
  const received = Buffer.from(digestCode(code));
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}

export async function incrementSignInCodeAttempts(
  challenge: EmailCodeChallenge,
): Promise<string> {
  return signCodeChallenge({
    email: challenge.email,
    digest: challenge.digest,
    attempts: challenge.attempts + 1,
    expiresAt: challenge.expiresAt,
  });
}

/**
 * Verifies a token and confirms it is the kind we asked for.
 *
 * Returns null for every failure — expired, tampered, wrong purpose, missing
 * secret — rather than distinguishing them. The caller has one decision to
 * make and telling a prober which of those went wrong helps only the prober.
 * The reason is logged server-side.
 */
export async function verifyToken(
  token: string,
  purpose: TokenPurpose,
): Promise<ClientToken | null> {
  try {
    const { payload } = await jwtVerify(token, signingKey(), {
      issuer: ISSUER,
      audience: purpose,
      algorithms: ["HS256"],
    });

    // Belt and braces over the audience check above: `alg` is pinned so a
    // token cannot arrive claiming `none`, and `purpose` is read from the
    // body so a mismatch fails even if the audience were ever loosened.
    if (payload.purpose !== purpose) return null;
    if (typeof payload.sub !== "string" || payload.sub.length === 0) return null;
    if (typeof payload.exp !== "number") return null;

    return { email: payload.sub, purpose, expiresAt: payload.exp };
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : "unknown";
    console.warn(`Rejected a ${purpose} token: ${reason}`);
    return null;
  }
}
