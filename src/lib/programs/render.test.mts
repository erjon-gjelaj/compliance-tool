import { strict as assert } from "node:assert";
import { test } from "node:test";

import { HAZCOM } from "./hazcom.ts";
import { validateDocument, nextUnanswered, visibleQuestions } from "./validate.ts";
import { assembleProgram } from "./assemble.ts";
import type { Answers, CompanyContext } from "./types.ts";

/**
 * The regression fixtures.
 *
 * Six company shapes, each exercising a different combination of conditional
 * sections. They are here because the failure mode of a conditional document
 * is not a crash — it is a programme that describes a practice the customer
 * told us they do not have, in a file they forward to a hiring client.
 */

function context(over: Partial<CompanyContext> = {}): CompanyContext {
  return {
    companyName: "Redline Industrial Services",
    trade: "Welding / fabrication",
    headcountBand: "6-10",
    operatingStates: ["TX"],
    platforms: "ISNetworld",
    hiringClients: ["Gulf Refining"],
    operations: null,
    logoUrl: null,
    ...over,
  };
}

const BASE: Answers = {
  responsible_role: "owner",
  sds_format: "paper",
  sds_location: "the site office and each work truck",
  labelling: "manufacturer",
  multi_employer: "no",
  non_routine: "no",
};

/**
 * Goes through the real pipeline rather than calling build directly, because
 * the ordering in assembleProgram — answers checked before assembly — is
 * itself one of the things worth testing.
 */
function build(answers: Answers, ctx = context()) {
  const outcome = assembleProgram({ template: HAZCOM, answers, context: ctx });
  return { outcome, sections: outcome.ok ? outcome.sections : [] };
}

function headings(answers: Answers, ctx = context()) {
  return HAZCOM.build(answers, ctx).map((section) => section.heading);
}

test("fixture: small contractor, paper binders, no multi-employer work", () => {
  const { outcome, sections } = build(BASE);

  assert.equal(outcome.ok, true, JSON.stringify(outcome));
  assert.ok(sections.length >= 8);
});

test("fixture: digital SDS access", () => {
  const { outcome, sections } = build({ ...BASE, sds_format: "digital" });

  assert.equal(outcome.ok, true);
  const text = JSON.stringify(sections);
  assert.match(text, /maintained electronically/);
  assert.doesNotMatch(text, /maintained in printed form and are available/);
});

test("fixture: both paper and digital access", () => {
  const { outcome, sections } = build({ ...BASE, sds_format: "both" });

  assert.equal(outcome.ok, true);
  assert.match(JSON.stringify(sections), /both in printed form and electronically/);
});

test("fixture: multi-employer sites add their sections", () => {
  const answers = { ...BASE, multi_employer: "yes", unlabelled_pipes: "yes" };
  const { outcome } = build(answers);

  assert.equal(outcome.ok, true);
  const list = headings(answers);
  assert.ok(list.includes("Multi-Employer Workplaces"));
  assert.ok(list.includes("Unlabelled Pipes and Lines"));
});

test("fixture: a contractor working alone gets no multi-employer section", () => {
  // The failure that matters: a programme describing coordination with other
  // employers, sent by somebody who told us they work alone.
  const list = headings(BASE);

  assert.ok(!list.includes("Multi-Employer Workplaces"));
  assert.ok(!list.includes("Unlabelled Pipes and Lines"));
});

test("fixture: no non-routine tasks means no non-routine section", () => {
  assert.ok(!headings(BASE).includes("Non-Routine Tasks"));
  assert.ok(headings({ ...BASE, non_routine: "yes" }).includes("Non-Routine Tasks"));
});

test("fixture: no logo is a normal company, not an error", () => {
  const { outcome } = build(BASE, context({ logoUrl: null }));
  assert.equal(outcome.ok, true);
});

test("the company name reaches the document", () => {
  const { sections } = build(BASE, context({ companyName: "Bayou Mechanical" }));
  assert.match(JSON.stringify(sections), /Bayou Mechanical/);
});

test("the responsible role is printed as a role, never as a raw answer id", () => {
  const { sections } = build({ ...BASE, responsible_role: "safety_manager" });
  const text = JSON.stringify(sections);

  assert.match(text, /Safety Manager/);
  assert.doesNotMatch(text, /safety_manager/);
});

