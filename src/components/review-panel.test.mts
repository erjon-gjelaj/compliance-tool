import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ReviewPanel } from "./review-panel.tsx";
import type { Analysis, AnalysisItem } from "@/lib/analysis/schema";

/**
 * The regulatory output rules, checked against what actually renders.
 *
 * These are the same rules the review email is bound by, and they are the
 * ones that would do real damage if they quietly stopped holding: a
 * low-confidence guess printed as a finding, a hiring client's requirement
 * stated as known, or a file we could not open sitting in a list looking
 * reviewed. Reading the component is not enough — this renders it.
 */

function item(overrides: Partial<AnalysisItem> = {}): AnalysisItem {
  return {
    requirement: "Written safety manual or programme",
    source: "platform",
    status: "likely_missing",
    confidence: "high",
    basis: "no uploaded document mentioned a written programme",
    action: "Send the manual if you have one.",
    citations: [],
    ...overrides,
  };
}

function review(overrides: Partial<Analysis> = {}): Analysis {
  return {
    summary: "A preliminary look at what your file still needs.",
    warnings: [],
    items: [item()],
    questionsForClient: [],
    priceBand: "medium",
    unreadableFiles: [],
    referenceVersion: "2026-07-26.1",
    ...overrides,
  };
}

/**
 * Renders the component to HTML.
 *
 * These tests deliberately do NOT run under the `react-server` condition the
 * lib tests use. react-dom refuses to render DOM at all under that condition
 * — server components are meant to be turned into markup by the framework,
 * not by the RSC renderer — so the two suites are separate scripts. See the
 * `test:ui` script in package.json.
 */
function render(analysis: Analysis, unreadable: string[] = []): string {
  return renderToStaticMarkup(
    createElement(ReviewPanel, { review: analysis, unreadableFiles: unreadable }),
  );
}

test("it always says it is preliminary and not an audit", () => {
  const html = render(review());

  assert.match(html, /Preliminary automated review/);
  assert.match(html, /not a certified audit/);
  assert.match(html, /not legal advice/);
  assert.match(html, /Confirm anything here with your hiring client/);
});

test("a low-confidence item renders as a question, never as a status", () => {
  const html = render(
    review({ items: [item({ confidence: "low", status: "likely_missing" })] }),
  );

  assert.match(html, /does this apply to you\?/);
  // The status it carries must not reach the page for a low-confidence item.
  assert.doesNotMatch(html, /Looks missing/);
});

test("a low-confidence PRESENT item is still a question, not a covered finding", () => {
  // The trap in grouping by status instead of by confidence. A ticked-but-not-
  // found item is status "present" at low confidence, and matching on status
  // first would file it under "What looks covered" with a green "Looks
  // present" against it — telling someone a document is in hand on the
  // strength of them having ticked a box.
  const html = render(
    review({ items: [item({ status: "present", confidence: "low" })] }),
  );

  assert.match(html, /does this apply to you\?/);
  assert.doesNotMatch(html, /Looks present/);
  assert.doesNotMatch(html, /What looks covered/);
});

test("the conclusion counts only what we were willing to state", () => {
  // A low-confidence item must not inflate the "of N document types" figure:
  // it was not one of the ones we checked and concluded on.
  const html = render(
    review({
      items: [
        item({ requirement: "A", status: "likely_missing", confidence: "high" }),
        item({ requirement: "B", status: "present", confidence: "low" }),
      ],
    }),
  );

  assert.match(html, /1 of the 1 document types/);
});

test("a high-confidence item does state its status", () => {
  const html = render(review({ items: [item({ confidence: "high" })] }));

  assert.match(html, /Looks missing/);
  assert.doesNotMatch(html, /does this apply to you\?/);
});

test("the three sources are never merged", () => {
  const html = render(
    review({
      items: [
        item({ requirement: "A", source: "osha", confidence: "high" }),
        item({ requirement: "B", source: "platform", confidence: "high" }),
        item({ requirement: "C", source: "hiring_client", confidence: "low" }),
      ],
    }),
  );

  assert.match(html, /Required by OSHA/);
  // Platform requirements are contractual and ours to be wrong about; the
  // page has to say so rather than letting them read as law.
  assert.match(html, /our understanding, not law/);
  assert.match(html, /Specific to your hiring client/);
});

test("a citation that does not support its claim is not printed", async () => {
  const supported = {
    cfr: "29 CFR 1910.147",
    title: "The control of hazardous energy (lockout/tagout)",
    verifiedAt: "2026-07-16",
    supportsClaim: true,
  };

  const unsupported = {
    cfr: "29 CFR 1910.1001",
    title: "Asbestos",
    verifiedAt: "2026-07-16",
    supportsClaim: false,
  };

  const html = render(
    review({ items: [item({ citations: [supported, unsupported] })] }),
  );

  assert.match(html, /1910\.147/);
  assert.doesNotMatch(html, /1910\.1001/);
  // Labelled as a standard on the subject, not as this contractor's duty.
  assert.match(html, /OSHA standards on this subject/);
});

test("every rendered item shows what it is based on", () => {
  const html = render(
    review({
      items: [
        item({ requirement: "A", confidence: "high" }),
        item({ requirement: "B", confidence: "low" }),
      ],
    }),
  );

  // Twice: the finding and the question both carry their basis. An item with
  // nothing behind it is not something this page may show.
  assert.equal(html.match(/Based on:/g)?.length, 2);
});

test("unreadable files are named, not silently dropped", () => {
  const html = render(review(), ["scanned-manual.pdf"]);

  assert.match(html, /scanned-manual\.pdf/);
  assert.match(html, /1 file was not read/);
  assert.match(html, /Nothing above takes it into account/);
});

test("an all-unknown review collapses instead of printing the catalogue", async () => {
  const items = ["A", "B", "C"].map((requirement) =>
    item({ requirement, status: "unknown", confidence: "low" }),
  );

  const html = render(
    review({ items, questionsForClient: ["What trade are you bidding?"] }),
  );

  assert.match(html, /What we&#x27;d normally look for/);
  assert.match(html, /couldn&#x27;t check any of these against your file/);
  assert.match(html, /Start here/);
});

test("an unknown price band does not promise a cost", () => {
  const html = render(review({ priceBand: "unknown" }));

  assert.match(html, /About pricing/);
  assert.doesNotMatch(html, /What this would cost/);
  assert.match(html, /not a quote/);
});

test("the reference version and the independence disclaimer are always shown", () => {
  const html = render(review());

  assert.match(html, /2026-07-26\.1/);
  assert.match(html, /not affiliated with, endorsed by/);
});
