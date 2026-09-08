import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  CAPABILITIES,
  DEFAULT_PLAN,
  LOCKED_COPY,
  PLANS,
  can,
  isPlan,
  planOf,
  unlocksPreparation,
  type Capability,
} from "./entitlements.ts";
import { FREE_INCLUDES, PRODUCTS, PROGRAMS_PRODUCT } from "./billing/catalog.ts";

/**
 * Who may have a document prepared.
 *
 * These tests exist because for most of this project `can()` was not called
 * anywhere in the application. The module was correct, complete, well
 * documented and inert — the plan granted at the end of the money path
 * decided nothing, and the generated programs, which are the thing this
 * business sells, were free to anyone with an email address.
 *
 * So the failures worth catching are both directions of the same mistake:
 * the paid work leaking to the free plan, and the free work — the gap check,
 * the reason anybody arrives — being taken away from it.
 */

/* ------------------------------------------------------------------ *
 * The paid product does not leak
 * ------------------------------------------------------------------ */

test("the free plan cannot have a document prepared", () => {
  assert.equal(can("free", "document_preparation"), false);
  assert.equal(can("free", "document_export"), false);
});

test("an unrecognized plan is treated as free, not as everything", () => {
  // This column is edited by hand. A typo must cost somebody a capability,
  // never hand them one — "contracter" granting document preparation is the
  // failure that would never be noticed, because nobody complains about
  // getting something.
  for (const value of ["contracter", "CONTRACTOR", "paid", "", " ", "null"]) {
    assert.equal(planOf({ plan: value }), DEFAULT_PLAN, `"${value}" was not treated as free`);
    assert.equal(can(planOf({ plan: value }), "document_preparation"), false);
  }
});

test("a missing company, or one with no plan, is free", () => {
  assert.equal(planOf(null), DEFAULT_PLAN);
  assert.equal(planOf({}), DEFAULT_PLAN);
  assert.equal(planOf({ plan: null }), DEFAULT_PLAN);
});

test("nothing but admin holds internal_admin", () => {
  // Reading anyone's submissions. The one capability whose leak is a privacy
  // incident rather than lost revenue.
  for (const plan of PLANS) {
    if (plan === "admin") continue;
    assert.equal(can(plan, "internal_admin"), false, `${plan} can read everyone's submissions`);
  }
});

test("admin is enumerated, so a new capability is not granted by default", () => {
  // A wildcard would hand every future capability to admin automatically,
  // including ones that should never be ours to exercise on someone's
  // account. If this fails, somebody added a capability — decide, don't
  // assume.
  const held = CAPABILITIES.filter((capability) => can("admin", capability));
  assert.equal(
    held.length,
    CAPABILITIES.length,
    "a capability exists that admin does not hold — deliberate, or forgotten?",
  );
});

/* ------------------------------------------------------------------ *
 * The free product is not taken away
 * ------------------------------------------------------------------ */

test("every plan keeps the gap review", () => {
  // The gap check is why anybody arrives, and business-model.md is built on
  // it being free. Gating it would not be a pricing change, it would be a
  // different product.
  for (const plan of PLANS) {
    assert.ok(can(plan, "gap_review"), `${plan} lost the gap review`);
  }
});

test("what the pricing page calls free matches what free actually grants", () => {
  // FREE_INCLUDES is read by a customer; GRANTS decides what happens. The two
  // drifting apart means the site promises something the code refuses, which
  // is worse than either being wrong on its own.
  const promised = FREE_INCLUDES.join(" ").toLowerCase();

  assert.ok(promised.includes("gap check"), "the free list stopped naming the gap check");
  assert.ok(
    !/prepared|written program|word and pdf/.test(promised),
    "the free list promises document preparation, which free does not grant",
  );
});

/* ------------------------------------------------------------------ *
 * The offers and the capabilities agree
 * ------------------------------------------------------------------ */

