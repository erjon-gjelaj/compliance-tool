/**
 * The state of a request, computed from what actually happened to it.
 *
 * This module is the fix for a real bug: a request read "Waiting on us" long
 * after we had replied, because the status was a column somebody set by hand
 * and the reply happened in a mail client.
 *
 * The rule that follows from that, and the reason this file has no database
 * access and no side effects: **state is derived, never stored**. A stored
 * label is a claim about the world, and it is wrong from the moment anyone
 * acts outside the app. A derived one can only be wrong if an event is
 * missing, and a missing event is a visible bug rather than a silent lie.
 *
 * So there is no `setStatus` anywhere in this product. To change what a
 * request says, you record what happened.
 */

export const REQUEST_STATES = [
  "waiting_on_certloop",
  "in_review",
  "waiting_on_customer",
  "quote_ready",
  "accepted",
  "draft_ready",
  "completed",
  "closed",
] as const;

export type RequestState = (typeof REQUEST_STATES)[number];

export const EVENT_KINDS = [
  "submitted",
  "customer_message",
  "certloop_message",
  "quoted",
  "quote_accepted",
  "in_review",
  "draft_ready",
  "completed",
  "delivered",
  "reopened",
  "closed",
] as const;

export type EventKind = (typeof EVENT_KINDS)[number];

export type RequestEvent = {
  id: string;
  request_id: string;
  created_at: string;
  actor: "customer" | "certloop" | "system";
  kind: EventKind;
  body: string | null;
  awaits_reply: boolean;
};

/**
 * Everything a screen needs to say about a request, in one shape.
 *
 * `nextParty` is carried separately from the state because it is the thing
 * people actually want to know — whose move is it — and deriving it at each
 * call site is how two screens end up disagreeing.
 */
export type RequestStatus = {
  state: RequestState;
  /** Whose move it is. Null once nothing further is expected. */
  nextParty: "customer" | "certloop" | null;
  /** When anything last happened, for "no news since" ordering. */
  lastActivityAt: string | null;
};

/**
 * Derives the state.
 *
 * Read in order, because the order IS the rule:
 *
 *  1. A terminal event wins outright, until a later event reopens it. Nothing
 *     about a completed request should be recomputed from older activity.
 *  2. Otherwise the most recent event that moves the state decides. A reply
 *     from us that asks for something waits on them; one that does not means
 *     we are still holding it.
 *  3. `draft_ready` outranks a plain reply because it is the more useful
 *     thing to show — but only until somebody speaks after it, since a
 *     conversation about a draft is no longer "here is your draft".
 *
 * Events are sorted here rather than trusted from the caller. Two events
 * written in the same transaction can come back in either order, and the
 * answer must not depend on that.
 */
export function deriveStatus(events: RequestEvent[]): RequestStatus {
  if (events.length === 0) {
    // No log at all. Only reachable for a row written before the events table
    // existed and never backfilled. Treated as freshly submitted: it is the
    // one thing certainly true of every request.
    return {
      state: "waiting_on_certloop",
      nextParty: "certloop",
      lastActivityAt: null,
    };
  }

  const ordered = [...events].sort((a, b) =>
    a.created_at === b.created_at ? 0 : a.created_at < b.created_at ? -1 : 1,
  );

  const last = ordered[ordered.length - 1];
  const lastActivityAt = last.created_at;

  // Walk backwards to the first event that decides the state. Everything
  // older is history that a later event has already spoken for.
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const event = ordered[index];

    switch (event.kind) {
      case "closed":
        return { state: "closed", nextParty: null, lastActivityAt };

      case "completed":
      case "delivered":
        return { state: "completed", nextParty: null, lastActivityAt };

      case "quote_accepted":
        return { state: "accepted", nextParty: "certloop", lastActivityAt };

      case "quoted":
        return { state: "quote_ready", nextParty: "customer", lastActivityAt };

      case "draft_ready":
        // Ready for them to look at, so it is their move.
        return {
          state: "draft_ready",
          nextParty: "customer",
          lastActivityAt,
        };

      case "certloop_message":
        return event.awaits_reply
          ? {
              state: "waiting_on_customer",
              nextParty: "customer",
              lastActivityAt,
            }
          : // We replied without needing anything back, so it is still ours.
            { state: "in_review", nextParty: "certloop", lastActivityAt };

      case "in_review":
        return { state: "in_review", nextParty: "certloop", lastActivityAt };

      case "submitted":
      case "customer_message":
      case "reopened":
        // They spoke last. Ours.
        return {
          state: "waiting_on_certloop",
          nextParty: "certloop",
          lastActivityAt,
        };
    }
  }

  return {
    state: "waiting_on_certloop",
    nextParty: "certloop",
    lastActivityAt,
  };
}

/**
 * What the customer sees. Written from their side of the table.
 *
 * "Waiting on us" was ambiguous in the old UI — us being CertLoop, read by a
 * customer as themselves. Every label here names who is holding it.
 */
export const STATE_LABEL: Record<RequestState, string> = {
  waiting_on_certloop: "With CertLoop",
  in_review: "Being worked on",
  waiting_on_customer: "Needs something from you",
  quote_ready: "Quote ready for review",
  accepted: "Quote accepted",
  draft_ready: "Ready for you to look at",
  completed: "Done",
  closed: "Closed",
};

/**
 * The one place a state becomes a colour.
 *
 * Four treatments, not six: action required, in flight, ready, and finished.
 * Two states that mean the same thing to a person reading quickly should look
 * the same, and every status chip in the product renders from here so they
 * cannot drift apart.
 */
export const STATE_TONE: Record<RequestState, "action" | "waiting" | "ready" | "done"> =
  {
    waiting_on_customer: "action",
    quote_ready: "action",
    accepted: "ready",
    waiting_on_certloop: "waiting",
    in_review: "waiting",
    draft_ready: "ready",
    completed: "done",
    closed: "done",
  };

/** Whether this is something the customer has to act on. */
export function needsCustomer(status: RequestStatus): boolean {
  return status.nextParty === "customer";
}
