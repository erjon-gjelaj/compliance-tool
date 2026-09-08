import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  FREE_INCLUDES,
  PRODUCTS,
  PROGRAMS_PRODUCT,
  formatPrice,
  productById,
} from "./catalog.ts";
import { planFromPurchases, type PurchaseRow } from "./purchases.ts";

/**
 * What is sold, and what a payment entitles somebody to.
 *
 * The failures worth catching here are the ones that involve money moving
 * and nothing arriving, or arriving and not being paid for. A price rendered
 * from a different constant than the one Stripe charges is the first;
 * a refunded purchase that keeps its entitlement is the second.
 */

/* ------------------------------------------------------------------ *
 * The price on the page is the price on the card
 * ------------------------------------------------------------------ */

test("the displayed price is derived from the charged amount", () => {
  // Not two constants that happen to agree. If these are ever allowed to
  // drift, the page quotes one number and the card is charged another, which
  // is the single mistake a pricing page cannot make.
  assert.equal(formatPrice(PROGRAMS_PRODUCT), "$199");
  assert.equal(PROGRAMS_PRODUCT.amountCents, 19900);
});

test("the amount is whole cents and not zero", () => {
  // Stripe is handed amountCents directly. A float bills $198.99999999, and
  // a zero hands the product over for nothing.
  assert.ok(Number.isInteger(PROGRAMS_PRODUCT.amountCents));
  assert.ok(PROGRAMS_PRODUCT.amountCents > 0);
});

test("a fractional price would still render sensibly", () => {
  assert.equal(formatPrice({ ...PROGRAMS_PRODUCT, amountCents: 19950 }), "$199.50");
  assert.equal(formatPrice({ ...PROGRAMS_PRODUCT, amountCents: 100 }), "$1");
});

/* ------------------------------------------------------------------ *
 * One product
 * ------------------------------------------------------------------ */

test("there is exactly one thing to buy", () => {
  // Every extra tier sells a distinction the software cannot enforce: the
  // capability is one bit. A second product means tracking which programs a
  // given payment covered, forever. If this fails, that work is now owed.
  assert.equal(PRODUCTS.length, 1);
  assert.equal(productById(PROGRAMS_PRODUCT.id)?.id, PROGRAMS_PRODUCT.id);
  assert.equal(productById("nope"), undefined);
});

test("nothing in the paid list promises what the product cannot do", () => {
  // These bullets sit beside a card form, so each is a commitment. Nothing
  // here may imply a person reviews it, that it is an audit, or that any
  // hiring client will accept it.
  const promised = PROGRAMS_PRODUCT.includes.join(" ").toLowerCase();

  for (const forbidden of [
    "consultant",
    "audit",
    "certified",
    "guarantee",
    "approved",
    "reviewed by",
    "expert",
  ]) {
    assert.ok(!promised.includes(forbidden), `the checkout promises "${forbidden}"`);
  }
});

test("the free list does not promise the paid product", () => {
  // FREE_INCLUDES is read by somebody deciding whether to pay. Promising a
  // prepared program in it means the site offers something the gate refuses.
  const promised = FREE_INCLUDES.join(" ").toLowerCase();

  assert.ok(promised.includes("gap check"));
  assert.ok(
    !/prepared|written program|word and pdf/.test(promised),
    "the free list promises document preparation",
  );
});

/* ------------------------------------------------------------------ *
 * What a payment entitles somebody to
 * ------------------------------------------------------------------ */

function purchase(over: Partial<PurchaseRow> = {}): PurchaseRow {
  return {
    id: "p1",
    created_at: "2026-09-07T00:00:00Z",
    email: "sam@example.com",
    product_id: "programs",
    payment_reference: "cs_test_1",
    source: "stripe",
    amount_cents: 19900,
    currency: "usd",
    status: "paid",
    ...over,
  };
}

test("no purchases means no entitlement", () => {
  assert.equal(planFromPurchases([]), "free");
});

test("one paid purchase grants the product", () => {
  assert.equal(planFromPurchases([purchase()]), "contractor");
});

test("a refund removes the entitlement it paid for", () => {
  assert.equal(planFromPurchases([purchase({ status: "refunded" })]), "free");
});

test("a refund on one of two purchases does not remove access", () => {
  // Somebody who bought twice and was refunded once has still paid. Revoking
  // here would take a product away from a customer who owns it.
  const plan = planFromPurchases([
    purchase({ id: "p1", payment_reference: "cs_1", status: "refunded" }),
    purchase({ id: "p2", payment_reference: "cs_2", status: "paid" }),
  ]);

  assert.equal(plan, "contractor");
});

test("entitlement does not depend on how much was paid", () => {
  // A discount code, a partial capture, or a price change must not silently
  // withhold the product from somebody Stripe reports as paid.
  assert.equal(planFromPurchases([purchase({ amount_cents: 1 })]), "contractor");
});

/* ------------------------------------------------------------------ *
 * Paying without a card processor
 * ------------------------------------------------------------------ */

test("a payment confirmed by hand entitles exactly what a card does", () => {
  /*
   * The whole point of the manual path. Every US card processor has to verify
   * who receives the money, and an operator who cannot clear that check can
   * still be paid by transfer — but only if the entitlement follows from the
   * ledger regardless of how the money arrived.
   *
   * If this ever diverges, somebody who paid by transfer has been charged and
   * given less than somebody who paid by card.
   */
  const byCard = planFromPurchases([purchase({ source: "stripe" })]);
  const byTransfer = planFromPurchases([
    purchase({ source: "manual", payment_reference: "manual:TRF-8891" }),
  ]);

  assert.equal(byTransfer, byCard);
  assert.equal(byTransfer, "contractor");
});

test("a refunded transfer revokes exactly as a refunded card does", () => {
  assert.equal(
    planFromPurchases([purchase({ source: "manual", status: "refunded" })]),
    "free",
  );
});
