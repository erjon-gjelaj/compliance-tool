/**
 * Negative tests for citation mapping.
 *
 *   npm test
 *
 * Uses node:test, which ships with Node — this project has no test runner and
 * did not need one for the sake of a handful of assertions.
 *
 * These are deliberately mostly negative. The valuable property here is not
 * "the right citation comes back", it is "the wrong one never does": a
 * plausible, relevant, genuinely-real section being handed to a contractor it
 * does not cover. That failure looks completely correct in every review and
 * is only caught by someone who knows the scope clause.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  citationsFor,
  isUniversalCounterpart,
  resolveCitations,
} from "./index.ts";
import { CITATION_GAPS } from "./citations.ts";

test("construction lockout/tagout returns no citation, and says why", () => {
  const { citations, gap } = resolveCitations({
    requirement: "lockout-tagout",
    industry: "construction",
  });

  assert.deepEqual(citations, []);
  assert.equal(gap?.status, "context-dependent");
  assert.equal(gap?.code, "CONTEXT_DEPENDENT_CITATION");
});

test("1910.147 is never offered as a construction counterpart", () => {
  // It is the only lockout/tagout citation there is, which is exactly why a
  // future refactor would reach for it.
  assert.equal(
    isUniversalCounterpart("1910.147", "lockout-tagout", "construction"),
    false,
  );
});

test("1926.417 does not satisfy general construction lockout/tagout", () => {
  // Real, and about lockout — but of electrical circuits specifically. It is
  // not a universal counterpart, and must not become one by being the only
  // construction-shaped thing anyone thought of.
  assert.equal(
    isUniversalCounterpart("1926.417", "lockout-tagout", "construction"),
    false,
  );
});

test("confined space DOES resolve for construction — the gap is specific", () => {
  // Guards against the refusal being over-broad. 1910.146 also excludes
  // construction, but 1926.1203 was verified, so there is no gap to declare.
  const { citations, gap } = resolveCitations({
    requirement: "confined-space",
    industry: "construction",
  });

  assert.equal(gap, null);
  assert.ok(citations.length > 0, "expected a verified construction citation");
  assert.ok(
    citations.every((c) => !c.excludesConstruction),
    "a construction result must not include a standard excluding construction",
  );
  assert.ok(citations.some((c) => c.cfr.includes("1926.1203")));
});

test("general industry still gets the standards that exclude construction", () => {
  const { citations } = resolveCitations({
    requirement: "lockout-tagout",
    industry: "general-industry",
  });

  assert.ok(citations.some((c) => c.cfr.includes("1910.147")));
});

test("omitting industry returns everything, caveats intact", () => {
  // What the review email does: it cannot know the industry, so it shows the
  // standards with their own scope language attached.
  const { citations, gap } = resolveCitations({ requirement: "lockout-tagout" });

  assert.equal(gap, null);
  assert.ok(citations.some((c) => c.excludesConstruction));
});

test("every cached citation carries a retrieved exclusion flag", () => {
  // Catches a stale cache generated before the flag existed, which would read
  // as "excludes nothing" and silently drop every caveat.
  for (const id of ["lockout-tagout", "confined-space", "ppe"]) {
    for (const citation of citationsFor(id)) {
      assert.equal(
        typeof citation.excludesConstruction,
        "boolean",
        `${citation.cfr} has no excludesConstruction — regenerate the cache`,
      );
    }
  }
});

test("declared gaps use stable codes and name a real requirement", () => {
  for (const gap of CITATION_GAPS) {
    assert.match(gap.code, /^[A-Z_]+$/, "codes are stable identifiers");
    assert.notEqual(gap.status, "verified", "a gap is never verified");
    assert.ok(gap.reason.length > 40, "a refusal must explain itself");
  }
});
