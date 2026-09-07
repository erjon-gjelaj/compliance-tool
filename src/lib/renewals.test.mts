import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  DUE_SOON_DAYS,
  describeDue,
  needingAttention,
  renewalFor,
  renewalsFor,
} from "./renewals.ts";
import type { DocumentWithVersions, VersionRow } from "./programs/store.ts";

/**
 * When a program is due to be looked at again.
 *
 * The failure this module exists to avoid is a date nobody gave us. A
 * contractor plans around a renewal list — they tell a hiring client when
 * their paperwork was last reviewed, and they decide what to spend a
 * Saturday on. An invented date is therefore worse than no date, and it is
 * invisible: a wrong renewal looks exactly like a right one.
 *
 * So most of what follows checks that nothing is produced rather than that
 * something is.
 */

function version(over: Partial<VersionRow> = {}): VersionRow {
  return {
    id: "v1",
    document_id: "d1",
    created_at: "2026-01-15T00:00:00Z",
    version: 1,
    template_version: "1.0.0",
    answers: {},
    docx_path: "a.docx",
    pdf_path: "a.pdf",
    effective_date: "2026-01-15",
    superseded_at: null,
    revision_reason: null,
    ...over,
  };
}

function doc(
  over: Partial<DocumentWithVersions> = {},
): DocumentWithVersions {
  const current = over.current === undefined ? version() : over.current;

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
    versions: current ? [current] : [],
    ...over,
    current,
  };
}

const on = (date: string) => new Date(`${date}T12:00:00Z`);

/* ------------------------------------------------------------------ *
 * Nothing is invented
 * ------------------------------------------------------------------ */

test("a document with no version has no renewal", () => {
  assert.equal(renewalFor(doc({ current: null }), on("2026-06-01")), null);
});

test("a superseded version has no renewal", () => {
  // A revision restarts the year. Showing a review overdue on a document
  // somebody has already replaced is how a renewal list teaches people to
  // ignore it.
  const stale = version({ superseded_at: "2026-03-01T00:00:00Z" });
  assert.equal(renewalFor(doc({ current: stale }), on("2027-06-01")), null);
});

test("an unparseable effective date produces nothing, not today plus a year", () => {
  for (const bad of ["", "not a date", "0000-00-00"]) {
    assert.equal(
      renewalFor(doc({ current: version({ effective_date: bad }) }), on("2026-06-01")),
      null,
      `"${bad}" produced a renewal date`,
    );
  }
});

test("documents with nothing to say are dropped from the list, not listed as unknown", () => {
  const list = renewalsFor(
    [
      doc({ id: "a", current: null }),
      doc({ id: "b", current: version({ superseded_at: "2026-02-01T00:00:00Z" }) }),
    ],
    on("2026-06-01"),
  );

  assert.deepEqual(list, []);
});

/* ------------------------------------------------------------------ *
 * The date is the document's own commitment
 * ------------------------------------------------------------------ */

test("the review date is one year after the date printed on the document", () => {
  // Not one year after we generated it, and not one year from today. The
  // effective date is what the reader of the document sees.
  const renewal = renewalFor(doc(), on("2026-06-01"));
  assert.equal(renewal!.effectiveDate, "2026-01-15");
  assert.equal(renewal!.reviewDue, "2027-01-15");
});

test("a leap day clamps rather than drifting into March", () => {
  const renewal = renewalFor(
    doc({ current: version({ effective_date: "2024-02-29" }) }),
    on("2024-06-01"),
  );

  assert.equal(renewal!.reviewDue, "2025-02-28");
});

test("the end of a long month does not roll over", () => {
  // The classic setMonth bug: 31 January plus a month is 3 March. It only
  // bites here through the leap-day path, and this pins the arithmetic.
  for (const [effective, due] of [
    ["2026-01-31", "2027-01-31"],
    ["2026-03-31", "2027-03-31"],
    ["2026-12-31", "2027-12-31"],
  ]) {
    const renewal = renewalFor(
      doc({ current: version({ effective_date: effective }) }),
      on("2026-06-01"),
    );
    assert.equal(renewal!.reviewDue, due, `${effective} became ${renewal!.reviewDue}`);
  }
});

