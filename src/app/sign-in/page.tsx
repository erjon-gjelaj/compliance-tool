import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, MailCheck } from "lucide-react";

import { CONTACT_EMAIL, SITE_NAME } from "@/lib/constants";
import { GAP_CHECK_HREF } from "@/lib/nav";
import { pageMetadata } from "@/lib/metadata";
import { currentClient } from "@/lib/auth/session";
import { requestSignInLink } from "@/app/sign-in/actions";

/**
 * Sign-in: one field, one button, no password.
 *
 * There is nothing to remember and nothing to reset, which is the point. The
 * people using this are estimators and owners on a phone in a truck, mid-way
 * through a prequalification they did not ask for, and a password they would
 * set once and never use again is a barrier that protects nothing here — the
 * email address is already the thing that proves the documents are theirs,
 * because it is the address they were sent to.
 */

export const metadata = pageMetadata({
  title: "Sign in",
  description: `Open your ${SITE_NAME} dashboard to read the documents you sent and the preliminary review produced from them.`,
  path: "/sign-in",
  // Nothing here should be indexed or followed: it is an account door, not a
  // page anyone should arrive at from a search result.
  robots: { index: false, follow: false },
});

// Reads a cookie, so it can never be prerendered.
export const dynamic = "force-dynamic";

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-6 py-16">
      <div className="border border-zinc-dust bg-paper p-8">{children}</div>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 text-sm text-slate-wash underline-offset-4 hover:underline"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" />
        Back to {SITE_NAME}
      </Link>
    </main>
  );
}

/** What went wrong, in the person's terms rather than ours. */
const ERRORS: Record<string, string> = {
  address: "That doesn't look like a working email address.",
  expired:
    "That link has expired or has already been used. Ask for a new one below.",
  unavailable:
    "Sign-in isn't available right now. This is a fault at our end, not yours.",
};

function Sent({ email }: { email: string }) {
  return (
    <Panel>
      <MailCheck aria-hidden className="mb-4 h-6 w-6 text-verdigris" />
      <h1 className="type-h3 text-millscale">Check your email</h1>
      <p className="type-body mt-3">
        If <span className="font-medium text-millscale">{email}</span> has sent
        us a gap check, a sign-in link is on its way. It works for 15 minutes.
      </p>
      <p className="type-body mt-3">
        Nothing yet after a few minutes? Check the spam folder, confirm the
        address above is the one you filled the form in with, or email us at{" "}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="text-verdigris underline underline-offset-4"
        >
          {CONTACT_EMAIL}
        </a>
        .
      </p>
      <Link
        href="/sign-in"
        className="mt-6 inline-block text-sm font-medium text-verdigris underline underline-offset-4"
      >
        Use a different address
      </Link>
    </Panel>
  );
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{
    sent?: string;
    error?: string;
    signedout?: string;
  }>;
}) {
  // Already signed in is not an error, it is someone who bookmarked the wrong
  // page. Send them where they were going.
  if (await currentClient()) redirect("/dashboard");

  const { sent, error, signedout } = await searchParams;

  if (sent) return <Sent email={sent} />;

  return (
    <Panel>
      <h1 className="type-h3 text-millscale">Open your dashboard</h1>
      <p className="type-body mt-3">
        Your documents and your review live behind the email address you filled
        the gap check in with. Enter it and we&rsquo;ll send a link &mdash;
        there is no password to remember.
      </p>

      {signedout ? (
        <p className="mt-4 border-l-2 border-verdigris bg-galvanise px-3 py-2 text-sm text-millscale">
          You&rsquo;re signed out on this device.
        </p>
      ) : null}

      <form action={requestSignInLink} className="mt-6">
        <label htmlFor="email" className="type-label block text-millscale">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          maxLength={254}
          aria-describedby={error ? "sign-in-error" : undefined}
          className="mt-2 w-full border border-zinc-dust bg-galvanise px-3 py-2 text-sm text-millscale"
        />

        {error ? (
          <p id="sign-in-error" role="alert" className="mt-3 text-sm text-rust-flag">
            {ERRORS[error] ?? ERRORS.unavailable}
          </p>
        ) : null}

        <button type="submit" className="btn-primary mt-5 w-full">
          Email me a link
        </button>
      </form>

      <p className="type-body mt-6 border-t border-zinc-dust pt-5">
        Haven&rsquo;t sent us anything yet? Start with the{" "}
        <Link
          href={GAP_CHECK_HREF}
          className="text-verdigris underline underline-offset-4"
        >
          free gap check
        </Link>{" "}
        &mdash; the dashboard opens once you have.
      </p>
    </Panel>
  );
}
