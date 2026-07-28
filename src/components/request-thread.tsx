"use client";

import { useActionState } from "react";

import { replyToRequest, type ReplyState } from "@/app/dashboard/requests/actions";
import { SubmitButton } from "@/components/submit-button";
import { SITE_NAME } from "@/lib/constants";
import type { RequestEvent } from "@/lib/requests/state";

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
};

export function RequestThread({
  requestId,
  events,
}: {
  requestId: string;
  events: RequestEvent[];
}) {
  const [state, formAction] = useActionState(replyToRequest, initial);

  return (
    <div>
      <ol className="grid gap-3">
        {events.map((event) => {
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