/* ---------------------------------------------------------------- */
/* The gate                                                          */
/* ---------------------------------------------------------------- */

test("a missing required answer stops the document", () => {
  const answers = { ...BASE };
  delete (answers as Record<string, string>).sds_location;

  const { outcome } = build(answers);

  // Caught before assembly. build() reads answers without fallbacks on
  // purpose, so reaching it with an incomplete set would throw.
  assert.equal(outcome.ok, false);
  assert.ok(!outcome.ok && outcome.problems.some((p) => p.code === "missing_answer"));
});

test("an answer to a question that no longer applies is a contradiction", () => {
  // They answered the unlabelled-pipes question, then changed multi-employer
  // to no. Building from the stale answer would put a section in the document
  // describing work they have said they do not do.
  const { outcome } = build({
    ...BASE,
    multi_employer: "no",
    unlabelled_pipes: "yes",
  });

  assert.equal(outcome.ok, false);
  assert.ok(
    !outcome.ok && outcome.problems.some((p) => p.code === "contradictory_answer"),
  );
});

test("an unresolved placeholder is refused", () => {
  const ctx = context();
  const sections = [
    { heading: "Purpose", blocks: [{ type: "paragraph" as const, text: "Prepared for [Insert name]." }] },
  ];

  const outcome = validateDocument({ template: HAZCOM, answers: BASE, context: ctx, sections });

  assert.equal(outcome.ok, false);
  assert.ok(
    !outcome.ok && outcome.problems.some((p) => p.code === "unresolved_placeholder"),
  );
});

test("an undefined that reached the prose is refused", () => {
  // What a missing substitution actually looks like once it has been through
  // a template literal: the word "undefined" in the middle of a sentence.
  const sections = [
    { heading: "Responsibilities", blocks: [{ type: "paragraph" as const, text: "The undefined is responsible." }] },
  ];

  const outcome = validateDocument({
    template: HAZCOM,
    answers: BASE,
    context: context(),
    sections,
  });

  assert.equal(outcome.ok, false);
  assert.ok(!outcome.ok && outcome.problems.some((p) => p.code === "undefined_value"));
});

test("an empty section is refused", () => {
  const outcome = validateDocument({
    template: HAZCOM,
    answers: BASE,
    context: context(),
    sections: [{ heading: "Scope", blocks: [] }],
  });

  assert.equal(outcome.ok, false);
  assert.ok(!outcome.ok && outcome.problems.some((p) => p.code === "empty_section"));
});

test("a missing company name is refused", () => {
  const ctx = context({ companyName: "" });
  const outcome = validateDocument({
    template: HAZCOM,
    answers: BASE,
    context: ctx,
    sections: HAZCOM.build(BASE, ctx),
  });

  assert.equal(outcome.ok, false);
  assert.ok(!outcome.ok && outcome.problems.some((p) => p.code === "missing_company"));
});

/* ---------------------------------------------------------------- */
/* The questionnaire                                                 */
/* ---------------------------------------------------------------- */

test("the questionnaire stays short", () => {
  // The product rule is 4-8 visible questions. A regression here means
  // somebody added a question without removing one, and the flow that was
  // meant to take two minutes has started to grow.
  const shown = visibleQuestions(HAZCOM, BASE, context());

  assert.ok(shown.length >= 4 && shown.length <= 8, `${shown.length} questions`);
});

test("the unlabelled-pipes question is only asked of multi-employer sites", () => {
  const alone = visibleQuestions(HAZCOM, BASE, context()).map((q) => q.id);
  const shared = visibleQuestions(
    HAZCOM,
    { ...BASE, multi_employer: "yes" },
    context(),
  ).map((q) => q.id);

  assert.ok(!alone.includes("unlabelled_pipes"));
  assert.ok(shared.includes("unlabelled_pipes"));
});

test("nextUnanswered walks the questionnaire and then reports done", () => {
  const answers: Answers = {};
  const seen: string[] = [];

  for (let guard = 0; guard < 20; guard += 1) {
    const question = nextUnanswered(HAZCOM, answers, context());
    if (!question) break;
    seen.push(question.id);
    answers[question.id] = question.kind === "boolean" ? "no" : question.options?.[0]?.id ?? "somewhere";
  }

  assert.equal(nextUnanswered(HAZCOM, answers, context()), null);
  assert.ok(seen.includes("responsible_role"));
});
