import { strict as assert } from "node:assert";
import { test } from "node:test";

import { INCIDENT } from "./incident.ts";
import { assembleProgram } from "./assemble.ts";
import { visibleQuestions } from "./validate.ts";
import { isOfferable } from "./types.ts";
import type { Answers, CompanyContext, Section } from "./types.ts";

/**
 * Incident Reporting and Investigation.
 *
 * Negative tests, for the reason recorded in ppe.test.mts: the failure of a
 * generated safety document is never a crash. It is a finished, plausible
 * file that says something untrue, forwarded to a hiring client.
 *
 * Two failure modes belong to this programme in particular.
 *
 * The first is a hand-written regulatory deadline. Serious injuries are
 * reportable to OSHA on a clock, the numbers are easy to half-remember, and a
 * wrong one printed in somebody's own safety programme is worse than saying
 * nothing — it is checkable, and it will be checked. The document commits to
 * reporting on the same day instead, which is stricter than any deadline and
 * therefore cannot be wrong in either direction.
 *
 * The second is a document that quietly deters reporting. A programme that
 * threatens discipline for a late report, or that routes a complaint about
 * the safety manager back to the safety manager, buys silence — and silence
 * is the failure this whole programme exists to prevent.
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
  report_timing: "immediately",
  host_sites: "yes",
  record_location: "a folder in the office safe",
  investigation_lead: "responsible_role",
  osha_log: "yes",
  post_incident_testing: "no",
};

function build(answers: Answers, ctx = context()) {
  const outcome = assembleProgram({ template: INCIDENT, answers, context: ctx });
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

/** The notification ladder, which is the load-bearing part of the document. */
function ladder(sections: Section[]): string[] {
  const section = sections.find((s) => s.heading.startsWith("Reporting:"));
  const list = section?.blocks.find((b) => b.type === "numbered");
  return list?.type === "numbered" ? list.items : [];
}

/* ------------------------------------------------------------------ *
 * The release gate
 * ------------------------------------------------------------------ */

test("incident reporting is offered to customers", () => {
  // Lifted by the owner on 2026-09-07, with the rendered document sent to
  // them at the same time.
  //
  // Kept and pointed the other way, as PPE's is: the regression to catch now
  // is a silent demotion, whose symptom is an absence rather than an error.
  assert.equal(
    isOfferable(INCIDENT.release),
    true,
    "incident reporting stopped being offered — if that was deliberate, say so here",
  );
});

/* ------------------------------------------------------------------ *
 * No regulatory assertion, and above all no hand-written deadline
 * ------------------------------------------------------------------ */

