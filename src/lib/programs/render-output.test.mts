import { strict as assert } from "node:assert";
import { test } from "node:test";

import { HAZCOM } from "./hazcom.ts";
import { assembleProgram } from "./assemble.ts";
import { renderDocx } from "./render-docx.ts";
import { renderPdf } from "./render-pdf.ts";
import type { Answers, CompanyContext, Section } from "./types.ts";

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

/**
 * A document engineered so that a page break lands in the MIDDLE of a block.
 *
 * The real programmes only break there when their prose happens to be the
 * right length, so testing on one of them is testing on a coincidence — the
 * Hazard Communication programme passed this check while the bug was live,
 * because none of its blocks straddled a boundary. The filler is sized to
 * push the list across the join every time.
 */
function straddlingPages(): Section[] {
  const filler = Array.from({ length: 26 }, (_, index) => ({
    type: "paragraph" as const,
    text:
      `Filler paragraph ${index + 1}. It exists only to consume vertical space ` +
      "so that the list below it begins near the foot of a page and continues " +
      "over the leaf, which is the condition the type-size bug needed.",
  }));

  return [
    { heading: "Filler", blocks: filler },
    {
      heading: "A List That Crosses the Join",
      blocks: [
        {
          type: "numbered",
          items: Array.from(
            { length: 12 },
            (_, index) =>
              `Step ${index + 1} of a procedure long enough that some of its steps ` +
              "are set on one page and the rest on the next.",
          ),
        },
        {
          type: "paragraph",
          text:
            "A closing paragraph, which lands on the new page and is therefore " +
            "the other shape this fault took.",
        },
      ],
    },
  ];
}

/**
 * Reads every piece of text out of a PDF's content streams together with the
 * size it was set in.
 *
 * `unpdf` gives the words but not the type, and the bug this exists for was
 * invisible in the words: correct text, set a third too small. So the content
 * streams are inflated and read directly — the sizes are what is on trial.
 */
async function typeSetInPdf(buffer: Buffer) {
  const { inflateSync } = await import("node:zlib");
  const raw = buffer.toString("latin1");

  const runs: { size: number; text: string }[] = [];

  for (const match of raw.matchAll(/stream\r?\n/g)) {
    const start = match.index! + match[0].length;
    const end = raw.indexOf("endstream", start);

    let content: string;
    try {
      content = inflateSync(Buffer.from(raw.slice(start, end), "latin1")).toString("latin1");
    } catch {
      continue; // Not a deflated content stream — a font or an image.
    }

    let size = 0;

    for (const token of content.matchAll(/\/\S+ ([\d.]+) Tf|\[(.*?)\]\s*TJ/gs)) {
      if (token[1]) {
        size = Number(token[1]);
        continue;
      }

      const text = [...token[2].matchAll(/<([0-9A-Fa-f]+)>/g)]
        .map((hex) => Buffer.from(hex[1], "hex").toString("latin1"))
        .join("");

      if (text.trim()) runs.push({ size, text });
    }
  }

  return runs;
}

test("no body text is left set in the running header's type", async () => {
  /*
   * The regression, and the reason this test reads sizes rather than words.
   *
   * The chrome is drawn at 8pt, and a page break happens in the middle of
   * somebody else's block — between a caller setting its font and that caller
   * writing its text. Restoring the cursor but not the type left the first
   * block on every new page rendered in 8pt footer type: correct content,
   * visibly wrong document. Every structural test passed throughout, because
   * the section tree was never at fault.
   */
  const buffer = await renderPdf(META, straddlingPages());
  const runs = await typeSetInPdf(buffer);

  assert.ok(runs.length > 50, `only ${runs.length} text runs — the parse failed`);

  const chrome = (text: string) =>
    text.includes(META.companyName) || /^Page \d+$/.test(text.trim());

  for (const run of runs) {
    if (run.size >= 9) continue;

    assert.ok(
      chrome(run.text),
      `body text set at ${run.size}pt: "${run.text.slice(0, 60)}"`,
    );
  }
});

test("the smallest body type is still the table type, not the footer's", async () => {
  // A guard on the other side: if the parse above ever stops finding sizes it
  // would pass vacuously. Tables are the smallest real text in the document.
  const runs = (await typeSetInPdf(await renderPdf(META, straddlingPages()))).filter(
    (run) => !run.text.includes(META.companyName) && !/^Page \d+$/.test(run.text.trim()),
  );

  const smallest = Math.min(...runs.map((run) => run.size));
  assert.ok(smallest >= 9, `body text found at ${smallest}pt`);
});
