import { strict as assert } from "node:assert";
import { test } from "node:test";

import { buildAnalysis } from "./match.ts";
import type { ExtractedDocument } from "./documents.ts";
import type { SubmissionRow } from "../submissions.ts";

/**
 * The matcher: the code that decides what a contractor is told is missing.
 *
 * This had no tests until 2026-09-07, which mattered more after the reference
 * data grew from twelve entries to twenty-six and trade filtering went live —
 * nothing was checking that the right list reached the right person.
 *
 * Everything here is negative. A crash in this file is harmless; the review
 * simply falls back to the generic explainer. What is not harmless is a
 * confident wrong answer: telling somebody a programme is missing when the
 * file was never read, or showing a scaffolding crew a requirement written
 * for welders. Those look exactly like a working review.
 */

function submission(over: Partial<SubmissionRow> = {}): SubmissionRow {
  return {
    id: "s1",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    status: "complete",
    last_step: 4,
    entry_reason: "check_what_i_have",
    rejection_notes: null,
    trade: "Scaffolding",
    hiring_client: "Gulf Refining",
    platform: "ISNetworld",
    deadline: null,
    deadline_unknown: true,
    contact_name: "Sam",
    email: "sam@example.com",
    headcount_band: "6-10",
    states: ["TX"],
    emr: null,
    trir: null,
    previously_registered: null,
    documents_held: null,
    documents_unsure: false,
    documents_consent_at: "2026-09-01T00:00:00Z",
    analysis_status: "pending",
    analysed_at: null,
    ...over,
  };
}

function doc(
  text: string,
  over: Partial<ExtractedDocument> = {},
): ExtractedDocument {
  return {
    document: {
      id: "d1",
      storage_path: "p",
      file_name: "manual.pdf",
      mime_type: "application/pdf",
      size_bytes: 1000,
      created_at: "2026-09-01T00:00:00Z",
    },
    status: "ok",
    text,
    ...over,
  };
}

const labels = (analysis: ReturnType<typeof buildAnalysis>) =>
  analysis.items.map((item) => item.requirement);

const byLabel = (analysis: ReturnType<typeof buildAnalysis>, needle: string) =>
  analysis.items.find((item) =>
    item.requirement.toLowerCase().includes(needle.toLowerCase()),
  );

/* ------------------------------------------------------------------ *
 * The trade axis reaches the output
 * ------------------------------------------------------------------ */

test("a scaffolder's review does not contain a welder's requirements", () => {
  const analysis = buildAnalysis({
    submission: submission({ trade: "Scaffolding" }),
    documents: [doc("a safety manual mentioning scaffolding")],
  });

  const text = labels(analysis).join(" | ").toLowerCase();

  assert.ok(text.includes("scaffolding"), "the scaffolder got no scaffolding item");
  assert.ok(!text.includes("hot work"), "a scaffolding crew was shown a hot work item");
  assert.ok(!text.includes("arc flash"));
  assert.ok(!text.includes("asbestos"));
});

test("two trades produce genuinely different reviews", () => {
  const documents = [doc("generic safety manual")];

  const welder = labels(
    buildAnalysis({ submission: submission({ trade: "Welding / fabrication" }), documents }),
  );
  const insulator = labels(
    buildAnalysis({ submission: submission({ trade: "Insulation" }), documents }),
  );

  assert.notDeepEqual(
    welder,
    insulator,
    "the trade axis stopped reaching the review — everybody is back on one list",
  );
});

test('an "Other" trade is never guessed into a trade-specific requirement', () => {
  const analysis = buildAnalysis({
    submission: submission({ trade: "Other — scaffolding inspection consultancy" }),
    documents: [doc("safety manual")],
  });

  const text = labels(analysis).join(" | ").toLowerCase();

  // The free text contains "scaffolding". Matching on that would hand
  // somebody requirements for a trade nobody assessed.
  assert.ok(!text.includes("scaffolding safety"));
  assert.ok(text.includes("hazard communication"), "core requirements still apply");
});

/* ------------------------------------------------------------------ *
 * Never say "missing" without having read something
 * ------------------------------------------------------------------ */

test("nothing readable means unknown, never likely_missing", () => {
  // The worst output this product can produce: a list of things somebody is
  // told they lack, derived from no document at all.
  const analysis = buildAnalysis({
    submission: submission(),
    documents: [],
  });

  const missing = analysis.items.filter((item) => item.status === "likely_missing");
  assert.equal(missing.length, 0, "told somebody what they were missing having read nothing");
  assert.ok(analysis.items.every((item) => item.status === "unknown"));
});

test("an unreadable file is not evidence of absence", () => {
  const analysis = buildAnalysis({
    submission: submission(),
    documents: [doc("", { status: "unreadable", detail: "no text layer (likely a scan)" })],
  });

  assert.equal(
    analysis.items.filter((item) => item.status === "likely_missing").length,
    0,
    "a scan we could not read produced a missing verdict",
  );
});

test("a file read only by image recognition cannot produce a missing verdict", () => {
  // OCR drops words. It can show a subject IS covered; it can never show one
  // is absent. Left alone this tells somebody they lack a programme sitting
  // on page 12 of their own manual.
  const analysis = buildAnalysis({
    submission: submission(),
    documents: [doc("some text that ocr recovered", { status: "ocr" })],
  });

  assert.equal(
    analysis.items.filter((item) => item.status === "likely_missing").length,
    0,
    "OCR text was treated as reliable enough to declare something missing",
  );
});

