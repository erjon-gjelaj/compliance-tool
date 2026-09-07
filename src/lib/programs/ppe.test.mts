import { strict as assert } from "node:assert";
import { test } from "node:test";

import { PPE } from "./ppe.ts";
import { assembleProgram } from "./assemble.ts";
import { visibleQuestions } from "./validate.ts";
import { isOfferable } from "./types.ts";
import type { Answers, CompanyContext, Section } from "./types.ts";

/**
 * The Personal Protective Equipment programme.
 *
 * Written as negative tests, because the failure mode of a generated safety
 * document is never a crash. It is a finished, professional-looking file that
 * says something untrue about the company whose name is on the cover — and
 * that file is the one they forward to a hiring client.
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
  assessment_by: "responsible",
  assessment_location: "the site office and each job file",
  provision: "all_provided",
  host_sites: "no",
  specialty: "no",
};

function build(answers: Answers, ctx = context()) {
  const outcome = assembleProgram({ template: PPE, answers, context: ctx });
  return { outcome, sections: outcome.ok ? outcome.sections : [] };
}

/** Every word the finished document actually contains. */
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

test("PPE is offered to customers, and that was a decision somebody made", () => {
  // Lifted by the owner on 2026-09-07, after the rendered document was sent
  // to them for review.
  //
  // The test is kept rather than deleted, pointing the other way. Its job now
  // is to catch a silent demotion: a programme quietly dropping out of the
  // customer library is the kind of regression nobody notices, because the
  // symptom is an absence rather than an error.
  assert.equal(
    isOfferable(PPE.release),
    true,
    "PPE stopped being offered — if that was deliberate, say so here",
  );
});

/* ------------------------------------------------------------------ *
 * What the document must never say
 * ------------------------------------------------------------------ */

test("no section tells the reader what the law obliges them to do", () => {
  const { sections } = build({
    ...BASE,
    host_sites: "yes",
    specialty: "yes",
    specialty_list: "hearing protection and face shields",
  });
  const text = prose(sections);

  // The whole reason this file is permitted to exist: it is policy the
  // company adopts, not advice about their legal position.
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
    assert.ok(
      !text.includes(forbidden),
      `the document says "${forbidden}", which makes it advice about the law`,
    );
  }
});

test("sourceRef is maintenance metadata and never reaches the page", () => {
  const { sections } = build(BASE);
  const refs = sections.map((s) => s.sourceRef).filter(Boolean);

  assert.ok(refs.length > 0, "the sections should carry refs for our own use");
  assert.ok(
    !prose(sections).includes("1910.132"),
    "a CFR reference was printed into the customer's document",
  );
});

test("it never claims training has already happened", () => {
  const text = prose(build(BASE).sections);

  // "Employees have been trained" is a statement about the past that a form
  // cannot establish. Every training sentence must be a commitment about what
  // happens before an assignment.
  for (const claim of [
    "have been trained",
    "has been trained",
    "are trained and",
    "all employees have",
    "have completed",
  ]) {
    assert.ok(
      !text.toLowerCase().includes(claim),
      `the document asserts training as fact: "${claim}"`,
    );
  }
});

test("it never claims particular equipment is owned", () => {
  const text = prose(build(BASE).sections).toLowerCase();

  // With specialty: "no", nothing should name a specific item of kit as held.
  for (const claim of ["the company owns", "we own", "is stocked", "in stock"]) {
    assert.ok(!text.includes(claim), `the document claims equipment is held: "${claim}"`);
  }
});

/* ------------------------------------------------------------------ *
 * Respiratory protection: the silence that would read as coverage
 * ------------------------------------------------------------------ */

test("respiratory protection is excluded in words, not by omission", () => {
  const text = prose(build(BASE).sections);

  assert.ok(
    /does not cover respiratory protection/i.test(text),
    "a PPE program silent about respirators reads as covering them",
  );
  assert.ok(
    /separate written respiratory protection program/i.test(text),
    "it should name where respirator work is governed instead",
  );
});

/* ------------------------------------------------------------------ *
 * The hazard assessment is the thing reviewers look for
 * ------------------------------------------------------------------ */

test("the written assessment and its certification both appear", () => {
  const { sections } = build(BASE);
  const headings = sections.map((s) => s.heading);

  // lib/requirements: "Check it includes the written hazard assessment, not
  // just a kit list." A document that lost these sections would still look
  // complete and would fail the one thing it is checked for.
  assert.ok(headings.includes("Hazard Assessment"));
  assert.ok(headings.includes("Written Certification of the Assessment"));
  assert.ok(headings.includes("When the Assessment Is Repeated"));

  assert.ok(
    prose(sections).includes("the site office and each job file"),
    "the document must say where the written assessment is kept",
  );
});