test("no section tells the reader what the law obliges them to do", () => {
  const text = prose(
    build({ ...BASE, post_incident_testing: "yes" }).sections,
  );

  for (const forbidden of [
    "29 CFR",
    "1904.",
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

test("no reporting deadline is stated in hours or days", () => {
  // The expensive mistake for this programme specifically. "Within 8 hours"
  // and "within 24 hours" are the two numbers everybody half-remembers, and
  // writing either by hand puts an unverified regulatory deadline into a
  // document a hiring client can check in a minute.
  const text = prose(build({ ...BASE, post_incident_testing: "yes" }).sections);

  for (const pattern of [
    /within \d+ hours?/i,
    /within \d+ days?/i,
    /\b8 hours\b/i,
    /\b24 hours\b/i,
    /\b72 hours\b/i,
  ]) {
    assert.ok(!pattern.test(text), `a deadline was written by hand: ${pattern}`);
  }
});

test("the OSHA rung commits to the same day and defers on the requirement", () => {
  // The replacement for the deadline: a commitment stricter than any of them,
  // plus an instruction to check the actual requirement at the time.
  const osha = ladder(build(BASE).sections).find((step) => step.includes("OSHA"));

  assert.ok(osha, "nothing in the ladder reports a fatality to anybody");
  assert.match(osha!, /same day/, "no timing commitment at all");
  assert.match(
    osha!,
    /confirms at that point what OSHA currently asks/,
    "the document decides for itself what OSHA wants",
  );
});

test("it never claims the company's records satisfy anybody", () => {
  const text = prose(build(BASE).sections).toLowerCase();

  for (const claim of [
    "in compliance",
    "compliant with",
    "satisfies the requirements",
    "meets all requirements",
    "fully compliant",
  ]) {
    assert.ok(!text.includes(claim), `asserted compliance: "${claim}"`);
  }
});

test("it never claims an investigation has happened or an action was closed", () => {
  const text = prose(build(BASE).sections).toLowerCase();

  for (const claim of [
    "have been investigated",
    "has been investigated",
    "have been trained",
    "has been trained",
    "were closed out",
    "have been completed",
  ]) {
    assert.ok(!text.includes(claim), `asserted as fact: "${claim}"`);
  }
});

/* ------------------------------------------------------------------ *
 * The document must not deter reporting
 * ------------------------------------------------------------------ */

test("nothing in it threatens anybody for reporting, or for reporting late", () => {
  for (const timing of ["immediately", "same_shift", "same_day"]) {
    const text = prose(build({ ...BASE, report_timing: timing }).sections);

    assert.match(
      text,
      /No employee of .* is disciplined, penalized, or treated any differently for reporting/,
      `the "${timing}" document drops the no-retaliation commitment`,
    );

    for (const threat of [
      "disciplinary action will",
      "may be subject to discipline",
      "failure to report will result",
      "grounds for dismissal",
      "grounds for termination",
    ]) {
      assert.ok(!text.toLowerCase().includes(threat), `the document threatens: "${threat}"`);
    }
  }
});

test("a complaint about the responsible person does not route back to them", () => {
  // A no-retaliation clause whose only escape hatch is the person it is
  // protecting against is decoration.
  const text = prose(build({ ...BASE, responsible_role: "safety_manager" }).sections);
  assert.match(text, /or with the Owner directly where the Safety Manager is the person concerned/);
});

test("an owner-run company does not escalate from the owner to the owner", () => {
  const text = prose(build({ ...BASE, responsible_role: "owner" }).sections);

  assert.ok(!/Owner, or with the Owner/.test(text), "the sentence names the owner twice");
  assert.match(text, /raises it with the Owner directly/);
});

test("treatment always comes before a drug test", () => {
  const text = prose(build({ ...BASE, post_incident_testing: "yes" }).sections);
  assert.match(text, /medical treatment to an injured person always comes first/);
  assert.match(text, /Nobody is tested because they reported an incident/);
});

/* ------------------------------------------------------------------ *
 * Who is told, in what order — the thing the requirement asks for
 * ------------------------------------------------------------------ */

test("the ladder is an ordered list, not a paragraph about telling people", () => {
  // lib/requirements: "Check it says who is told, in what order." Prose that
  // mentions the same people in a sentence is what gets sent back.
  const steps = ladder(build(BASE).sections);
  assert.ok(steps.length >= 4, `the ladder has only ${steps.length} steps`);
});

test("the client is in the ladder when crews work on client sites", () => {
  const withClient = ladder(build(BASE).sections).join("\n");

  assert.match(withClient, /control room/, "the host site is not told at all");
  assert.match(withClient, /client's contact for the job/);
});

test("a company with no client sites gets no client rungs and no gap in the numbering", () => {
  const steps = ladder(build({ ...BASE, host_sites: "no" }).sections);
  const text = steps.join("\n");

  assert.ok(!text.includes("client's contact"), "a client rung survived");
  assert.ok(!text.includes("control room"));

  // The rungs are list items, so the renderer numbers them — the failure to
  // guard against is the client section surviving, not a literal "3." string.
  assert.ok(steps.length >= 3, "removing the client rungs emptied the ladder");
  assert.ok(steps.some((step) => step.includes("OSHA")));
});

test("the host-employer section only appears for companies that work on client sites", () => {
  const headings = (answers: Answers) => build(answers).sections.map((s) => s.heading);

  assert.ok(headings(BASE).includes("Incidents Involving a Client or Host Employer"));
  assert.ok(
    !headings({ ...BASE, host_sites: "no" }).includes(
      "Incidents Involving a Client or Host Employer",
    ),
  );
});

test("the host's own investigation never substitutes for the company's", () => {
  // The failure this prevents: a subcontractor with no record of their own
  // incident because the plant wrote one they were never given a copy of.
  const text = prose(build(BASE).sections);
  assert.match(text, /own investigation is carried out regardless of whether the host runs one/);
});

/* ------------------------------------------------------------------ *
 * What gets written down
 * ------------------------------------------------------------------ */

test("the record is a table of fields, and every field says what goes in it", () => {
  const section = build(BASE).sections.find((s) => s.heading === "What Gets Written Down");
  const table = section?.blocks.find((b) => b.type === "table");

  assert.ok(table, "the fields must be a table, not a paragraph listing them");

  if (table?.type === "table") {
    assert.ok(table.rows.length >= 8, "too few fields to be a usable record");

    // Unlike the EAP's site record this table is NOT blank: it is the list of
    // what a record carries, so an empty cell here is a missing instruction.
    for (const row of table.rows) {
      assert.equal(row.length, table.head.length);
      for (const cell of row) {
        assert.ok(cell.trim().length > 0, `an empty cell in "${row[0]}"`);
      }
    }

    const fields = table.rows.map((row) => row[0].toLowerCase()).join(" | ");
    assert.match(fields, /who was notified/, "no record of who was told");
    assert.match(fields, /corrective actions/);
    assert.match(fields, /closed out by/, "nothing records that an action was actually done");
  }
});

test("near misses are reportable, and said to be the valuable ones", () => {
  // The single most common gap in a subcontractor's programme: an incident
  // procedure that only starts once somebody is hurt.
  const text = prose(build(BASE).sections).toLowerCase();
  assert.ok(text.includes("near miss"));
  assert.match(text, /did not cause an injury but could have/);
});

test("an action is not closed out until somebody confirmed it was done", () => {
  const text = prose(build(BASE).sections);
  assert.match(text, /closed out only when somebody has confirmed it was actually done/);
});

test("blame is not an acceptable finding", () => {
  const text = prose(build(BASE).sections);
  assert.match(text, /not to establish who to blame/);
  assert.match(text, /concludes an employee was careless has not finished/);
});

/* ------------------------------------------------------------------ *
 * Conditionals and substitution
 * ------------------------------------------------------------------ */

test("the OSHA log section only appears for companies that keep one", () => {
  assert.ok(
    build(BASE).sections.some((s) => s.heading === "Injury and Illness Records"),
  );
  assert.ok(
    !build({ ...BASE, osha_log: "no" }).sections.some(
      (s) => s.heading === "Injury and Illness Records",
    ),
  );
});

test("an incident record is kept even when the incident never reaches the log", () => {
  // Otherwise the two get conflated and first-aid cases go unrecorded.
  const text = prose(build(BASE).sections);
  assert.match(text, /completed for every incident whether or not it goes on the log/);
});

test("post-incident testing only appears where a contract requires it", () => {
  assert.ok(
    !build(BASE).sections.some((s) => s.heading === "Post-Incident Testing"),
  );
  assert.ok(
    build({ ...BASE, post_incident_testing: "yes" }).sections.some(
      (s) => s.heading === "Post-Incident Testing",
    ),
  );
});

test("the smallest possible company still gets a complete program", () => {
  // Every conditional section drops out. What is left has to be a document
  // somebody could actually work to, not a shell.
  const { outcome, sections } = build({
    ...BASE,
    host_sites: "no",
    osha_log: "no",
    post_incident_testing: "no",
    responsible_role: "owner",
    investigation_lead: "owner",
  });

  assert.equal(outcome.ok, true, JSON.stringify(outcome));

  const headings = sections.map((s) => s.heading);
  for (const required of [
    "What Counts as an Incident",
    "Reporting: Who Is Told, and in What Order",
    "What Gets Written Down",
    "Investigation",
    "Corrective Actions and Closing Out",
  ]) {
    assert.ok(headings.includes(required), `no "${required}" section`);
  }
});

test("every investigation lead option names somebody, and none reviews itself", () => {
  for (const lead of ["responsible_role", "supervisor_with_role", "owner"]) {
    const text = prose(build({ ...BASE, investigation_lead: lead }).sections);
    assert.match(
      text,
      /Safety Manager|Owner|Site Supervisor|Operations Manager/,
      `the "${lead}" wording names no one`,
    );
  }

  const supervisorLed = prose(
    build({ ...BASE, investigation_lead: "supervisor_with_role" }).sections,
  );
  assert.match(supervisorLed, /does not close out their own investigation/);
});

test("the company name reaches the document and no fixture leaks", () => {
  const { sections } = build(BASE, context({ companyName: "Bayou Mechanical LLC" }));
  const text = prose(sections);

  assert.ok(text.includes("Bayou Mechanical LLC"));
  assert.ok(!text.includes("Redline"));
});

test("where records are kept comes from the answer, not from a default", () => {
  const text = prose(
    build({ ...BASE, record_location: "the shared drive the office manages" }).sections,
  );

  assert.ok(text.includes("the shared drive the office manages"));
  assert.ok(!text.includes("office safe"), "a fixture answer survived into the document");
});

test("the prose is written in American English", () => {
  const text = prose(
    build({ ...BASE, post_incident_testing: "yes" }).sections,
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
    "penalised",
  ]) {
    assert.ok(!new RegExp(british, "i").test(text), `British spelling "${british}"`);
  }
});

/* ------------------------------------------------------------------ *
 * The questionnaire
 * ------------------------------------------------------------------ */

test("the questionnaire stays short", () => {
  const most = visibleQuestions(INCIDENT, BASE, context());
  assert.ok(most.length <= 7, `questionnaire grew to ${most.length}`);
});

test("nothing is asked about the company's past incidents", () => {
  // An answer about the past would be printed as a claim a hiring client
  // could check. A program says what the Company does from now on.
  const asked = INCIDENT.questions
    .map((q) => `${q.prompt} ${q.help ?? ""}`)
    .join(" ")
    .toLowerCase();

  for (const past of ["how many", "emr", "trir", "last year", "have you had"]) {
    assert.ok(!asked.includes(past), `the questionnaire asks about the past: "${past}"`);
  }
});

test("a missing required answer stops the document", () => {
  const incomplete = { ...BASE };
  delete incomplete.record_location;

  assert.equal(build(incomplete).outcome.ok, false);
});