test("one unreadable file poisons the missing verdict for the whole review", () => {
  // Even though a good file was also sent: the phrase could be in the part
  // we could not read.
  const analysis = buildAnalysis({
    submission: submission(),
    documents: [
      doc("a proper safety manual"),
      doc("", { status: "ocr", document: { ...doc("").document, id: "d2", file_name: "photo.jpg" } }),
    ],
  });

  assert.equal(analysis.items.filter((item) => item.status === "likely_missing").length, 0);
});

test("a readable file with nothing in it does produce missing verdicts", () => {
  // The counterpart. If this stops working the review says nothing useful.
  const analysis = buildAnalysis({
    submission: submission(),
    documents: [doc("this document is about invoicing and contains no safety content")],
  });

  assert.ok(
    analysis.items.some((item) => item.status === "likely_missing"),
    "a clean read of an irrelevant file should surface gaps",
  );
});

/* ------------------------------------------------------------------ *
 * The checklist
 * ------------------------------------------------------------------ */

test("ticking the checklist is never contradicted into likely_missing", () => {
  const analysis = buildAnalysis({
    submission: submission({ documents_held: ["Hazard communication program"] }),
    documents: [doc("an unrelated document about invoicing")],
  });

  const hazcom = byLabel(analysis, "hazard communication");
  assert.ok(hazcom);
  assert.equal(hazcom!.status, "present", "their own answer was overruled by a word search");
  assert.equal(hazcom!.confidence, "low", "a tick is weaker evidence than a document");
});

test("a low-confidence tick says plainly that we did not find it", () => {
  const analysis = buildAnalysis({
    submission: submission({ documents_held: ["Hazard communication program"] }),
    documents: [doc("an unrelated document about invoicing")],
  });

  const hazcom = byLabel(analysis, "hazard communication");
  assert.match(hazcom!.basis, /did not find it/);
});

/* ------------------------------------------------------------------ *
 * Every claim carries its basis
 * ------------------------------------------------------------------ */

test("every item cites what it is based on", () => {
  // CLAUDE.md: every item cites its basis, a document reviewed or the
  // client's own checkbox answer. An item with no basis is unfalsifiable.
  const analysis = buildAnalysis({
    submission: submission({ documents_held: ["Personal protective equipment program"] }),
    documents: [doc("hazard communication and lockout procedures")],
  });

  for (const item of analysis.items) {
    assert.ok(item.basis && item.basis.trim().length > 0, `"${item.requirement}" has no basis`);
    assert.ok(item.action && item.action.trim().length > 0, `"${item.requirement}" has no action`);
  }
});

test("a found item names the phrase and the file it was found in", () => {
  const analysis = buildAnalysis({
    submission: submission(),
    documents: [doc("our hazard communication program is maintained by the safety manager")],
  });

  const hazcom = byLabel(analysis, "hazard communication");
  assert.equal(hazcom!.status, "present");
  assert.equal(hazcom!.confidence, "high");
  assert.match(hazcom!.basis, /hazard communication/);
  assert.match(hazcom!.basis, /manual\.pdf/, "the basis must name the file a person can open");
});

/* ------------------------------------------------------------------ *
 * Citations
 * ------------------------------------------------------------------ */

test("no item is ever attributed to OSHA by the reference data alone", () => {
  const analysis = buildAnalysis({
    submission: submission(),
    documents: [doc("safety manual")],
  });

  // Everything in lib/requirements is source "platform". An item claiming
  // "osha" would mean a contractual requirement had been dressed as law.
  assert.ok(analysis.items.every((item) => item.source !== "osha"));
});

test("a citation that excludes construction says so", () => {
  const analysis = buildAnalysis({
    submission: submission(),
    documents: [doc("lockout tagout energy control procedure")],
  });

  const loto = byLabel(analysis, "lockout");
  const cited = loto!.citations.find((c) => c.cfr.includes("1910.147"));

  assert.ok(cited, "the retrieved citation went missing");
  assert.match(
    cited!.note ?? "",
    /does not cover construction/,
    "a general industry standard was shown to a plant contractor with no caveat",
  );
});

test("citations are attached regardless of whether the document mentions it", () => {
  // The standard on a subject does not depend on this contractor's file.
  const found = buildAnalysis({
    submission: submission(),
    documents: [doc("lockout tagout")],
  });
  const notFound = buildAnalysis({
    submission: submission(),
    documents: [doc("nothing relevant here at all")],
  });

  assert.ok((byLabel(found, "lockout")?.citations.length ?? 0) > 0);
  assert.ok((byLabel(notFound, "lockout")?.citations.length ?? 0) > 0);
});

/* ------------------------------------------------------------------ *
 * The price band
 * ------------------------------------------------------------------ */

test("no price band is offered when nothing was read", () => {
  // Sizing a job from a checklist tick puts a band against an assumption.
  const analysis = buildAnalysis({ submission: submission(), documents: [] });
  assert.equal(analysis.priceBand, "unknown");
});

/* ------------------------------------------------------------------ *
 * Determinism — the promise the whole no-LLM rule exists to keep
 * ------------------------------------------------------------------ */

test("the same submission produces the same review twice", () => {
  const input = {
    submission: submission({ documents_held: ["Fall protection program"] }),
    documents: [doc("scaffolding and fall protection and hazard communication")],
  };

  assert.deepEqual(buildAnalysis(input), buildAnalysis(input));
});

test("the review records which edition of the reference data produced it", () => {
  const analysis = buildAnalysis({ submission: submission(), documents: [doc("x")] });
  assert.match(analysis.referenceVersion, /^\d{4}-\d{2}-\d{2}/);
});
