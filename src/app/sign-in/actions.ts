"use server";

import { redirect } from "next/navigation";

import { SITE_URL } from "@/lib/constants";
import { emailHasSubmissions } from "@/lib/dashboard";
import { sendSignInLink, smtpConfigured } from "@/lib/notify";
import {
  SIGN_IN_CALLER_LIMIT,
  SIGN_IN_EMAIL_LIMIT,
  callerKey,
  rateLimit,
} from "@/lib/rate-limit";
import {
  SIGN_IN_TTL_SECONDS,
  authConfigured,
  normaliseEmail,
  signToken,
} from "@/lib/auth/tokens";
import { closeClientSession } from "@/lib/auth/session";

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

  const sent = `/sign-in?sent=${encodeURIComponent(email)}`;

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
  if (!(await emailHasSubmissions(email))) {
    console.warn("Sign-in link requested for an address with no submissions.");
    redirect(sent);
  }

  const token = await signToken(email, "sign-in");
  const url = `${SITE_URL}/sign-in/verify?token=${encodeURIComponent(token)}`;

  const delivered = await sendSignInLink(email, url, SIGN_IN_TTL_SECONDS / 60);

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

export async function signOut(): Promise<never> {
  await closeClientSession();
  redirect("/sign-in?signedout=1");
}
