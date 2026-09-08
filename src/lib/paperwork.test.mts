import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  buildPaperwork,
  nextAction,
  progress,
  programForRequirementKey,
} from "./paperwork.ts";
import type { FileRequirement } from "./domain-dashboard.ts";
import type { LibraryDocument } from "./dashboard.ts";
import type { DocumentWithVersions } from "./programs/store.ts";
import type { MaintenanceRow } from "./maintenance.ts";

/**
 * The one list.
 *
 * This is the screen the product is now built around, so the failures worth
 * catching are the ones that make it untrustworthy rather than the ones that
 * make it crash:
 *
 *  - a document somebody owns disappearing from their own list
 *  - "create it" offered for something we cannot actually write
 *  - a guess about whether a client requires something
 *  - a list where everything is urgent, which is a list nobody reads
 */

function requirement(over: Partial<FileRequirement> = {}): FileRequirement {
  return {
    id: "r1",
    category_key: "written_programs",
    requirement_key: "program.hazcom",
    title: "Hazard Communication",
    status: "missing",
    applicability: "included",
    due_date: null,
    ...over,
  };
}

function generated(
  over: Partial<DocumentWithVersions> = {},
): DocumentWithVersions {
  const version = {
    id: "v1",
    document_id: "d1",
    created_at: "2026-01-15T00:00:00Z",
    version: 2,
    template_version: "1.0.0",
    answers: {},
    docx_path: "a.docx",
    pdf_path: "a.pdf",
    effective_date: "2026-01-15",
    superseded_at: null,
    revision_reason: null,
  };

  return {
    id: "d1",
    created_at: "2026-01-15T00:00:00Z",
    updated_at: "2026-01-15T00:00:00Z",
    email: "sam@example.com",
    company_id: null,
    program_id: "hazard_communication",
    submission_id: null,
    request_id: null,
    platform: "ISNetworld",
    hiring_client: null,
    versions: [version],
    current: version,
    ...over,
  } as DocumentWithVersions;
}

function upload(over: Partial<LibraryDocument> = {}): LibraryDocument {
  return {
    id: "u1",
    file_name: "manual.pdf",
    readable: true,
    ...over,
  } as LibraryDocument;
}

function reminder(over: Partial<MaintenanceRow> = {}): MaintenanceRow {
  return {
    id: "m1",
    created_at: "2026-01-15T00:00:00Z",
    updated_at: "2026-01-15T00:00:00Z",
    email: "sam@example.com",
    uploaded_document_id: null,
    generated_document_id: null,
    document_name: "Hazard Communication",
    kind: "review",
    due_date: "2027-01-15",
    note: null,
    ...over,
  } as MaintenanceRow;
}

const empty = {
  requirements: [],
  generated: [],
  uploaded: [],
  reminders: [],
};

/* ------------------------------------------------------------------ *
 * The generator join
 * ------------------------------------------------------------------ */

test("a requirement maps to the generator that answers it", () => {
  // The config keys programs as "hazcom" and the registry as
  // "hazard_communication". If this join breaks, every program silently
  // becomes something the customer has to write themselves.
  assert.equal(programForRequirementKey("program.hazcom"), "hazard_communication");
});

test("a requirement we cannot write returns nothing", () => {
  // Offering "create it" for a program that does not exist sends somebody to
  // a 404 from the one screen they are meant to trust.
  assert.equal(programForRequirementKey("program.excavation"), undefined);
  assert.equal(programForRequirementKey("insurance.gl"), undefined);
  assert.equal(programForRequirementKey("nonsense"), undefined);
});

/* ------------------------------------------------------------------ *
 * Nothing anybody owns ever disappears
 * ------------------------------------------------------------------ */

test("a document they hold shows up even when no requirement asked for it", () => {
  // Generated before a requirement set existed. Omitting it looks like we
  // lost their file.
  const items = buildPaperwork({ ...empty, generated: [generated()] });

  assert.equal(items.length, 1);
  assert.equal(items[0].state, "ready");
  assert.equal(items[0].documentId, "d1");
});

test("a held document is not also listed as missing", () => {
  const items = buildPaperwork({
    ...empty,
    requirements: [requirement()],
    generated: [generated()],
  });

  assert.equal(items.length, 1, "the same program was listed twice");
  assert.equal(items[0].state, "ready");
});

test("a held document links to the document, not to the questionnaire", () => {
  const items = buildPaperwork({
    ...empty,
    requirements: [requirement()],
    generated: [generated()],
  });

  assert.match(items[0].action!.href, /^\/dashboard\/documents\/d1$/);
});

/* ------------------------------------------------------------------ *
 * Never guess on the customer's behalf
 * ------------------------------------------------------------------ */

test("an unknown requirement is a question, never a task", () => {
  // We cannot see inside a client's portal. Telling somebody to write a
  // program their client may not want is worse than saying we do not know.
  const items = buildPaperwork({
    ...empty,
    requirements: [requirement({ applicability: "unknown" })],
  });

  assert.equal(items[0].state, "ask_your_client");
  assert.equal(items[0].action, null, "an unconfirmed requirement got an action");
});

test("an unknown requirement stays a question even when we could write it", () => {
  // The tempting bug: we have a generator, so we offer it. But applicability
  // is about their client, not about our capability.
  const items = buildPaperwork({
    ...empty,
    requirements: [requirement({ applicability: "unknown" })],
  });

  assert.notEqual(items[0].state, "we_can_write_it");
});

test("something already sent is not offered for writing again", () => {
  for (const status of ["submitted", "under_review", "accepted"]) {
    const items = buildPaperwork({
      ...empty,
      requirements: [requirement({ status })],
    });

    assert.equal(items[0].state, "ready", `"${status}" was shown as outstanding`);
  }
});

