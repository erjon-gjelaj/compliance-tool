import { strict as assert } from "node:assert";
import { test } from "node:test";

import { needsConfirming, unconfirmedFields } from "./companies.ts";

/**
 * Provenance on the company profile.
 *
 * The profile sits underneath a compliance review: the trade on it decides
 * which requirements a contractor is measured against. So the thing worth
 * testing is not that values save, but that a value we guessed can never sit
 * on the page looking like one they gave us.
 */

test("a value the contractor typed is not flagged", () => {
  // No provenance entry at all means they said it. Every write path either
  // records provenance or is the contractor typing.
  assert.equal(needsConfirming({ field_sources: {} }, "trade"), false);
});

test("an inferred value they have not confirmed is flagged", () => {
  assert.equal(
    needsConfirming(
      { field_sources: { trade: { source: "inferred" } } },
      "trade",
    ),
    true,
  );
});

test("an inferred value stops being flagged once confirmed", () => {
  assert.equal(
    needsConfirming(
      {
        field_sources: {
          trade: { source: "inferred", confirmedAt: "2026-07-27T00:00:00Z" },
        },
      },
      "trade",
    ),
    false,
  );
});

test("a value recorded as coming from the client is never flagged", () => {
  // "client" means they told us, just through another route — an intake form
  // rather than the profile page. It is not a guess and must not be queried
  // back at them.
  assert.equal(
    needsConfirming({ field_sources: { trade: { source: "client" } } }, "trade"),
    false,
  );
});

test("only the unconfirmed inferred fields are listed", () => {
  const company = {
    field_sources: {
      trade: { source: "inferred" as const },
      website: { source: "inferred" as const, confirmedAt: "2026-07-27T00:00:00Z" },
      name: { source: "client" as const },
    },
  };

  assert.deepEqual(unconfirmedFields(company), ["trade"]);
});

test("a profile with no provenance at all has nothing to confirm", () => {
  assert.deepEqual(unconfirmedFields({ field_sources: {} }), []);
});
