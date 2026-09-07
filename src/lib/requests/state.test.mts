import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  agreedQuote,
  deriveStatus,
  formatQuote,
  isPaid,
  liveQuote,
  type RequestEvent,
} from "./state.ts";

/**
 * The reported bug, and the rules that replace it.
 *
 * A request read "Waiting on us" after we had already replied. Every test
 * here is a case where a stored label would go stale and a derived one does
 * not.
 */

let clock = 0;

function event(over: Partial<RequestEvent> = {}): RequestEvent {
  clock += 1;
  return {
    id: `e${clock}`,
    request_id: "r1",
    // Monotonic, so ordering is meaningful without hand-writing timestamps.
    created_at: new Date(Date.UTC(2026, 6, 28, 0, 0, clock)).toISOString(),
    actor: "customer",
    kind: "submitted",
    body: null,
    awaits_reply: false,
    amount_low: null,
    amount_high: null,
    ...over,
  };
}

test("a new request is waiting on CertLoop", () => {
  const status = deriveStatus([event({ kind: "submitted" })]);

  assert.equal(status.state, "waiting_on_certloop");
  assert.equal(status.nextParty, "certloop");
});

test("THE BUG: a reply that asks something moves it off CertLoop", () => {
  // This is the case from the screenshot. Under the old stored label this
  // still read "Waiting on us" indefinitely.
  const status = deriveStatus([
    event({ kind: "submitted" }),
    event({ actor: "certloop", kind: "certloop_message", awaits_reply: true }),
  ]);

  assert.equal(status.state, "waiting_on_customer");
  assert.equal(status.nextParty, "customer");
});

test("a reply that needs nothing back leaves it with CertLoop", () => {
  // "Got it, we're on this" must not push the ball into the customer's court.
  // The two kinds of reply leave the request in opposite states, which is why
  // awaits_reply is asked of whoever writes it rather than guessed.
  const status = deriveStatus([
    event({ kind: "submitted" }),
    event({ actor: "certloop", kind: "certloop_message", awaits_reply: false }),
  ]);

  assert.equal(status.state, "in_review");
  assert.equal(status.nextParty, "certloop");
});

test("the customer answering puts it back on CertLoop", () => {
  const status = deriveStatus([
    event({ kind: "submitted" }),
    event({ actor: "certloop", kind: "certloop_message", awaits_reply: true }),
    event({ actor: "customer", kind: "customer_message" }),
  ]);

  assert.equal(status.state, "waiting_on_certloop");
});

test("a draft outranks the reply that came with it", () => {
  const status = deriveStatus([
    event({ kind: "submitted" }),
    event({ actor: "certloop", kind: "certloop_message" }),
    event({ actor: "certloop", kind: "draft_ready" }),
  ]);

  assert.equal(status.state, "draft_ready");
  assert.equal(status.nextParty, "customer");
});

test("a question asked after a draft is no longer 'here is your draft'", () => {
  const status = deriveStatus([
    event({ actor: "certloop", kind: "draft_ready" }),
    event({ actor: "customer", kind: "customer_message" }),
  ]);

  assert.equal(status.state, "waiting_on_certloop");
});

test("completed is not recomputed from older activity", () => {
  // The thing a naive "last message wins" gets wrong: a completed request
  // whose history still contains an unanswered question from us.
  const status = deriveStatus([
    event({ kind: "submitted" }),
    event({ actor: "certloop", kind: "certloop_message", awaits_reply: true }),
    event({ actor: "certloop", kind: "completed" }),
  ]);

  assert.equal(status.state, "completed");
  assert.equal(status.nextParty, null);
});

test("reopening a completed request makes it live again", () => {
  const status = deriveStatus([
    event({ actor: "certloop", kind: "completed" }),
    event({ actor: "customer", kind: "reopened" }),
  ]);

  assert.equal(status.state, "waiting_on_certloop");
});

test("the answer does not depend on the order rows come back in", () => {
  // Two events written in one transaction can arrive either way round, and
  // the state must not flip depending on which.
  const submitted = event({ kind: "submitted" });
  const replied = event({
    actor: "certloop",
    kind: "certloop_message",
    awaits_reply: true,
  });

  assert.equal(
    deriveStatus([submitted, replied]).state,
    deriveStatus([replied, submitted]).state,
  );
});

test("a request with no events at all is treated as submitted", () => {
  // Only reachable for a row written before the events table existed. It must
  // not render blank or throw.
  const status = deriveStatus([]);

  assert.equal(status.state, "waiting_on_certloop");
  assert.equal(status.lastActivityAt, null);
});

test("last activity is the newest event, whatever the order given", () => {
  const first = event({ kind: "submitted" });
  const second = event({ actor: "certloop", kind: "in_review" });

  assert.equal(
    deriveStatus([second, first]).lastActivityAt,
    second.created_at,
  );
});