test("paying grants the thing that was sold", () => {
  // If the product sells written programs and no plan grants
  // document_preparation, paying changes nothing — which was true of every
  // plan in this product until the check was wired in.
  const capability: Capability = "document_preparation";

  assert.ok(
    PLANS.some((plan) => plan !== "free" && can(plan, capability)),
    "the product is sold but no plan grants it",
  );
});

test("the catalog sells exactly one thing", () => {
  // Every extra tier would sell a distinction this software cannot enforce:
  // the capability is one bit, so a second product would have to be tracked
  // per program, per payment, forever. If this fails, that work is now owed.
  assert.equal(PRODUCTS.length, 1);
  assert.equal(PRODUCTS[0].id, PROGRAMS_PRODUCT.id);
});

test("the price is a whole number of cents and not zero", () => {
  // Stripe charges amountCents directly. A float here bills somebody
  // $198.99999999, and a zero grants the product for nothing.
  assert.ok(Number.isInteger(PROGRAMS_PRODUCT.amountCents));
  assert.ok(PROGRAMS_PRODUCT.amountCents > 0);
});

test("nothing in the paid list promises what the product does not do", () => {
  // These bullets sit next to a card form. Each one is a commitment.
  const promised = PROGRAMS_PRODUCT.includes.join(" ").toLowerCase();

  for (const forbidden of ["consultant", "audit", "certified", "guarantee", "approved"]) {
    assert.ok(!promised.includes(forbidden), `the checkout promises "${forbidden}"`);
  }
});

test("every locked capability has something to say for itself", () => {
  // A locked feature with empty copy renders as a dead end. The two blanks
  // are the ones that are never locked to anybody who can see them.
  for (const capability of CAPABILITIES) {
    if (capability === "gap_review" || capability === "internal_admin") continue;

    assert.ok(
      LOCKED_COPY[capability]?.trim().length > 20,
      `"${capability}" has no explanation for somebody who does not have it`,
    );
  }
});

test("locked copy never promises a checkout that does not exist", () => {
  // There is no payment path. A button reading "upgrade now" would be the
  // exact dishonesty this product avoids everywhere else.
  for (const [capability, copy] of Object.entries(LOCKED_COPY)) {
    for (const forbidden of ["upgrade", "subscribe", "checkout", "start your trial"]) {
      assert.ok(
        !copy.toLowerCase().includes(forbidden),
        `"${capability}" copy says "${forbidden}"`,
      );
    }
  }
});

test("isPlan rejects anything that is not one of ours", () => {
  assert.ok(isPlan("free"));
  assert.ok(!isPlan("Free"));
  assert.ok(!isPlan(undefined));
  assert.ok(!isPlan(null));
  assert.ok(!isPlan({ plan: "admin" }));
});

/* ------------------------------------------------------------------ *
 * When a plan change is worth an email
 * ------------------------------------------------------------------ */

test("granting a paid plan to a free account is worth telling them about", () => {
  assert.ok(unlocksPreparation("free", "contractor"));
  assert.ok(unlocksPreparation("free", "consultant"));
  assert.ok(unlocksPreparation("free", "admin"));
});

test("a downgrade never sends good news", () => {
  // "Your programs are ready to prepare" arriving as somebody loses access is
  // worse than silence, and it is the mistake a naive "plan changed" hook
  // would make.
  assert.equal(unlocksPreparation("contractor", "free"), false);
  assert.equal(unlocksPreparation("consultant", "free"), false);
});

test("re-granting the same plan is not news", () => {
  // An operator clicking the dropdown twice, or setting a plan somebody
  // already holds, must not mail them again.
  for (const plan of PLANS) {
    assert.equal(unlocksPreparation(plan, plan), false, `${plan} to ${plan} sent an email`);
  }
});

test("a sideways move that changes nothing they can do is not news", () => {
  // contractor to consultant adds workspaces and white label, not document
  // preparation — they could already prepare documents, so the email would be
  // telling them something they have known for months.
  assert.equal(unlocksPreparation("contractor", "consultant"), false);
  assert.equal(unlocksPreparation("consultant", "contractor"), false);
});