/* ------------------------------------------------------------------ *
 * Status
 * ------------------------------------------------------------------ */

test("a document issued today is current, not due", () => {
  const renewal = renewalFor(
    doc({ current: version({ effective_date: "2026-06-01" }) }),
    on("2026-06-01"),
  );

  assert.equal(renewal!.status, "current");
  assert.equal(renewal!.daysUntilDue, 365);
});

test("the day the review falls due is due, not overdue", () => {
  // Off by one here tells somebody they are late on the morning they are not.
  const renewal = renewalFor(doc(), on("2027-01-15"));

  assert.equal(renewal!.daysUntilDue, 0);
  assert.equal(renewal!.status, "due_soon");
  assert.equal(describeDue(renewal!), "Review is due today");
});

test("the day after is overdue", () => {
  const renewal = renewalFor(doc(), on("2027-01-16"));
  assert.equal(renewal!.status, "overdue");
});

test("the boundary of due soon is inclusive and does not shift", () => {
  const inside = renewalFor(doc(), on("2026-12-05"));
  assert.equal(inside!.daysUntilDue, DUE_SOON_DAYS - 1);
  assert.equal(inside!.status, "due_soon");

  // One day earlier than the window is still current.
  const outside = renewalFor(doc(), on("2026-12-03"));
  assert.ok(outside!.daysUntilDue > DUE_SOON_DAYS);
  assert.equal(outside!.status, "current");
});

test("a time of day never changes the answer", () => {
  // Whole days, or a review flips between due and overdue depending on when
  // somebody opens the page.
  const early = renewalFor(doc(), new Date("2027-01-15T00:00:01Z"));
  const late = renewalFor(doc(), new Date("2027-01-15T23:59:59Z"));

  assert.equal(early!.status, late!.status);
  assert.equal(early!.daysUntilDue, late!.daysUntilDue);
});

/* ------------------------------------------------------------------ *
 * The list
 * ------------------------------------------------------------------ */

test("the soonest is first, overdue before due", () => {
  const list = renewalsFor(
    [
      doc({ id: "fresh", current: version({ effective_date: "2026-05-01" }) }),
      doc({ id: "late", current: version({ effective_date: "2025-01-01" }) }),
      doc({ id: "soon", current: version({ effective_date: "2025-07-10" }) }),
    ],
    on("2026-06-01"),
  );

  assert.deepEqual(
    list.map((entry) => entry.documentId),
    ["late", "soon", "fresh"],
  );
});

test("current documents are not raised as needing attention", () => {
  // If everything shows amber, nothing does.
  const list = renewalsFor(
    [
      doc({ id: "fresh", current: version({ effective_date: "2026-05-01" }) }),
      doc({ id: "late", current: version({ effective_date: "2025-01-01" }) }),
    ],
    on("2026-06-01"),
  );

  const attention = needingAttention(list);
  assert.equal(attention.length, 1);
  assert.equal(attention[0].documentId, "late");
});

/* ------------------------------------------------------------------ *
 * What it says
 * ------------------------------------------------------------------ */

test("nothing claims a document has expired or is invalid", () => {
  // An annual review is what the document commits to. It is not an expiry,
  // and a program that has not been reviewed has not stopped being their
  // program — saying otherwise would be a claim about their compliance,
  // which this product does not make anywhere.
  const overdue = renewalFor(doc(), on("2028-01-01"))!;
  const soon = renewalFor(doc(), on("2026-12-20"))!;

  for (const text of [describeDue(overdue), describeDue(soon)]) {
    for (const forbidden of ["expired", "invalid", "no longer valid", "out of date", "non-compliant"]) {
      assert.ok(!text.toLowerCase().includes(forbidden), `"${text}" says "${forbidden}"`);
    }
  }
});

test("overdue reads in months once it is past a month", () => {
  assert.match(describeDue(renewalFor(doc(), on("2027-01-16"))!), /yesterday/);
  assert.match(describeDue(renewalFor(doc(), on("2027-02-01"))!), /17 days ago/);
  assert.match(describeDue(renewalFor(doc(), on("2027-07-15"))!), /about 6 months ago/);
});
