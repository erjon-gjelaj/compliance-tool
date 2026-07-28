import { strict as assert } from "node:assert";
import { test } from "node:test";

import { readRejection, rejectionQuestions } from "./rejection.ts";
import { validateAnalysis } from "./schema.ts";
import type { SubmissionRow } from "../submissions.ts";
import type { Requirement } from "../requirements/index.ts";

/**
 * The rejection reader, and the line it must not cross.
 *
 * The failure worth catching here is not a crash. It is the review telling a
 * contractor what their reviewer requires, on the strength of a word that
 * appeared in a paragraph they pasted. That reads as authoritative, arrives at
 * the moment they are least likely to question it, and is a claim about a
 * portal this product cannot see. Most of what follows is negative.
 */

const LOCKOUT: Requirement = {
  id: "lockout-tagout",
  label: "Lockout/tagout programme",
  source: "platform",
  checklist: "Lockout/tagout program",
  phrases: ["lockout", "tagout", "loto", "energy control procedure"],
  action: "Send the programme.",
  verified: false,
};

const FALL: Requirement = {
  id: "fall-protection",
  label: "Fall protection programme",
  source: "platform",
  checklist: "Fall protection program",
  phrases: ["fall protection", "fall arrest"],
  action: "Send the programme.",
  verified: false,
};

const REQUIREMENTS = [LOCKOUT, FALL];

function submission(over: Partial<SubmissionRow> = {}): SubmissionRow {
  return {
    id: "00000000-0000-4000-8000-000000000000",
    created_at: "2026-07-27T00:00:00Z",
    updated_at: "2026-07-27T00:00:00Z",
    status: "complete",
    last_step: 4,
    entry_reason: "rejection",
    rejection_notes: null,
    trade: "Electrical",
    hiring_client: "Gulf Refining",
    platform: "ISNetworld",
    deadline: null,
    deadline_unknown: true,
    contact_name: "Sam",
    email: "sam@example.com",
    headcount_band: null,
    states: null,
    emr: null,
    trir: null,
    previously_registered: null,
    documents_held: null,
    documents_unsure: false,
    documents_consent_at: null,
    analysis_status: "ok",
    analysed_at: null,
    ...over,
  };
}

test("a submission from another door gets no rejection block at all", () => {
  const reading = readRejection(
    // Notes present but the door was the ordinary gap check. Absent and
    // "nothing found" render differently, so this must be null and not empty.
    submission({ entry_reason: "gap_check", rejection_notes: "lockout" }),
    REQUIREMENTS,
  );

  assert.equal(reading, null);
});

test("the rejection door with nothing pasted names no subject", () => {
  const reading = readRejection(submission({ rejection_notes: null }), REQUIREMENTS);

  assert.deepEqual(reading, { notesProvided: false, subjects: [] });
});

test("a subject is only named when its phrase is actually in the notes", () => {
  const reading = readRejection(
    submission({
      rejection_notes:
        "Your energy control procedure does not describe periodic inspection.",
    }),
    REQUIREMENTS,
  );

  assert.equal(reading?.subjects.length, 1);
  assert.equal(reading?.subjects[0].requirement, "Lockout/tagout programme");
  // Quoted back, so the contractor can see we matched their own words.
  assert.equal(reading?.subjects[0].phrase, "energy control procedure");
});

test("a phrase inside a longer word does not name a subject", () => {
  // "loto" sits inside "photo". A substring search would report a
  // lockout/tagout rejection to someone whose notice mentioned a photograph.
  const reading = readRejection(
    submission({ rejection_notes: "The photo of the panel was unreadable." }),
    REQUIREMENTS,
  );

  assert.deepEqual(reading?.subjects, []);
});

test("notes that match nothing produce a question rather than a guess", () => {
  const reading = readRejection(
    submission({ rejection_notes: "Insufficient detail in section 4." }),
    REQUIREMENTS,
  );

  assert.deepEqual(reading?.subjects, []);

  const questions = rejectionQuestions(reading, submission(), 0);

  assert.ok(
    questions.some((entry) => entry.includes("does not name a subject")),
    "should say the wording matched nothing rather than pick a nearest subject",
  );
});

test("a reading is rejected if it names a subject with no phrase behind it", () => {
  // The phrase is the whole basis for naming the subject. Without it the
  // reader cannot tell our text match from us knowing what the reviewer wants.
  const outcome = validateAnalysis({
    summary: "s",
    rejection: {
      notesProvided: true,
      subjects: [{ requirement: "Lockout/tagout programme", phrase: "" }],
    },
    warnings: [],
    items: [],
    questionsForClient: [],
    priceBand: "unknown",
    unreadableFiles: [],
    referenceVersion: "test",
  });

  assert.equal(outcome.ok, false);
  assert.match(outcome.ok ? "" : outcome.error, /no phrase to show/);
});

test("a reading is rejected if it names subjects with no notes to find them in", () => {
  // Nothing was read, so anything named here was inferred.
  const outcome = validateAnalysis({
    summary: "s",
    rejection: {
      notesProvided: false,
      subjects: [{ requirement: "Fall protection programme", phrase: "fall arrest" }],
    },
    warnings: [],
    items: [],
    questionsForClient: [],
    priceBand: "unknown",
    unreadableFiles: [],
    referenceVersion: "test",
  });

  assert.equal(outcome.ok, false);
  assert.match(outcome.ok ? "" : outcome.error, /no notes were provided/);
});

test("a review with no rejection block still validates", () => {
  // Reviews stored before Scope C have no such field, and getReviewForSubmission
  // re-validates every stored row before rendering it.
  const outcome = validateAnalysis({
    summary: "s",
    warnings: [],
    items: [],
    questionsForClient: [],
    priceBand: "unknown",
    unreadableFiles: [],
    referenceVersion: "test",
  });

  assert.equal(outcome.ok, true);
});
