"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, X } from "lucide-react";

import {
  decideOnQuote,
  type QuoteDecisionState,
} from "@/app/dashboard/requests/actions";
import { Spinner } from "@/components/spinner";
import { formatQuote, type RequestEvent } from "@/lib/requests/state";

/**
 * A price, and the two things a customer can do about it.
 *
 * Written to be readable by somebody who did not ask for this email and does
 * not know what happens if they press the button. Three facts sit above the
 * buttons on purpose — the price, that nothing is charged automatically, and
 * that accepting starts an invoice rather than a payment — because the single
 * biggest reason a small contractor abandons a screen like this is not knowing
 * whether the next click takes their money.
 *
 * The range is shown as it was quoted. Collapsing "$149–$299" to "from $149"
 * would read as cheaper than the thing they are agreeing to.
 */

const initial: QuoteDecisionState = { status: "idle" };

/**
 * Why this is not the shared SubmitButton.
 *
 * `useFormStatus` reports that *the form* is submitting, not which button did
 * it. With Accept and Decline in one form, the shared component would put
 * "Recording…" on both — so clicking Accept would make Decline appear to be
 * running too. On a screen about money that reads as "did I just decline?",
 * which is the worst possible ambiguity here.
 *
 * So the clicked value is tracked locally and only that button shows the
 * pending state. Both still disable, because the form really is in flight.
 * With JavaScript off there is no pending state and the form posts anyway —
 * `name`/`value` on a submit button is what carries the decision, not script.
 */
function DecisionButton({
  decision,
  pressed,
  onPress,
  className,
  children,
  icon,
}: {
  decision: "accept" | "decline";
  pressed: string | null;
  onPress: (decision: string) => void;
  className: string;
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  const isThisOne = pending && pressed === decision;

  return (
    <button
      type="submit"
      name="decision"
      value={decision}
      disabled={pending}
      onClick={() => onPress(decision)}
      className={`${className} disabled:opacity-60`}
    >
      {isThisOne ? "Recording…" : children}
      {isThisOne ? <Spinner /> : icon}
    </button>
  );
}

export function QuoteDecision({
  requestId,
  quote,
}: {
  requestId: string;
  quote: RequestEvent;
}) {
  const [state, formAction] = useActionState(decideOnQuote, initial);
  const [pressed, setPressed] = useState<string | null>(null);

  const amount = formatQuote(quote);

  /*
   * Once answered, the card is replaced by the outcome rather than left on
   * screen with disabled buttons. A dead control is a worse answer to "what
   * did I just do" than a sentence saying what happened.
   */
  if (state.status === "done") {
    return (
      <div role="status" className="border border-verdigris bg-paper p-4 sm:p-5">
        <p className="type-body text-millscale">
          Thanks &mdash; that&rsquo;s recorded. We&rsquo;ll pick this up and come
          back to you here.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-verdigris bg-paper p-4 sm:p-5">
      <p className="type-label text-slate-wash">A price for this work</p>

      <p className="mt-2 text-3xl font-semibold tracking-tight text-millscale">
        {amount ?? "No price attached"}
      </p>

      {quote.body ? (
        <p className="type-body mt-3 whitespace-pre-wrap text-millscale">
          {quote.body}
        </p>
      ) : null}

      <p className="mt-3 text-sm text-slate-wash">
        Nothing is charged automatically and we hold no card for you. If you
        accept, we send an invoice and start the work. If the range needs
        narrowing before you decide, ask below instead.
      </p>

      <form
        action={formAction}
        className="mt-4 flex flex-wrap items-center gap-2.5"
      >
        <input type="hidden" name="request_id" value={requestId} />

        <DecisionButton
          decision="accept"
          pressed={pressed}
          onPress={setPressed}
          className="btn-primary inline-flex items-center gap-2"
          icon={<Check aria-hidden className="h-4 w-4" />}
        >
          Accept {amount ?? "this"}
        </DecisionButton>

        <DecisionButton
          decision="decline"
          pressed={pressed}
          onPress={setPressed}
          className="inline-flex items-center gap-2 border border-zinc-dust px-4 py-2.5 text-sm font-medium text-slate-wash transition-colors hover:border-slate-wash hover:text-millscale"
          icon={<X aria-hidden className="h-4 w-4" />}
        >
          Decline
        </DecisionButton>
      </form>

      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-rust-flag">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
