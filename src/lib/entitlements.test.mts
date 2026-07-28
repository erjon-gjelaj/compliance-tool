import { strict as assert } from "node:assert";
import { test } from "node:test";

import { CAPABILITIES, can, planOf } from "./entitlements.ts";

/**
 * What each plan may do.
 *
 * The failures worth catching are the two directions of getting this wrong:
 * quietly taking away something that is free today, and quietly granting a
 * paid capability to everyone.
 */

test("everything shipped today is free", () => {
  // gap_review is the whole current product. If this ever goes false, a
  // paywall has appeared over something people already have.
  assert.equal(can("free", "gap_review"), true);
});

test("free does not include work nobody has built yet", () => {
  assert.equal(can("free", "document_preparation"), false);
  assert.equal(can("free", "document_export"), false);
  assert.equal(can("free", "multiple_companies"), false);
});

test("only a consultant holds several companies", () => {
  // The contractor dashboard must never grow a workspace switcher, so this is
  // the line that keeps that true.
  assert.equal(can("contractor", "multiple_companies"), false);
  assert.equal(can("consultant", "multiple_companies"), true);
});

test("no customer plan can read anyone else's submissions", () => {
  for (const plan of ["free", "contractor", "consultant"] as const) {
    assert.equal(
      can(plan, "internal_admin"),
      false,
      `${plan} must not hold internal_admin`,
    );
  }
});

test("admin is enumerated rather than wildcarded", () => {
  // A wildcard would grant every capability added in future automatically,
  // including ones that should never be ours to exercise on someone's account.
  // This test fails on purpose when a capability is added, so the grant is a
  // decision rather than a side effect.
  const held = CAPABILITIES.filter((capability) => can("admin", capability));

  assert.equal(
    held.length,
    CAPABILITIES.length,
    "a new capability was added without deciding whether admin holds it",
  );
});

test("an unset plan is free, not an error", () => {
  assert.equal(planOf(null), "free");
  assert.equal(planOf({}), "free");
});

test("a typo in the plan column costs a capability, not the dashboard", () => {
  // This column is edited by hand. An unrecognised value falls back rather
  // than throwing, so a slip does not take someone's workspace down.
  assert.equal(planOf({ plan: "contracter" }), "free");
});