/* ------------------------------------------------------------------ *
 * Conditional sections
 * ------------------------------------------------------------------ */

test("a contractor with no client-site work gets no host-site section", () => {
  const headings = build(BASE).sections.map((s) => s.heading);
  assert.ok(!headings.some((h) => h.includes("Host Employer")));
});

test("client-site work adds the section, and site rules are a floor", () => {
  const { sections } = build({ ...BASE, host_sites: "yes" });
  const text = prose(sections);

  assert.ok(sections.some((s) => s.heading.includes("Host Employer")));
  // The dangerous inversion: promising to do whatever the site says, which
  // would commit the company to LESS than its own assessment found.
  assert.ok(
    /floor rather than a ceiling/i.test(text),
    "site rules must not be described as the upper limit of protection",
  );
});

test("no specialty equipment means no specialty section", () => {
  const headings = build(BASE).sections.map((s) => s.heading);
  assert.ok(!headings.includes("Task-Specific Equipment"));
});

test("specialty equipment is named in the customer's own words", () => {
  const { sections } = build({
    ...BASE,
    specialty: "yes",
    specialty_list: "hearing protection and flame-resistant clothing",
  });

  assert.ok(
    prose(sections).includes("hearing protection and flame-resistant clothing"),
    "what they told us should appear verbatim, not be re-categorised",
  );
});

/* ------------------------------------------------------------------ *
 * Substitution
 * ------------------------------------------------------------------ */

test("the assessor resolves to the real role, never to the pointer phrase", () => {
  // "the person named above" is a phrase used to build the sentence. If it
  // survives into the document it reads as a drafting error in a document the
  // customer signs.
  const { sections } = build({ ...BASE, assessment_by: "responsible" });
  const text = prose(sections);

  assert.ok(!text.includes("the person named above"));
  assert.ok(text.includes("the Owner"), "it should name the chosen role");
});

test("an outside consultant is described as one", () => {
  const text = prose(build({ ...BASE, assessment_by: "outside" }).sections);
  assert.ok(/outside safety consultant/i.test(text));
});

test("who pays is what they told us, not an assumption that we pay", () => {
  const generous = prose(build({ ...BASE, provision: "all_provided" }).sections);
  const carveOut = prose(build({ ...BASE, provision: "except_boots" }).sections);

  assert.ok(/at no cost to the employee/.test(generous));
  // Claiming the company pays for everything when it does not is a false
  // statement in a document they put their name to.
  assert.ok(/with the exception of ordinary safety-toe footwear/.test(carveOut));
  assert.notEqual(generous, carveOut);
});

test("the company name reaches every part of the document", () => {
  const { sections } = build(BASE, context({ companyName: "Bayou Mechanical LLC" }));
  const text = prose(sections);

  assert.ok(text.includes("Bayou Mechanical LLC"));
  assert.ok(!text.includes("Redline"), "a fixture name leaked into the output");
});

/* ------------------------------------------------------------------ *
 * The questionnaire
 * ------------------------------------------------------------------ */

test("a missing required answer stops the document", () => {
  const incomplete = { ...BASE };
  delete incomplete.assessment_location;
  const { outcome } = build(incomplete);

  assert.equal(outcome.ok, false, "an unanswered question produced a document");
});

test("the specialty follow-up is only asked of people who said yes", () => {
  const hidden = visibleQuestions(PPE, BASE, context()).map((q) => q.id);
  assert.ok(!hidden.includes("specialty_list"));

  const shown = visibleQuestions(PPE, { ...BASE, specialty: "yes" }, context()).map((q) => q.id);
  assert.ok(shown.includes("specialty_list"));
});

test("the questionnaire stays short", () => {
  // Seven at full branching. The audience fills this in on a phone, and the
  // reason the chemical inventory is not asked for in HazCom is the same
  // reason an equipment list is not asked for here.
  const most = visibleQuestions(PPE, { ...BASE, specialty: "yes" }, context());
  assert.ok(most.length <= 7, `questionnaire grew to ${most.length}`);
});

test("the prose is written in American English", () => {
  // The audience is US subcontractors and the document is read by US hiring
  // clients. "defence" in a safety program reads as boilerplate lifted from
  // somewhere else, which is exactly the impression this product exists to
  // avoid. Caught in review of the first rendered PDF.
  const text = prose(
    build({
      ...BASE,
      host_sites: "yes",
      specialty: "yes",
      specialty_list: "hearing protection",
    }).sections,
  );

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
    assert.ok(
      !new RegExp(british, "i").test(text),
      `British spelling "${british}" reached a document for a US contractor`,
    );
  }
});
