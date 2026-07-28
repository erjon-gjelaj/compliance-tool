import { strict as assert } from "node:assert";
import { test } from "node:test";

import { validateStepOne } from "./intake.ts";
import { MAX_REJECTION_NOTES } from "./entry-points.ts";

/**
 * Step 1, where the entry point is decided.
 *
 * The cases below are the ones that look correct and are not: a rejection
 * paste surviving a change of door, and a bad door slug costing a real
 * submission.
 */

function stepOne(over: Record<string, string> = {}): FormData {
  const form = new FormData();

  const fields: Record<string, string> = {
    trade: "Electrical",
    hiring_client: "Gulf Refining",
    platform: "ISNetworld",
    deadline_unknown: "on",
    contact_name: "Sam",
    email: "sam@example.com",
    ...over,
  };

  for (const [key, value] of Object.entries(fields)) {
    if (value !== "") form.set(key, value);
  }

  return form;
}

test("the door is recorded on the submission", () => {
  const result = validateStepOne(stepOne({ entry_reason: "rejection" }));

  assert.equal(result.ok, true);
  assert.equal(result.ok && result.value.entry_reason, "rejection");
});

test("a missing door falls back to the gap check rather than failing", () => {
  const result = validateStepOne(stepOne());

  assert.equal(result.ok, true);
  assert.equal(result.ok && result.value.entry_reason, "gap_check");
});

test("an unrecognised door does not cost the submission", () => {
  // A stale link or a hand-typed URL. Failing here would throw away a real
  // intake to protect a routing hint that is ours, not theirs.
  const result = validateStepOne(stepOne({ entry_reason: "not-a-door" }));

  assert.equal(result.ok, true);
  assert.equal(result.ok && result.value.entry_reason, "gap_check");
});

test("rejection notes are dropped when the door is not the rejection one", () => {
  // The case that matters. Someone starts on /rejection, pastes a reviewer's
  // comments, changes their mind and submits from the gap check. Carrying the
  // paste through would attach a reviewer's words to a submission that is not
  // about a rejection, where the review would read them as one.
  const result = validateStepOne(
    stepOne({ entry_reason: "gap_check", rejection_notes: "lockout rejected" }),
  );

  assert.equal(result.ok, true);
  assert.equal(result.ok && result.value.rejection_notes, null);
});

test("rejection notes are kept when the door is the rejection one", () => {
  const result = validateStepOne(
    stepOne({ entry_reason: "rejection", rejection_notes: "lockout rejected" }),
  );

  assert.equal(result.ok && result.value.rejection_notes, "lockout rejected");
});

test("an empty paste on the rejection door is stored as absent, not as text", () => {
  // "The door was used and nothing was pasted" is a state the review renders
  // differently from "we read the notes and recognised nothing". An empty
  // string here would collapse the two.
  const result = validateStepOne(
    stepOne({ entry_reason: "rejection", rejection_notes: "   " }),
  );

  assert.equal(result.ok && result.value.rejection_notes, null);
});

test("an oversized paste is refused rather than silently truncated", () => {
  // Truncation would drop the end of a reviewer's comment without saying so,
  // and the end is where the specific request usually is.
  const result = validateStepOne(
    stepOne({
      entry_reason: "rejection",
      rejection_notes: "x".repeat(MAX_REJECTION_NOTES + 1),
    }),
  );

  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.errors.rejection_notes);
});
