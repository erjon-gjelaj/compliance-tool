import { strict as assert } from "node:assert";
import { test } from "node:test";

import { assembleProgram } from "./assemble.ts";
import { PPE } from "./ppe.ts";
import { programForLabel, programForRequirement } from "./registry.ts";
import { visibleQuestions } from "./validate.ts";
import type { Answers, CompanyContext } from "./types.ts";

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
  responsible_role: "safety_manager",
  assessment_process: "task_based",
  ppe_provided: "hard hats, safety glasses, gloves, hearing protection, and protective footwear",
  issue_method: "mixed",
  inspection_method: "before_use",
  shared_ppe: "no",
  replacement_method: "supervisor",
};

function build(answers: Answers = BASE) {
  return assembleProgram({ template: PPE, answers, context: context() });
}

test("PPE is offerable from the requirement and stored-label joins", () => {
  assert.equal(programForRequirement("ppe")?.id, PPE.id);
  assert.equal(
    programForLabel("Personal protective equipment programme")?.id,
    PPE.id,
  );
  assert.equal(
    programForLabel("Personal protective equipment program")?.id,
    PPE.id,
  );
});

test("the complete PPE fixture passes the real assembly gate", () => {
  const outcome = build();
  assert.equal(outcome.ok, true, JSON.stringify(outcome));
  assert.ok(outcome.ok && outcome.sections.length >= 9);
});

test("answers supply the company-specific equipment and assessment facts", () => {
  const outcome = build({
    ...BASE,
    assessment_process: "each_job",
    ppe_provided: "face shields and chemical-resistant gloves",
  });
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;

  const text = JSON.stringify(outcome.sections);
  assert.match(text, /each new job or at each new work location/);
  assert.match(text, /face shields and chemical-resistant gloves/);
  assert.match(text, /Safety Manager/);
  assert.doesNotMatch(text, /safety_manager/);
});

test("shared equipment adds a hygiene section only when confirmed", () => {
  const no = PPE.build(BASE, context()).map((section) => section.heading);
  const yes = PPE.build({ ...BASE, shared_ppe: "yes" }, context()).map(
    (section) => section.heading,
  );

  assert.ok(!no.includes("Shared PPE"));
  assert.ok(yes.includes("Shared PPE"));
});

test("the questionnaire stays within the five-to-seven question shape", () => {
  const shown = visibleQuestions(PPE, BASE, context());
  assert.equal(shown.length, 7);
});

test("missing equipment information stops assembly before prose is built", () => {
  const answers = { ...BASE };
  delete answers.ppe_provided;

  const outcome = build(answers);
  assert.equal(outcome.ok, false);
  assert.ok(
    !outcome.ok &&
      outcome.problems.some((problem) => problem.code === "missing_answer"),
  );
});

test("the programme does not claim a person's instruction is complete", () => {
  const outcome = build();
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;

  const text = JSON.stringify(outcome.sections);
  assert.doesNotMatch(text, /\bemployees have completed (training|instruction)\b/i);
  assert.match(text, /does not itself serve as a record/);
});
