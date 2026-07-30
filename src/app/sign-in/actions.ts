"use server";

import { redirect, RedirectType } from "next/navigation";
import { cookies } from "next/headers";

import { SITE_URL } from "@/lib/constants";
import { emailHasSubmissions, emailHasWorkspace } from "@/lib/dashboard";
import {
  sendSignInCode,
  sendSignInLink,
  smtpConfigured,
} from "@/lib/notify";
import {
  SIGN_IN_CALLER_LIMIT,
  SIGN_IN_EMAIL_LIMIT,
  callerKey,
  rateLimit,
} from "@/lib/rate-limit";
import {
  SIGN_IN_TTL_SECONDS,
  SIGN_IN_CODE_MAX_ATTEMPTS,
  SIGN_IN_CODE_TTL_SECONDS,
  authConfigured,
  createSignInCodeChallenge,
  generateSignInCode,
  incrementSignInCodeAttempts,
  normaliseEmail,
  signInCodeMatches,
  signToken,
  verifySignInCodeChallenge,
} from "@/lib/auth/tokens";
import { closeClientSession } from "@/lib/auth/session";
import { signOutDestination } from "@/lib/auth/sign-out-destination";
import { SIGN_IN_CODE_COOKIE } from "@/lib/auth/cookie-names";
import { openClientSession } from "@/lib/auth/session";

/**
 * Requesting a sign-in link, and signing out.
 *
 * The important property of the whole file is that the visible outcome of
 * requesting a link does not depend on whether the address has anything
 * behind it. Same message, same redirect, whether we sent an email, decided
 * not to, or were rate limited.
 *
 * That is not politeness. This form is public and the addresses behind it
 * belong to small contractors; an honest "no submissions for that address"
 * turns it into an oracle that confirms, one address at a time, who has sent
 * us their safety paperwork. The cost is that a typo looks identical to
 * success, which is why the confirmation says which address it went to and
 * offers a way back to correct it.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const MAX_EMAIL = 254;

export async function requestSignInLink(formData: FormData): Promise<never> {
  const raw = String(formData.get("email") ?? "");
  const email = normaliseEmail(raw);

  // The one thing worth telling them apart from the generic message: a
  // malformed address is their own typo, and no link could ever arrive.
  if (!email || email.length > MAX_EMAIL || !EMAIL_PATTERN.test(email)) {
    redirect("/sign-in?error=address");
  }

  // Both of these are deployment faults rather than facts about this address:
  // they are the same for everybody, so showing them tells a prober nothing
  // and saves the person waiting for an email that was never going to be
  // sent. Checked before anything address-specific happens.
  if (!authConfigured()) {
    console.error("Sign-in requested but AUTH_JWT_SECRET is not set.");
    redirect("/sign-in?error=unavailable");
  }

  if (!smtpConfigured()) {
    console.error("Sign-in requested but SMTP is not configured.");
    redirect("/sign-in?error=unavailable");
  }

  const method = formData.get("method") === "code" ? "code" : "link";
  const sent =
    method === "code"
      ? `/sign-in?code_sent=${encodeURIComponent(email)}`
      : `/sign-in?sent=${encodeURIComponent(email)}`;

  const jar = await cookies();
  if (method === "code") jar.delete(SIGN_IN_CODE_COOKIE);

  const caller = await callerKey();

  // Both limits fail closed into the same confirmation. Someone being
  // throttled learns nothing they could not have learned by waiting.
  if (!rateLimit(`signin:ip:${caller}`, SIGN_IN_CALLER_LIMIT).ok) {
    console.warn(`Sign-in link requests throttled for caller ${caller}.`);
    redirect(sent);
  }

  if (!rateLimit(`signin:email:${email}`, SIGN_IN_EMAIL_LIMIT).ok) {
    console.warn("Sign-in link requests throttled for an address.");
    redirect(sent);
  }

  // Checked before signing, so an address with nothing behind it never
  // receives a working token. It costs one query to avoid mailing a
  // credential to someone who never gave us anything.
  if (!(await emailHasSubmissions(email)) && !(await emailHasWorkspace(email))) {
    console.warn("Sign-in link requested for an address with no submissions.");
    redirect(sent);
  }

  let delivered: boolean;
  if (method === "code") {
    const code = generateSignInCode();
    const challenge = await createSignInCodeChallenge(email, code);
    jar.set(SIGN_IN_CODE_COOKIE, challenge, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/sign-in",
      maxAge: SIGN_IN_CODE_TTL_SECONDS,
    });
    delivered = await sendSignInCode(
      email,
      code,
      SIGN_IN_CODE_TTL_SECONDS / 60,
    );
    if (!delivered) jar.delete(SIGN_IN_CODE_COOKIE);
  } else {
    const token = await signToken(email, "sign-in");
    const url = `${SITE_URL}/sign-in/verify?token=${encodeURIComponent(token)}`;
    delivered = await sendSignInLink(email, url, SIGN_IN_TTL_SECONDS / 60);
  }

  // An individual send failing does NOT change the response, even though it
  // means the person is now waiting for nothing. Surfacing it would be an
  // oracle: a stranger's request never reaches this line, so "send failed"
  // would mean "this address is one of ours" every time it appeared. The
  // uniform confirmation names the support address for exactly this case.
  if (!delivered) {
    console.error("A sign-in link could not be delivered; the caller was not told.");
  }

  redirect(sent);
}

export async function verifySignInCode(formData: FormData): Promise<never> {
  const jar = await cookies();
  const rawChallenge = jar.get(SIGN_IN_CODE_COOKIE)?.value;
  const suppliedEmail = normaliseEmail(String(formData.get("email") ?? ""));
  const destination = `/sign-in?code_sent=${encodeURIComponent(suppliedEmail)}`;
  const code = String(formData.get("code") ?? "").replace(/\s/g, "");

  const challenge = rawChallenge
    ? await verifySignInCodeChallenge(rawChallenge)
    : null;
  if (!challenge) {
    jar.delete(SIGN_IN_CODE_COOKIE);
    redirect("/sign-in?error=code_expired");
  }

  if (!/^\d{6}$/.test(code) || !signInCodeMatches(challenge, code)) {
    const attempts = challenge.attempts + 1;
    if (attempts >= SIGN_IN_CODE_MAX_ATTEMPTS) {
      jar.delete(SIGN_IN_CODE_COOKIE);
      redirect("/sign-in?error=code_attempts");
    }

    const updated = await incrementSignInCodeAttempts(challenge);
    jar.set(SIGN_IN_CODE_COOKIE, updated, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/sign-in",
      maxAge: Math.max(
        1,
        challenge.expiresAt - Math.floor(Date.now() / 1000),
      ),
    });
    redirect(`${destination}&error=code`);
  }

  jar.delete(SIGN_IN_CODE_COOKIE);
  await openClientSession(challenge.email);
  redirect("/dashboard");
}

export async function signOut(formData: FormData): Promise<never> {
  await closeClientSession();
  redirect(
    signOutDestination(formData.get("return_to")),
    RedirectType.replace,
  );
}
