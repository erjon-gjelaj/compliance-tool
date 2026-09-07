import { strict as assert } from "node:assert";
import { test } from "node:test";

import { EAP } from "./eap.ts";
import { assembleProgram } from "./assemble.ts";
import { visibleQuestions } from "./validate.ts";
import { isOfferable } from "./types.ts";
import type { Answers, CompanyContext, Section } from "./types.ts";

/**
 * The Emergency Action Plan.
 *
 * Negative tests, for the reason recorded in ppe.test.mts: the failure of a
 * generated safety document is never a crash. It is a finished, plausible
 * file that says something untrue, forwarded to a hiring client.
 *
 * This programme has one failure mode the other two do not. A subcontractor's
 * emergency plan is mostly about sites the Company does not control, so the
 * expensive mistake is a document that sounds authoritative about
 * arrangements it cannot possibly know.
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
  responsible_role: "safety_manager",
  own_premises: "yes",
  premises_muster: "the far end of the parking lot, by the gate",
  host_sites: "yes",
  alarm: "site_alarm",
  accounting: "supervisor_headcount",
  rescue_duties: "no",
};

function build(answers: Answers, ctx = context()) {
  const outcome = assembleProgram({ template: EAP, answers, context: ctx });
  return { outcome, sections: outcome.ok ? outcome.sections : [] };
}

function prose(sections: Section[]): string {
  return sections
    .flatMap((section) => [
      section.heading,
      ...section.blocks.flatMap((block) => {
        if (block.type === "paragraph") return [block.text];
        if (block.type === "bullets" || block.type === "numbered") return block.items;
        return [...block.head, ...block.rows.flat()];
      }),
    ])
    .join("\n");
}

/* ------------------------------------------------------------------ *
 * The release gate
 * ------------------------------------------------------------------ */

test("EAP is not offered until somebody signs off the prose", () => {
  // Same rule as every programme: lifted by a person, and the lift recorded
  // with a date in the template. HazCom and PPE carry that record; this does
  // not yet, so it must not be reachable by a customer.
  assert.equal(isOfferable(EAP.release), false);
});

/* ------------------------------------------------------------------ *
 * What it must never say
 * ------------------------------------------------------------------ */

test("no section tells the reader what the law obliges them to do", () => {
  const text = prose(build({ ...BASE, rescue_duties: "yes" }).sections);

  for (const forbidden of [
    "OSHA",
    "29 CFR",
    "1910.",
    "1926.",
    "required by law",
    "the law requires",
    "you must",
    "legally",
    "regulation",
  ]) {
    assert.ok(!text.includes(forbidden), `the document says "${forbidden}"`);
  }
});

test("sourceRef never reaches the page", () => {
  const { sections } = build(BASE);
  assert.ok(sections.some((s) => s.sourceRef));
  assert.ok(!prose(sections).includes("1910.38"));
});

test("it never claims a particular site's arrangements are known", () => {
  const text = prose(build(BASE).sections).toLowerCase();

  // The expensive lie: naming a muster point for a refinery nobody has
  // visited. The plan may only describe how the arrangements are FOUND OUT.
  for (const claim of [
    "the muster point is",
    "the assembly point for all sites",
    "all sites use",
    "every site uses",
  ]) {
    assert.ok(!text.includes(claim), `the plan asserts site knowledge: "${claim}"`);
  }
});

test("it never claims anyone has been trained or drilled", () => {
  const text = prose(build(BASE).sections).toLowerCase();

  for (const claim of [
    "have been trained",
    "has been trained",
    "have completed",
    "drills have been",
    "alarms are tested monthly",
  ]) {
    assert.ok(!text.includes(claim), `asserted as fact: "${claim}"`);
  }
});

/* ------------------------------------------------------------------ *
 * The site record — the thing that stops it being generic
 * ------------------------------------------------------------------ */

test("the site record is a real table with a row to complete", () => {
  const { sections } = build(BASE);
  const record = sections.find((s) => s.heading === "Site Emergency Record");

  assert.ok(record, "the site record is what makes this plan site-specific");

  const table = record!.blocks.find((b) => b.type === "table");
  assert.ok(table, "the record must be a table, not a paragraph about one");

  if (table?.type === "table") {
    assert.ok(table.head.includes("Assembly point"));
    assert.ok(table.head.includes("Alarm signal"));
    assert.ok(table.rows.length >= 1, "there must be somewhere to write");
    // Blank on purpose. A pre-filled example row would be read as a real
    // arrangement by somebody skimming.
    assert.ok(
      table.rows.every((row) => row.every((cell) => cell === "")),
      "a pre-filled row would be mistaken for a real site arrangement",
    );
  }
});

