"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { requestHelp, type HelpState } from "@/app/dashboard/help/actions";
import { SubmitButton } from "@/components/submit-button";
import { MANUAL_SERVICE_KINDS, SERVICE_LABELS } from "@/lib/service-kinds";
import { ONE_TIME_SERVICES, PRICING_NOTE, formatMoney } from "@/lib/pricing";

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
const HUMAN_OFFERS = ONE_TIME_SERVICES.filter(
  (offer) => offer.id === "rejection_fix",
);

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
    <div className="grid gap-4">
      <section className="border-l-2 border-verdigris bg-paper p-6 md:p-8">
        <p className="tag">Automatic</p>
        <h2 className="type-h3 mt-2 text-millscale">Prepare a safety program</h2>
        <p className="type-body mt-2 max-w-xl">
          Choose a program, answer a few questions about how your company
          works, and receive finished Word and PDF files.
        </p>
        <Link
          href="/dashboard/programs"
          className="btn-primary mt-5 inline-flex items-center gap-2"
        >
          Choose a program
          <ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
      </section>

      <form action={formAction} className="border border-zinc-dust bg-paper p-6 md:p-8">
      {submissionId ? (
        <input type="hidden" name="submission_id" value={submissionId} />
      ) : null}

      <fieldset>
        <legend className="type-label text-millscale">
          Ask a person for help
        </legend>
        <div className="mt-3 grid gap-2">
          {MANUAL_SERVICE_KINDS.map((kind, index) => (
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
        The ranges are shown here, next to the ask, rather than only on the
        pricing page. Someone deciding whether to send this wants to know
        roughly what they are getting into, and making them open another tab
        to find out is how a request gets abandoned. Read from lib/pricing, so
        these cannot drift from the pricing page.
      */}
      <div className="mt-6 border-t border-zinc-dust pt-5">
        <p className="type-label text-millscale">Roughly what human work costs</p>
        <ul className="mt-3 grid gap-1.5">
          {HUMAN_OFFERS.map((offer) => (
            <li
              key={offer.id}
              className="flex justify-between gap-4 text-sm text-slate-wash"
            >
              <span>{offer.name}</span>
              <span className="text-millscale">{formatMoney(offer.price)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-slate-wash">{PRICING_NOTE}</p>
      </div>

      <p className="mt-4 text-sm text-slate-wash">
        This asks a person to get in touch. There is no payment step, and
        nothing here signs you up to anything.
      </p>
      </form>
    </div>
  );
}