/* ------------------------------------------------------------------ *
 * The money path.
 *
 * These are written as negative tests on purpose. Every one of them is a
 * case where the screen would look perfectly reasonable and be wrong about
 * money, which is the only kind of wrong that costs a customer's trust
 * outright.
 * ------------------------------------------------------------------ */

test("a quote puts the request on the customer, not on us", () => {
  const status = deriveStatus([
    event({ kind: "submitted" }),
    event({ kind: "quoted", actor: "certloop", amount_low: 149, amount_high: 299 }),
  ]);

  assert.equal(status.state, "quote_sent");
  assert.equal(status.nextParty, "customer");
});

test("accepting moves it back to us — accepting is not paying", () => {
  const status = deriveStatus([
    event({ kind: "quoted", actor: "certloop", amount_low: 149, amount_high: 299 }),
    event({ kind: "quote_accepted" }),
  ]);

  assert.equal(status.state, "accepted");
  assert.equal(status.nextParty, "certloop");
});

test("an accepted quote is not treated as paid", () => {
  // The failure this guards: showing "paid" because somebody said yes.
  // Acceptance is a promise; payment is an event somebody records by hand.
  const events = [
    event({ kind: "quoted", actor: "certloop", amount_low: 149, amount_high: 299 }),
    event({ kind: "quote_accepted" }),
  ];

  assert.equal(isPaid(events), false);
});

test("declining closes it and asks nothing further of anyone", () => {
  const status = deriveStatus([
    event({ kind: "quoted", actor: "certloop", amount_low: 500, amount_high: 900 }),
    event({ kind: "quote_declined" }),
  ]);

  assert.equal(status.state, "closed");
  assert.equal(status.nextParty, null);
});

test("an answered quote is no longer live, so no Accept button can appear", () => {
  // The bug this prevents: offering someone the chance to accept a price
  // they already declined.
  const events = [
    event({ kind: "quoted", actor: "certloop", amount_low: 149, amount_high: 299 }),
    event({ kind: "quote_declined" }),
  ];

  assert.equal(liveQuote(events), null);
});

test("a revised quote replaces the old one as the live quote", () => {
  const events = [
    event({ kind: "quoted", actor: "certloop", amount_low: 149, amount_high: 299 }),
    event({ kind: "certloop_message", actor: "certloop", body: "Scope grew." }),
    event({ kind: "quoted", actor: "certloop", amount_low: 400, amount_high: 600 }),
  ];

  const live = liveQuote(events);

  assert.equal(live?.amount_low, 400, "the newer price is the live one");
  assert.equal(deriveStatus(events).state, "quote_sent");
});

test("the agreed price is the one that was accepted, not a later revision", () => {
  // The expensive mistake: quoting 149-299, being accepted, then sending a
  // revised 400-600 that nobody answered, and invoicing the revision.
  const events = [
    event({ kind: "quoted", actor: "certloop", amount_low: 149, amount_high: 299 }),
    event({ kind: "quote_accepted" }),
    event({ kind: "quoted", actor: "certloop", amount_low: 400, amount_high: 600 }),
  ];

  assert.equal(agreedQuote(events)?.amount_low, 149);
  assert.equal(agreedQuote(events)?.amount_high, 299);
});

test("recording payment reads as work in hand, never as done", () => {
  const events = [
    event({ kind: "quoted", actor: "certloop", amount_low: 149, amount_high: 299 }),
    event({ kind: "quote_accepted" }),
    event({ kind: "payment_recorded", actor: "certloop" }),
  ];

  const status = deriveStatus(events);

  assert.equal(status.state, "in_review");
  assert.equal(status.nextParty, "certloop", "paid work is ours to deliver");
  assert.equal(isPaid(events), true);
});

test("a completed request stays completed after payment is recorded late", () => {
  // Money is often recorded after delivery. That must not reopen the job.
  const events = [
    event({ kind: "quoted", actor: "certloop", amount_low: 149, amount_high: 299 }),
    event({ kind: "quote_accepted" }),
    event({ kind: "completed", actor: "certloop" }),
  ];

  assert.equal(deriveStatus(events).state, "completed");
});

test("a single-figure quote does not render as a range of one price", () => {
  assert.equal(formatQuote({ amount_low: 250, amount_high: 250 }), "$250");
  assert.equal(formatQuote({ amount_low: 149, amount_high: 299 }), "$149–$299");
  assert.equal(formatQuote({ amount_low: null, amount_high: null }), null);
});

test("a non-quote event carrying an amount is never shown as a price", () => {
  // The database forbids this, but a row written by hand in the SQL editor
  // before the constraint existed would slip through. liveQuote must not
  // treat a reply as an offer.
  const events = [
    event({
      kind: "certloop_message",
      actor: "certloop",
      body: "roughly 200",
      amount_low: 200,
      amount_high: 200,
    }),
  ];

  assert.equal(liveQuote(events), null);
});
