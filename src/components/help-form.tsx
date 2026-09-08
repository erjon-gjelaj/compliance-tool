"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Check } from "lucide-react";

import { requestHelp, type HelpState } from "@/app/dashboard/help/actions";
import { SubmitButton } from "@/components/submit-button";
import { SERVICE_KINDS, SERVICE_LABELS } from "@/lib/service-kinds";
import { PROGRAMS_PRODUCT, formatPrice } from "@/lib/billing/catalog";

/**
 * Asking for work that a person does by hand.
 *
 * This is where a checkout would eventually go, and deliberately is not one.
 * There is no price, no plan comparison and no "upgrade" — none of those
 * exist, and implying otherwise would be the first dishonest thing in the
 * product. What it does is capture what someone wants at the moment they want
 * it, and say plainly that a person will answer.
 */

const initial: HelpState = { status: "editing" };

export function HelpForm({ submissionId }: { submissionId?: string }) {
  const [state, formAction] = useActionState(requestHelp, initial);

  if (state.status === "sent") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="border border-verdigris bg-paper p-6 md:p-8"
      >
        <Check aria-hidden className="h-6 w-6 text-verdigris" />
        <h2 className="type-h3 mt-4 text-millscale">That&rsquo;s with us</h2>
        <p className="type-body mt-3">
          A person reads these and will reply to the address you signed in with.
          Nothing has been charged and nothing is scheduled &mdash; the reply
          comes first, and it will say what the work involves.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="border border-zinc-dust bg-paper p-6 md:p-8">
      {submissionId ? (
        <input type="hidden" name="submission_id" value={submissionId} />
      ) : null}

      <fieldset>
        <legend className="type-label text-millscale">
          What do you need a hand with?
        </legend>
        <div className="mt-3 grid gap-2">
          {SERVICE_KINDS.map((kind, index) => (
            <label
              key={kind}
              className="flex cursor-pointer items-center gap-3 border border-zinc-dust px-4 py-3 text-sm text-millscale hover:border-verdigris"
            >
              <input
                type="radio"
                name="kind"
                value={kind}
                defaultChecked={index === 0}
                className="h-3.5 w-3.5"
              />
              {SERVICE_LABELS[kind]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-6">
        <label className="type-label block text-millscale" htmlFor="note">
          Anything we should know?{" "}
          <span className="font-normal text-slate-wash">(optional)</span>
        </label>
        <p className="mt-1 mb-2 text-sm text-slate-wash">
          A date you&rsquo;re working to, which client is asking, what came back
          from them &mdash; whatever makes the reply useful.
        </p>
        <textarea
          id="note"
          name="note"
          rows={5}
          maxLength={2000}
          className="w-full border border-zinc-dust bg-galvanise px-3 py-2 text-sm text-millscale"
        />
      </div>

      {state.error ? (
        <p role="alert" className="mt-4 text-sm text-rust-flag">
          {state.error}
        </p>
      ) : null}

      <SubmitButton pendingLabel="Sending…" className="btn-primary mt-6">
        Send it
      </SubmitButton>

      {/*
        The price sits next to the ask rather than only on the pricing page.
        Somebody deciding whether to send this wants to know what they are
        getting into, and making them open another tab to find out is how a
        request gets abandoned. Read from the catalog, so it cannot drift from
        what Stripe charges.
      */}
      <div className="mt-6 border-t border-zinc-dust pt-5">
        <p className="type-body">
          If what you need is the written programs, you don&rsquo;t have to ask
          &mdash; they&rsquo;re {formatPrice(PROGRAMS_PRODUCT)} for all of them
          and you can build them yourself in a couple of minutes.
        </p>
        <Link
          href="/dashboard/programs"
          className="mt-2 inline-block text-sm font-medium text-verdigris underline-offset-4 hover:underline"
        >
          See the programs
        </Link>
      </div>

      <p className="mt-4 text-sm text-slate-wash">
        Use this for anything else &mdash; a rejection you can&rsquo;t make
        sense of, a client asking for something unusual, or a program we
        don&rsquo;t prepare yet.
      </p>

    </form>
  );
}
