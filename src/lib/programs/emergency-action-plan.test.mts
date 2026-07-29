import { strict as assert } from "node:assert";
import { test } from "node:test";

import { assembleProgram } from "./assemble.ts";
import { EMERGENCY_ACTION_PLAN } from "./emergency-action-plan.ts";
import {
  programForLabel,
  programForRequirement,
} from "./registry.ts";
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
  covered_site: "Gulf Refining, 400 Harbor Road, Baytown, Texas",
  anticipated_emergencies: "fire, gas release, severe weather, and a site evacuation order",
  coordinator_role: "supervisor",
  alarm_and_reporting:
    "Call the site emergency number from a safe location; the site siren and public-address announcement give the action to take",
  evacuation_routes:
    "Use the marked east gate route; if blocked, use the north pedestrian gate",
  muster_point: "the contractor assembly board in the east parking area",
  critical_operations: "No one; everyone evacuates immediately",
  rescue_medical: "outside",
};

function build(answers: Answers = BASE) {
  return assembleProgram({
    template: EMERGENCY_ACTION_PLAN,
    answers,
    context: context(),
  });
}

test("the emergency action plan is offerable through both joins", () => {
  assert.equal(
    programForRequirement("emergency-action-plan")?.id,
    EMERGENCY_ACTION_PLAN.id,
  );
  assert.equal(
    programForLabel("Emergency action plan")?.id,
    EMERGENCY_ACTION_PLAN.id,
  );
});

test("a complete site-specific fixture passes the assembly gate", () => {
  const outcome = build();
  assert.equal(outcome.ok, true, JSON.stringify(outcome));
  assert.ok(outcome.ok && outcome.sections.length === 9);
});

test("site, routes, alarm, and muster point come from answers", () => {
  const outcome = build();
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;

  const text = JSON.stringify(outcome.sections);
  assert.match(text, /400 Harbor Road/);
  assert.match(text, /site siren and public-address announcement/);
  assert.match(text, /north pedestrian gate/);
  assert.match(text, /contractor assembly board/);
  assert.match(text, /Site Supervisor/);
  assert.doesNotMatch(text, /coordinator_role/);
});

test("the rescue policy follows the customer's selected arrangement", () => {
  const firstAid = build({ ...BASE, rescue_medical: "first_aid" });
  assert.equal(firstAid.ok, true);
  if (!firstAid.ok) return;

  const text = JSON.stringify(firstAid.sections);
  assert.match(text, /separately designated and qualified/);
  assert.doesNotMatch(text, /site's designated emergency response team/);
});

test("the questionnaire reflects the higher site-specific input cost", () => {
  const shown = visibleQuestions(EMERGENCY_ACTION_PLAN, BASE, context());
  assert.equal(shown.length, 8);
});

test("a missing muster point stops assembly before prose is built", () => {
  const answers = { ...BASE };
  delete answers.muster_point;

  const outcome = build(answers);
  assert.equal(outcome.ok, false);
  assert.ok(
    !outcome.ok &&
      outcome.problems.some((problem) => problem.code === "missing_answer"),
  );
});

test("the plan does not claim employee instruction or responder qualification", () => {
  const outcome = build();
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;

  const text = JSON.stringify(outcome.sections);
  assert.doesNotMatch(text, /\bemployees have completed (training|instruction)\b/i);
  assert.doesNotMatch(text, /\bemployees are qualified (?:responders|for rescue)\b/i);
  assert.match(text, /does not itself record/);
});
