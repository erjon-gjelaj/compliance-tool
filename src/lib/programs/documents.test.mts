import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  toDocuments,
  type JoinedDocumentRow,
  type VersionRow,
} from "./store.ts";

/**
 * What counts as a document the customer holds.
 *
 * The bug these are written against: a `generated_documents` row is created
 * before the PDF and DOCX are rendered, so any failure in between leaves a
 * row with no version. The pdfkit fault in 063 did that for every generation
 * over several days.
 *
 * Nothing was checking for it, so a row with no files reached the screens as
 * an ordinary document. The archive printed "Version 1 - ready to download"
 * beside a green "Ready" chip and linked to a page that answered 404. The
 * programs page counted the same row as proof the program was already
 * prepared, replaced "generate this" with "Ready", and pointed at that same
 * 404 — so the one route back to the document was gone.
 *
 * Both screens were confidently wrong rather than broken-looking, which is
 * the failure mode this product can least afford: the customer is told they
 * hold a safety program they could submit, and they hold nothing.
 */

function version(overrides: Partial<VersionRow> = {}): VersionRow {
  return {
    id: "v1",
    document_id: "doc-1",
    version: 1,
    template_version: "1.0.0",
    answers: {},
    docx_path: "doc-1/v1.docx",
    pdf_path: "doc-1/v1.pdf",
    created_at: "2026-07-01T00:00:00.000Z",
    effective_date: "2026-07-01",
    superseded_at: null,
    revision_reason: null,
    ...overrides,
  };
}

function row(overrides: Partial<JoinedDocumentRow> = {}): JoinedDocumentRow {
  return {
    id: "doc-1",
    created_at: "2026-07-01T00:00:00.000Z",
    email: "site@example.com",
    company_id: null,
    program_id: "hazcom",
    submission_id: null,
    request_id: null,
    platform: null,
    hiring_client: null,
    generated_document_versions: [version()],
    ...overrides,
  } as JoinedDocumentRow;
}

test("a document with a version is returned", () => {
  const [document] = toDocuments([row()]);

  assert.equal(document.id, "doc-1");
  assert.equal(document.current.version, 1);
});

test("a row whose generation failed before any version is not a document", () => {
  // The exact shape 063 left behind: the row was written, the render threw.
  assert.deepEqual(toDocuments([row({ generated_document_versions: [] })]), []);
  assert.deepEqual(toDocuments([row({ generated_document_versions: null })]), []);
});

test("a failed generation does not hide the working documents beside it", () => {
  const documents = toDocuments([
    row({ id: "empty", program_id: "ppe", generated_document_versions: [] }),
    row({ id: "real" }),
  ]);

  assert.equal(documents.length, 1);
  assert.equal(documents[0].id, "real");
});

test("a failed generation leaves its program free to be generated again", () => {
  /*
   * The programs page builds its "already held" set from these rows. An empty
   * one appearing here marked the program finished and withdrew the offer to
   * generate it, which is what left customers with no way back to it.
   */
  const held = new Set(
    toDocuments([
      row({ program_id: "hazcom", generated_document_versions: [] }),
    ]).map((entry) => entry.program_id),
  );

  assert.equal(held.has("hazcom"), false);
});

test("the current version is the one nobody has superseded", () => {
  const [document] = toDocuments([
    row({
      generated_document_versions: [
        version({ id: "v1", version: 1, superseded_at: "2026-07-02T00:00:00.000Z" }),
        version({ id: "v2", version: 2 }),
      ],
    }),
  ]);

  assert.equal(document.current.id, "v2");
  // Superseded versions are kept — the customer may already have sent one.
  assert.equal(document.versions.length, 2);
});

test("versions come back newest first regardless of the order stored", () => {
  const [document] = toDocuments([
    row({
      generated_document_versions: [
        version({ id: "v1", version: 1, superseded_at: "2026-07-02T00:00:00.000Z" }),
        version({ id: "v3", version: 3 }),
        version({ id: "v2", version: 2, superseded_at: "2026-07-03T00:00:00.000Z" }),
      ],
    }),
  ]);

  assert.deepEqual(
    document.versions.map((entry) => entry.version),
    [3, 2, 1],
  );
});

test("if every version is somehow superseded, the newest still shows", () => {
  /*
   * Should not happen: supersede runs only after a new version is safely
   * recorded. But blanking a document the customer holds would be worse than
   * showing them the most recent thing we made, so it falls back rather than
   * dropping out of the list entirely.
   */
  const [document] = toDocuments([
    row({
      generated_document_versions: [
        version({ id: "v1", version: 1, superseded_at: "2026-07-02T00:00:00.000Z" }),
        version({ id: "v2", version: 2, superseded_at: "2026-07-03T00:00:00.000Z" }),
      ],
    }),
  ]);

  assert.equal(document.current.id, "v2");
});
