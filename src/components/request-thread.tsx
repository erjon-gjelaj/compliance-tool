"use client";

import { useActionState } from "react";

import { replyToRequest, type ReplyState } from "@/app/dashboard/requests/actions";
import { QuoteDecision } from "@/components/quote-decision";
import { SubmitButton } from "@/components/submit-button";
import { SITE_NAME } from "@/lib/constants";
import { formatQuote, liveQuote, type RequestEvent } from "@/lib/requests/state";

/**
 * The conversation on a request.
 *
 * Only the events that a customer would recognise as something happening are
 * shown. `in_review` and `completed` are real state changes but they are not
 * messages, so they render as a thin line of activity rather than as a card
 * pretending somebody said something.
 */

const initial: ReplyState = { status: "editing" };

function when(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const MARKER_COPY: Record<string, string> = {
  in_review: `${SITE_NAME} picked this up`,
  draft_ready: "A draft was made ready for you",
  completed: "Marked done",
  reopened: "Reopened",
  closed: "Closed",
  quote_accepted: "You accepted the price",
  quote_declined: "You declined the price",
  payment_recorded: "Payment recorded",
};

export function RequestThread({
  requestId,
  events,
}: {
  requestId: string;
  events: RequestEvent[];
}) {
  const [state, formAction] = useActionState(replyToRequest, initial);

  const pendingQuote = liveQuote(events);

  return (
    <div>
      <ol className="grid gap-3">
        {events.map((event) => {
          /*
           * A quote is history once it has been answered or replaced, and it
           * still has to be readable — "what did they actually offer me in
           * March" is a question people ask. So it renders as a message with
           * its price, while the live one is handled below the thread where
           * the decision belongs.
           */
          if (event.kind === "quoted") {
            const amount = formatQuote(event);

            return (
              <li
                key={event.id}
                className="border border-zinc-dust bg-paper p-4"
              >
                <p className="text-xs tracking-wide text-slate-wash uppercase">
                  {SITE_NAME} quoted &middot; {when(event.created_at)}
                </p>
                <p className="mt-1.5 text-lg font-semibold text-millscale">
                  {amount ?? "No price attached"}
                </p>
                {event.body ? (
                  <p className="type-body mt-2 whitespace-pre-wrap">
                    {event.body}
                  </p>
                ) : null}
              </li>
            );
          }

          const marker = MARKER_COPY[event.kind];

          if (marker) {
            return (
              <li
                key={event.id}
                className="flex items-center gap-3 text-xs text-slate-wash"
              >
                <span aria-hidden className="h-px flex-1 bg-zinc-dust" />
                {marker} &middot; {when(event.created_at)}
                <span aria-hidden className="h-px flex-1 bg-zinc-dust" />
              </li>
            );
          }

          const fromUs = event.actor === "certloop";

          return (
            <li
              key={event.id}
              className={`border p-4 ${
                fromUs
                  ? "border-verdigris bg-paper"
                  : "border-zinc-dust bg-galvanise"
              }`}
            >
              <p className="text-xs tracking-wide text-slate-wash uppercase">
                {fromUs ? SITE_NAME : "You"} &middot; {when(event.created_at)}
              </p>
              {event.body ? (
                <p className="type-body mt-2 whitespace-pre-wrap">{event.body}</p>
              ) : (
                <p className="type-body mt-2 text-slate-wash">
                  (nothing written)
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {/*
        The open decision, below the history rather than inside it. A live
        quote is not a thing that happened — it is a thing waiting on the
        person reading, and burying it in date order would put it above
        whatever was said afterwards.
      */}
      {pendingQuote ? (
        <div className="mt-6">
          <QuoteDecision requestId={requestId} quote={pendingQuote} />
        </div>
      ) : null}

      {state.status === "sent" ? (
        <p
          role="status"
          className="mt-6 border-l-2 border-verdigris bg-galvanise px-3 py-2 text-sm text-millscale"
        >
          Sent. This is back with {SITE_NAME} now.
        </p>
      ) : null}

      <form action={formAction} className="mt-6">
        <input type="hidden" name="request_id" value={requestId} />
        <label className="type-label block text-millscale" htmlFor="body">
          Add something
        </label>
        <textarea
          id="body"
          name="body"
          rows={4}
          maxLength={4000}
          className="mt-2 w-full border border-zinc-dust bg-galvanise px-3 py-2 text-sm text-millscale"
        />

        {state.error ? (
          <p role="alert" className="mt-2 text-sm text-rust-flag">
            {state.error}
          </p>
        ) : null}

        <SubmitButton pendingLabel="Sending…" className="btn-primary mt-3">
          Send
        </SubmitButton>
      </form>
    </div>
  );
}