test("a record only they can hold asks them to send it", () => {
  const items = buildPaperwork({
    ...empty,
    requirements: [
      requirement({ requirement_key: "insurance.gl", title: "Certificate of insurance" }),
    ],
  });

  assert.equal(items[0].state, "you_provide_it");
  assert.match(items[0].action!.label, /upload/i);
});

test("a written program we have not automated is not called unknowable", () => {
  /*
   * The distinction this catches, and it misleads in both directions.
   *
   * A ladder safety program is exactly the kind of thing this product
   * writes — it simply is not one of the four generators yet. Filing it under
   * "we have no way of knowing this one" tells a contractor we are less
   * capable than we are, and does it for a dozen rows at once, which is most
   * of what their list looks like.
   *
   * The inverse is worse: implying we could produce their certificate of
   * insurance, which comes from their broker and never from us.
   */
  const items = buildPaperwork({
    ...empty,
    requirements: [
      requirement({ requirement_key: "program.ladder", title: "Ladder Safety" }),
    ],
  });

  assert.equal(items[0].state, "not_automated");
  assert.doesNotMatch(items[0].detail, /no way of knowing/);
  assert.match(items[0].action!.label, /ask/i);
});

test("the two kinds of missing never collapse into one", () => {
  const items = buildPaperwork({
    ...empty,
    requirements: [
      requirement({ requirement_key: "program.ladder", title: "Ladder Safety" }),
      requirement({ requirement_key: "insurance.gl", title: "Certificate of insurance" }),
    ],
  });

  const states = items.map((item) => item.state);
  assert.deepEqual(states, ["not_automated", "you_provide_it"]);
});

/* ------------------------------------------------------------------ *
 * Not everything is urgent
 * ------------------------------------------------------------------ */

test("a review due next year is not raised as needing attention", () => {
  // If half the list sits under a warning heading, the heading stops meaning
  // anything and the genuinely overdue item is lost in it.
  const items = buildPaperwork({
    ...empty,
    requirements: [requirement()],
    generated: [generated()],
    reminders: [reminder({ due_date: "2027-06-01" })],
    today: "2026-06-01",
  });

  assert.equal(items[0].state, "ready");
});

test("a review that has passed is raised", () => {
  const items = buildPaperwork({
    ...empty,
    requirements: [requirement()],
    generated: [generated()],
    reminders: [reminder({ due_date: "2026-01-01" })],
    today: "2026-06-01",
  });

  assert.equal(items[0].state, "needs_attention");
  assert.match(items[0].detail, /Due for review/);
});

test("an expiry says expires, not due for review", () => {
  // A certificate that has lapsed and a program due a read are different
  // problems, and a contractor treats them differently.
  const items = buildPaperwork({
    ...empty,
    requirements: [requirement()],
    generated: [generated()],
    reminders: [reminder({ kind: "expiry", due_date: "2026-01-01" })],
    today: "2026-06-01",
  });

  assert.match(items[0].detail, /Expires/);
});

test("a file we could not read is raised, and says why", () => {
  const items = buildPaperwork({
    ...empty,
    uploaded: [upload({ readable: false, file_name: "scan.pdf" })],
  });

  assert.equal(items[0].state, "needs_attention");
  assert.match(items[0].detail, /no text layer/);
  // It has to say what is at stake, or it reads as busywork ahead of the
  // things they actually came here to do.
  assert.match(items[0].detail, /counted towards your list/);
});

test("readable uploads are not listed as tasks", () => {
  // Every file somebody sent is not a to-do. Only the ones we failed on.
  const items = buildPaperwork({ ...empty, uploaded: [upload()] });
  assert.deepEqual(items, []);
});

/* ------------------------------------------------------------------ *
 * One next thing
 * ------------------------------------------------------------------ */

test("what is broken comes before what is merely missing", () => {
  const items = buildPaperwork({
    ...empty,
    requirements: [requirement()],
    uploaded: [upload({ readable: false })],
  });

  assert.equal(nextAction(items)!.state, "needs_attention");
});

test("what we can do for them comes before what they must send", () => {
  const items = buildPaperwork({
    ...empty,
    requirements: [
      requirement({ requirement_key: "insurance.gl", title: "Certificate of insurance" }),
      requirement(),
    ],
  });

  assert.equal(nextAction(items)!.state, "we_can_write_it");
});

test("a finished file has no next action", () => {
  const items = buildPaperwork({
    ...empty,
    requirements: [requirement()],
    generated: [generated()],
  });

  assert.equal(nextAction(items), null);
});

test("nothing at all has no next action, rather than a made-up one", () => {
  assert.equal(nextAction(buildPaperwork(empty)), null);
});

/* ------------------------------------------------------------------ *
 * Progress
 * ------------------------------------------------------------------ */

test("progress counts only what they can act on", () => {
  // Counting unconfirmed requirements in the denominator means the bar never
  // fills, and a bar that cannot reach the end is worse than no bar.
  const items = buildPaperwork({
    ...empty,
    requirements: [
      requirement(),
      requirement({ requirement_key: "program.loto", title: "Lockout/Tagout" }),
      requirement({
        requirement_key: "program.silica",
        title: "Silica",
        applicability: "unknown",
      }),
    ],
    generated: [generated()],
  });

  assert.deepEqual(progress(items), { ready: 1, total: 2 });
});

test("an empty file reports nothing rather than dividing by zero", () => {
  assert.deepEqual(progress(buildPaperwork(empty)), { ready: 0, total: 0 });
});
