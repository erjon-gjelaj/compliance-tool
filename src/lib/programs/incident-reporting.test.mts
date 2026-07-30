import { strict as assert } from "node:assert";
import { test } from "node:test";

import { assembleProgram } from "./assemble.ts";
import { INCIDENT_REPORTING } from "./incident-reporting.ts";
import { offerablePrograms, programForLabel } from "./registry.ts";
import { visibleQuestions } from "./validate.ts";
import type { Answers, CompanyContext } from "./types.ts";

function context(): CompanyContext {
  return {
    companyName: "Redline Industrial Services",
    trade: "Welding / fabrication",
    headcountBand: "6-10",
    operatingStates: ["TX"],
    platforms: "ISNetworld",
    hiringClients: ["Gulf Refining"],
    operations: null,
    logoUrl: null,
  };
}

const BASE: Answers = {
  first_contact_role: "supervisor",
  reporting_route: "phone_text",
  host_sites: "no",
  investigator_role: "safety_manager",
  corrective_owner_role: "operations_manager",
  records_location: "the restricted safety drive and the main office incident file",
};

function build(answers: Answers = BASE) {
  return assembleProgram({
    template: INCIDENT_REPORTING,
    answers,
    context: context(),
  });
}

test("incident reporting is customer-available without inventing a requirement join", () => {
  assert.ok(
    offerablePrograms().some(
      (program) => program.id === INCIDENT_REPORTING.id,
    ),
  );
  assert.equal(INCIDENT_REPORTING.requirementId, undefined);
  assert.equal(
    programForLabel("Incident reporting and investigation programme")?.id,
    INCIDENT_REPORTING.id,
  );
});

test("a complete fixture passes the assembly gate", () => {
  const outcome = build();
  assert.equal(outcome.ok, true, JSON.stringify(outcome));
  assert.ok(outcome.ok && outcome.sections.length === 9);
});

test("the notification order and record location come from answers", () => {
  const outcome = build();
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;

  const text = JSON.stringify(outcome.sections);
  assert.match(text, /first internal contact is the Site Supervisor/);
  assert.match(text, /notifies the Safety Manager/);
  assert.match(text, /restricted safety drive/);
  assert.match(text, /Operations Manager assigns each corrective action/);
  assert.doesNotMatch(text, /first_contact_role|corrective_owner_role/);
});

test("host-site coordination appears only when confirmed", () => {
  const no = INCIDENT_REPORTING.build(BASE, context()).map(
    (section) => section.heading,
  );
  const yes = INCIDENT_REPORTING.build(
    { ...BASE, host_sites: "yes" },
    context(),
  ).map((section) => section.heading);

  assert.ok(!no.includes("Customer and Host-Site Coordination"));
  assert.ok(yes.includes("Customer and Host-Site Coordination"));
});

test("the questionnaire stays low-input", () => {
  assert.equal(
    visibleQuestions(INCIDENT_REPORTING, BASE, context()).length,
    6,
  );
});

test("missing the record location stops assembly", () => {
  const answers = { ...BASE };
  delete answers.records_location;

  const outcome = build(answers);
  assert.equal(outcome.ok, false);
  assert.ok(
    !outcome.ok &&
      outcome.problems.some((problem) => problem.code === "missing_answer"),
  );
});

test("the policy does not declare event-specific reporting conclusions or deadlines", () => {
  const outcome = build();
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;

  const text = JSON.stringify(outcome.sections);
  assert.doesNotMatch(text, /\bwithin (?:eight|8|twenty-four|24) hours?\b/i);
  assert.doesNotMatch(text, /\bthis event is (?:recordable|reportable)\b/i);
  assert.match(text, /does not itself decide/);
});

test("investigations focus on causes rather than blame", () => {
  const outcome = build();
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;

  const text = JSON.stringify(outcome.sections);
  assert.match(text, /underlying system or programme causes/);
  assert.match(text, /not to select a person to blame/);
});
