import { strict as assert } from "node:assert";
import { test } from "node:test";

import { HAZCOM } from "./hazcom.ts";
import { assembleProgram } from "./assemble.ts";
import { renderDocx } from "./render-docx.ts";
import { renderPdf } from "./render-pdf.ts";
import type { Answers, CompanyContext } from "./types.ts";

/**
 * The rendered files themselves.
 *
 * These exist because of a bug that no structural test could have caught: the
 * PDF footer was drawn below the bottom margin, pdfkit paginated
 * automatically, and every content page was followed by a blank one carrying
 * only a header. Nine pages for a five-page document, and the section tree was
 * perfectly correct throughout.
 *
 * So these assert on the bytes and on the text read back out of them.
 */

const CONTEXT: CompanyContext = {
  companyName: "Redline Industrial Services",
  trade: "Welding / fabrication",
  headcountBand: "6-10",
  operatingStates: ["TX"],
  platforms: "ISNetworld",
  hiringClients: ["Gulf Refining"],
  operations: null,
  logoUrl: null,
};

const ANSWERS: Answers = {
  responsible_role: "safety_manager",
  sds_format: "both",
  sds_location: "the site office and each work truck",
  labelling: "both",
  multi_employer: "yes",
  unlabelled_pipes: "yes",
  non_routine: "yes",
};

const META = {
  companyName: CONTEXT.companyName,
  title: HAZCOM.title,
  version: 1,
  effectiveDate: "28 July 2026",
  revisionDate: null,
};

function sections() {
  const outcome = assembleProgram({ template: HAZCOM, answers: ANSWERS, context: CONTEXT });
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.problems));
  return outcome.sections;
}

test("the DOCX is a real Word file", async () => {
  const buffer = await renderDocx(META, sections());

  // A .docx is a zip. PK is the only proof that matters here.
  assert.equal(buffer.subarray(0, 2).toString(), "PK");
  assert.ok(buffer.length > 5000, `only ${buffer.length} bytes`);
});

test("the PDF is a real PDF", async () => {
  const buffer = await renderPdf(META, sections());

  assert.equal(buffer.subarray(0, 5).toString(), "%PDF-");
  assert.ok(buffer.length > 5000, `only ${buffer.length} bytes`);
});

test("the PDF has no blank pages", async () => {
  // The regression. A page carrying only the running header means the footer
  // triggered pdfkit's automatic pagination again.
  const buffer = await renderPdf(META, sections());

  const { extractText, getDocumentProxy } = await import("unpdf");
  const proxy = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(proxy, { mergePages: false });

  for (const [index, page] of (text as string[]).entries()) {
    const withoutChrome = page
      .replace(META.companyName, "")
      .replace(HAZCOM.title, "")
      .replace(/Page \d+/, "")
      .replace(/[\s—-]/g, "");

    assert.ok(
      withoutChrome.length > 20,
      `page ${index + 1} carries nothing but chrome`,
    );
  }
});

test("the PDF carries the cover, the contents and every section", async () => {
  const buffer = await renderPdf(META, sections());

  const { extractText, getDocumentProxy } = await import("unpdf");
  const proxy = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(proxy, { mergePages: true });
  const whole = (text as string).replace(/\s+/g, " ");

  assert.match(whole, /Hazard Communication Program/);
  assert.match(whole, /Effective 28 July 2026/);
  assert.match(whole, /Version 1/);
  assert.match(whole, /Contents/);

  for (const section of sections()) {
    assert.ok(
      whole.includes(section.heading),
      `"${section.heading}" is missing from the PDF`,
    );
  }
});

test("no placeholder or template syntax survives into the PDF", async () => {
  const buffer = await renderPdf(META, sections());

  const { extractText, getDocumentProxy } = await import("unpdf");
  const proxy = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(proxy, { mergePages: true });
  const whole = text as string;

  assert.doesNotMatch(whole, /undefined|\[object|\{\{|\bTBD\b/);
  // Answer ids are internal. Seeing one means a label lookup fell through.
  assert.doesNotMatch(whole, /safety_manager|multi_employer|sds_format/);
});