test("the blank row is explained, so it does not read as unfinished", () => {
  const text = prose(build(BASE).sections);
  assert.ok(
    /A blank row is not an oversight/.test(text),
    "a reviewer seeing an empty table needs to be told why it is empty",
  );
});

/* ------------------------------------------------------------------ *
 * Conditionals, including the combination that could empty the plan
 * ------------------------------------------------------------------ */

test("a plan is still coherent when there are no premises and no client sites", () => {
  // Both conditional location sections drop out here. The failure this
  // guards is an emergency plan with nothing in it about evacuating.
  const answers = { ...BASE, own_premises: "no", host_sites: "no" };
  // Deleted rather than set to undefined: the key being present at all is
  // what the validator calls a contradictory answer, and rightly so.
  delete answers.premises_muster;

  const { outcome, sections } = build(answers);

  assert.equal(outcome.ok, true, JSON.stringify(outcome));

  const headings = sections.map((s) => s.heading);
  assert.ok(headings.includes("Evacuation"), "no evacuation section at all");
  assert.ok(headings.includes("Accounting for Employees"));
  assert.ok(headings.includes("Site Emergency Record"));
});

test("no client-site work removes the host section but keeps the record", () => {
  const headings = build({ ...BASE, host_sites: "no" }).sections.map((s) => s.heading);

  assert.ok(!headings.some((h) => h.includes("Host Employer")));
  assert.ok(headings.includes("Site Emergency Record"));
});

test("no premises means no premises section, and no stray muster point", () => {
  const answers = { ...BASE, own_premises: "no" };
  delete answers.premises_muster;

  const { sections } = build(answers);

  assert.ok(!sections.some((s) => s.heading === "Company Premises"));
  assert.ok(
    !prose(sections).includes("the far end of the parking lot"),
    "an answer to a question that no longer applies reached the document",
  );
});

test("rescue duties only appear when somebody holds them", () => {
  assert.ok(!build(BASE).sections.some((s) => s.heading === "Rescue and Medical Duties"));
  assert.ok(
    build({ ...BASE, rescue_duties: "yes" }).sections.some(
      (s) => s.heading === "Rescue and Medical Duties",
    ),
  );
});

/* ------------------------------------------------------------------ *
 * Substitution and the safety inversions
 * ------------------------------------------------------------------ */

test("the site's own alarm takes precedence over anything we carry", () => {
  // The inversion that would get somebody hurt: a crew listening for their
  // own air horn on a site with a real alarm.
  const text = prose(build({ ...BASE, alarm: "air_horn" }).sections);
  assert.ok(/site's alarm takes precedence|alarm takes precedence/i.test(text));
});

test("nobody is sent back in to look for a missing person", () => {
  const text = prose(build(BASE).sections);
  assert.ok(/No .* employee re-enters to look for them/.test(text));
});

test("accounting is by name, not by headcount alone", () => {
  // A headcount that happens to match is the classic way a missing person is
  // missed. Every one of the three methods must say "by name".
  for (const method of ["supervisor_headcount", "sign_in", "phone_roll"]) {
    const text = prose(build({ ...BASE, accounting: method }).sections);
    assert.ok(
      /by name/.test(text),
      `the "${method}" wording does not account for people by name`,
    );
  }
});

test("the company name reaches the document and no fixture leaks", () => {
  const { sections } = build(BASE, context({ companyName: "Bayou Mechanical LLC" }));
  const text = prose(sections);

  assert.ok(text.includes("Bayou Mechanical LLC"));
  assert.ok(!text.includes("Redline"));
});

test("the prose is written in American English", () => {
  const text = prose(build({ ...BASE, rescue_duties: "yes" }).sections);

  for (const british of [
    "defence",
    "specialised",
    "recognised",
    "organised",
    "authorised",
    "minimise",
    "programme",
    "labelled",
    "centre",
  ]) {
    assert.ok(!new RegExp(british, "i").test(text), `British spelling "${british}"`);
  }
});

/* ------------------------------------------------------------------ *
 * The questionnaire
 * ------------------------------------------------------------------ */

test("the muster question is only asked of people with premises", () => {
  const ctx = context();
  const without = visibleQuestions(EAP, { ...BASE, own_premises: "no" }, ctx).map(
    (q) => q.id,
  );
  assert.ok(!without.includes("premises_muster"));

  const with_ = visibleQuestions(EAP, BASE, ctx).map((q) => q.id);
  assert.ok(with_.includes("premises_muster"));
});

test("the questionnaire stays short", () => {
  const most = visibleQuestions(EAP, BASE, context());
  assert.ok(most.length <= 7, `questionnaire grew to ${most.length}`);
});

test("a missing required answer stops the document", () => {
  const incomplete = { ...BASE };
  delete incomplete.accounting;

  assert.equal(build(incomplete).outcome.ok, false);
});
