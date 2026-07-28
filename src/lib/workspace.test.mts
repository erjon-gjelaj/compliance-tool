import { strict as assert } from "node:assert";
import { test } from "node:test";

import { buildWorkspace } from "./workspace.ts";
import type { DashboardSubmission } from "./dashboard.ts";
import type { Analysis, AnalysisItem } from "./analysis/schema.ts";

/**
 * What the dashboard tells someone to do next.
 *
 * The failures worth catching are the confident wrong ones: telling a
 * contractor a document is missing when what we established is that we never
 * looked at one, and pointing at the wrong blocker while an unfinished form
 * sits there producing nothing.
 */

function submission(over: Partial<DashboardSubmission> = {}): DashboardSubmission {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    created_at: "2026-07-20T00:00:00Z",
    updated_at: "2026-07-20T00:00:00Z",
    status: "complete",
    last_step: 4,
    entry_reason: "gap_check",
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
    documentCount: 1,
    hasReview: true,
    ...over,
  };
}

function item(over: Partial<AnalysisItem> = {}): AnalysisItem {
  return {
    requirement: "Lockout/tagout programme",
    source: "platform",
    status: "likely_missing",
    confidence: "medium",
    basis: "not mentioned in the file you sent",
    action: "Send the programme.",
    citations: [],
    ...over,
  };
}

function review(items: AnalysisItem[], over: Partial<Analysis> = {}): Analysis {
  return {
    summary: "s",
    warnings: [],
    items,
    questionsForClient: [],
    priceBand: "unknown",
    unreadableFiles: [],
    referenceVersion: "test",
    ...over,
  };
}

function build(over: Parameters<typeof buildWorkspace>[0]) {
  return buildWorkspace(over);
}

test("an unknown item is not a blocker", () => {
  // The one that matters. "unknown" means we had nothing to go on — no file,
  // or one we could not read. Listing it under "what's holding you up" tells
  // someone a document is missing when what we established is that we never
  // looked at one.
  const active = submission();

  const workspace = build({
    submissions: [active],
    documents: [],
    activeSubmission: active,
    activeReview: review([
      item({ status: "unknown", requirement: "Fall protection programme" }),
      item({ status: "present", requirement: "Hazard communication programme" }),
    ]),
  });

  assert.deepEqual(workspace.blockers, []);
});

test("an unfinished form outranks everything else", () => {
  // It produces no review at all, so every other instruction is premature.
  const partial = submission({
    id: "22222222-2222-4222-8222-222222222222",
    status: "partial",
    last_step: 2,
    analysis_status: null,
  });
  const active = submission();

  const workspace = build({
    submissions: [partial, active],
    documents: [],
    activeSubmission: active,
    activeReview: review([item()]),
  });

  assert.match(workspace.next.title, /Finish the form/);
  assert.equal(workspace.next.href, `/dashboard/${partial.id}`);
});

test("a rejection with nothing attached asks for the notice", () => {
  const blind = submission({
    id: "33333333-3333-4333-8333-333333333333",
    entry_reason: "rejection",
    rejection_notes: null,
    documentCount: 0,
  });

  const workspace = build({
    submissions: [blind],
    documents: [],
    activeSubmission: blind,
    activeReview: null,
  });

  assert.match(workspace.next.title, /Send us what came back/);
});

test("a rejection that came with notes is not chased for them", () => {
  const withNotes = submission({
    entry_reason: "rejection",
    rejection_notes: "Your energy control procedure is insufficient.",
    documentCount: 0,
  });

  const workspace = build({
    submissions: [withNotes],
    documents: [],
    activeSubmission: withNotes,
    activeReview: review([item()]),
  });

  assert.doesNotMatch(workspace.next.title, /Send us what came back/);
});

test("no submissions produces a start action, not an error state", () => {
  const workspace = build({
    submissions: [],
    documents: [],
    activeSubmission: null,
    activeReview: null,
  });

  assert.match(workspace.next.title, /Tell us what you're up against/);
  assert.deepEqual(workspace.blockers, []);
});

test("a deadline is only reported when one was actually given", () => {
  // Nothing here infers a date. deadline_unknown is a real answer and must not
  // become a made-up deadline on the header.
  const workspace = build({
    submissions: [submission({ deadline: null, deadline_unknown: true })],
    documents: [],
    activeSubmission: submission(),
    activeReview: null,
  });

  assert.equal(workspace.nextDeadline, null);
});

test("the soonest given deadline is the one shown", () => {
  const workspace = build({
    submissions: [
      submission({ id: "a", deadline: "2026-11-01", hiring_client: "Late Plant" }),
      submission({ id: "b", deadline: "2026-08-15", hiring_client: "Soon Plant" }),
    ],
    documents: [],
    activeSubmission: submission(),
    activeReview: null,
  });

  assert.equal(workspace.nextDeadline?.hiringClient, "Soon Plant");
});

test("unreadable files are carried through rather than dropped", () => {
  // Silence must never imply "reviewed and fine".
  const active = submission();

  const workspace = build({
    submissions: [active],
    documents: [],
    activeSubmission: active,
    activeReview: review([], { unreadableFiles: ["scan.pdf"] }),
  });

  assert.deepEqual(workspace.unreadable, ["scan.pdf"]);
});
