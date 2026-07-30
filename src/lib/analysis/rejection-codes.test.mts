import assert from "node:assert/strict";
import test from "node:test";

import { classifyRejection } from "./rejection-codes.ts";

test("classifies one configured cause", () => {
  assert.equal(
    classifyRejection("Reviewer says the company is not named.").code,
    "R01",
  );
});

test("does not force ambiguous feedback into one code", () => {
  const result = classifyRejection(
    "The page range is missing and the instructor signature is missing.",
  );
  assert.equal(result.code, "unknown");
  assert.deepEqual(result.candidates, ["R07", "R15"]);
});

test("keeps unmatched feedback unknown", () => {
  assert.deepEqual(classifyRejection("Please revise and resubmit."), {
    code: "unknown",
    matchedTerm: null,
    candidates: [],
  });
});
