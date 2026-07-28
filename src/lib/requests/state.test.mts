import { strict as assert } from "node:assert";
import { test } from "node:test";

import { deriveStatus, type RequestEvent } from "./state.ts";

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
