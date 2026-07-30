import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, MailCheck } from "lucide-react";

import { CONTACT_EMAIL, SITE_NAME } from "@/lib/constants";
import { GAP_CHECK_HREF } from "@/lib/nav";
import { pageMetadata } from "@/lib/metadata";
import { currentClient } from "@/lib/auth/session";
import {
  requestSignInLink,
  verifySignInCode,
} from "@/app/sign-in/actions";
import { SubmitButton } from "@/components/submit-button";

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
  code_expired: "That code has expired. Ask for a new one below.",
  code_attempts: "Too many incorrect attempts. Ask for a new code below.",
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

function CodeSent({ email, error }: { email: string; error?: string }) {
  return (
    <Panel>
      <MailCheck aria-hidden className="mb-4 h-6 w-6 text-verdigris" />
      <h1 className="type-h3 text-millscale">Enter your sign-in code</h1>
      <p className="type-body mt-3">
        If <span className="font-medium text-millscale">{email}</span> has a
        workspace, a six-digit code is on its way. It works for 10 minutes.
      </p>
      <form action={verifySignInCode} className="mt-6">
        <input type="hidden" name="email" value={email} />
        <label htmlFor="code" className="type-label block text-millscale">
          Six-digit code
        </label>
        <input
          id="code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoFocus
          aria-describedby={error ? "code-error" : undefined}
          className="mt-2 w-full border border-zinc-dust bg-galvanise px-3 py-3 text-center text-2xl tracking-[0.35em] text-millscale"
        />
        {error === "code" ? (
          <p id="code-error" role="alert" className="mt-3 text-sm text-rust-flag">
            That code isn&rsquo;t right. Check the email and try again.
          </p>
        ) : null}
        <SubmitButton pendingLabel="Checking code…" className="btn-primary mt-5 w-full">
          Sign in
        </SubmitButton>
      </form>
      <Link
        href="/sign-in"
        className="mt-6 inline-block text-sm font-medium text-verdigris underline underline-offset-4"
      >
        Use another method
      </Link>
    </Panel>
  );
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{
    sent?: string;
    code_sent?: string;
    error?: string;
  }>;
}) {
  // Already signed in is not an error, it is someone who bookmarked the wrong
  // page. Send them where they were going.
  if (await currentClient()) redirect("/dashboard");

  const { sent, code_sent: codeSent, error } = await searchParams;

  if (sent) return <Sent email={sent} />;
  if (codeSent) return <CodeSent email={codeSent} error={error} />;

  return (
    <Panel>
      <h1 className="type-h3 text-millscale">Open your dashboard</h1>
      <p className="type-body mt-3">
        Your documents and review live behind your email address. Choose a
        magic link or a six-digit code &mdash; there is no password to
        remember.
      </p>

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

        <fieldset className="mt-5">
          <legend className="type-label text-millscale">
            How should we sign you in?
          </legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="cursor-pointer border border-zinc-dust p-3 text-sm text-millscale has-checked:border-verdigris has-checked:bg-verdigris/8">
              <input
                type="radio"
                name="method"
                value="link"
                defaultChecked
                className="mr-2"
              />
              Magic link
            </label>
            <label className="cursor-pointer border border-zinc-dust p-3 text-sm text-millscale has-checked:border-verdigris has-checked:bg-verdigris/8">
              <input type="radio" name="method" value="code" className="mr-2" />
              Email code
            </label>
          </div>
        </fieldset>

        {error ? (
          <p id="sign-in-error" role="alert" className="mt-3 text-sm text-rust-flag">
            {ERRORS[error] ?? ERRORS.unavailable}
          </p>
        ) : null}

        {/*
          Worth a pending state more than most buttons here: this one sends an
          email, and the wait is a network round trip plus an SMTP handshake.
          Without feedback the honest response to a dead-looking button is to
          press it again, and three presses is the per-address rate limit.
        */}
        <SubmitButton
          pendingLabel="Sending…"
          className="btn-primary mt-5 w-full"
        >
          Continue
        </SubmitButton>
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
