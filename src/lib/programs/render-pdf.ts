import "server-only";

import PDFDocument from "pdfkit";

import type { Block, Section } from "@/lib/programs/types";
import type { DocumentMeta } from "@/lib/programs/render-docx";

/**
 * The PDF, which is the copy a contractor actually submits.
 *
 * pdfkit rather than a headless browser. Rendering HTML would mean shipping
 * Chromium into a serverless function that has already been tuned for its
 * wall clock, for a document whose layout is a title, headings, paragraphs and
 * the occasional table. The layout engine here is a page cursor and a
 * `moveDown`, which is enough for that and starts in milliseconds.
 *
 * Renders from the same `Section[]` as the DOCX writer, so the two files say
 * the same thing.
 */

const MARGIN = 64;
const PAGE_WIDTH = 595.28; // A4 points
const PAGE_HEIGHT = 841.89;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

/**
 * Standard fonts only.
 *
 * pdfkit embeds its own copies of the base-14 fonts, so nothing here depends
 * on a font file being present in the deployment. A missing font in a
 * serverless bundle is a class of failure that only appears in production.
 */
const BODY = "Helvetica";
const BOLD = "Helvetica-Bold";

type Cursor = { pageNumber: number };

/** Starts a page and draws the running header. */
function newPage(doc: PDFKit.PDFDocument, meta: DocumentMeta, cursor: Cursor) {
  doc.addPage({ size: "A4", margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } });
  cursor.pageNumber += 1;
  drawChrome(doc, meta, cursor);
}

function drawChrome(doc: PDFKit.PDFDocument, meta: DocumentMeta, cursor: Cursor) {
  const saved = doc.y;

  /*
   * The footer sits below the bottom margin, and pdfkit adds a page
   * automatically the moment text crosses that line. Left alone it produced a
   * blank, header-only page after every real one — nine pages for a five-page
   * document — because drawing the footer triggered a break, and the break
   * drew another header.
   *
   * Zeroing the bottom margin for the duration of the two writes is the
   * documented way round it. Restored immediately, so body text still breaks
   * where it should.
   */
  const bottomMargin = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;

  doc
    .font(BODY)
    .fontSize(8)
    .fillColor("#666666")
    .text(`${meta.companyName} — ${meta.title}`, MARGIN, MARGIN - 28, {
      width: CONTENT_WIDTH,
      align: "right",
      lineBreak: false,
    })
    .text(`Page ${cursor.pageNumber}`, MARGIN, PAGE_HEIGHT - MARGIN + 16, {
      width: CONTENT_WIDTH,
      align: "center",
      lineBreak: false,
    });

  doc.page.margins.bottom = bottomMargin;
  doc.fillColor("#000000");
  doc.y = saved;
}

/**
 * Breaks before writing when the block would not fit.
 *
 * Checked ahead rather than relying on pdfkit's automatic flow, because the
 * automatic break puts a heading at the foot of a page with its first
 * paragraph overleaf. `needed` is a conservative estimate of the next block's
 * height; erring high costs a little whitespace and never an orphan.
 */
function ensureRoom(
  doc: PDFKit.PDFDocument,
  meta: DocumentMeta,
  cursor: Cursor,
  needed: number,
) {
  if (doc.y + needed > PAGE_HEIGHT - MARGIN - 24) {
    newPage(doc, meta, cursor);
  }
}

function writeBlock(
  doc: PDFKit.PDFDocument,
  meta: DocumentMeta,
  cursor: Cursor,
  block: Block,
) {
  switch (block.type) {
    case "paragraph": {
      const height = doc.font(BODY).fontSize(10.5).heightOfString(block.text, {
        width: CONTENT_WIDTH,
      });
      ensureRoom(doc, meta, cursor, Math.min(height, 120));
      doc.text(block.text, MARGIN, doc.y, { width: CONTENT_WIDTH, align: "left" });
      doc.moveDown(0.7);
      break;
    }

    case "bullets":
    case "numbered": {
      doc.font(BODY).fontSize(10.5);
      block.items.forEach((item, index) => {
        const marker = block.type === "bullets" ? "•" : `${index + 1}.`;
        const text = `${marker}  ${item}`;
        const height = doc.heightOfString(text, { width: CONTENT_WIDTH - 16 });
        ensureRoom(doc, meta, cursor, Math.min(height, 100));
        doc.text(text, MARGIN + 16, doc.y, { width: CONTENT_WIDTH - 16 });
        doc.moveDown(0.35);
      });
      doc.moveDown(0.4);
      break;
    }

    case "table": {
      const columns = block.head.length;
      const width = CONTENT_WIDTH / columns;

      ensureRoom(doc, meta, cursor, 60);

      doc.font(BOLD).fontSize(9.5);
      let x = MARGIN;
      const headTop = doc.y;
      for (const cell of block.head) {
        doc.text(cell, x, headTop, { width: width - 8 });
        x += width;
      }
      doc.y = headTop + 18;

      doc.font(BODY).fontSize(9.5);
      for (const row of block.rows) {
        ensureRoom(doc, meta, cursor, 24);
        const top = doc.y;
        let cellX = MARGIN;
        for (const cell of row) {
          doc.text(cell, cellX, top, { width: width - 8 });
          cellX += width;
        }
        doc.y = top + 18;
      }

      doc.moveDown(0.6);
      break;
    }
  }
}

export async function renderPdf(
  meta: DocumentMeta,
  sections: Section[],
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    autoFirstPage: false,
    info: {
      Title: `${meta.title} — ${meta.companyName}`,
      Author: meta.companyName,
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const finished = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const cursor: Cursor = { pageNumber: 0 };

  /* Cover. No running header or page number on it, as on any printed report. */
  doc.addPage({ size: "A4", margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } });
  cursor.pageNumber = 1;

  let coverTop = 200;

  if (meta.logo) {
    try {
      doc.image(Buffer.from(meta.logo), PAGE_WIDTH / 2 - 60, 120, {
        fit: [120, 120],
        align: "center",
      });
      coverTop = 270;
    } catch {
      // A logo we cannot decode is not a reason to fail the document. The
      // cover simply carries the company name, which is the case for every
      // customer who never uploaded one.
      coverTop = 200;
    }
  }

  doc
    .font(BOLD)
    .fontSize(24)
    .text(meta.companyName, MARGIN, coverTop, { width: CONTENT_WIDTH, align: "center" })
    .moveDown(0.5)
    .font(BODY)
    .fontSize(18)
    .text(meta.title, { width: CONTENT_WIDTH, align: "center" })
    .moveDown(2)
    .fontSize(10.5)
    .text(`Effective ${meta.effectiveDate}`, { width: CONTENT_WIDTH, align: "center" });

  if (meta.revisionDate) {
    doc.text(`Revised ${meta.revisionDate}`, { width: CONTENT_WIDTH, align: "center" });
  }

  doc.text(`Version ${meta.version}`, { width: CONTENT_WIDTH, align: "center" });

  /* Contents. */
  newPage(doc, meta, cursor);
  doc.font(BOLD).fontSize(14).text("Contents", MARGIN, doc.y);
  doc.moveDown(0.8);
  doc.font(BODY).fontSize(10.5);

  sections.forEach((section, index) => {
    ensureRoom(doc, meta, cursor, 18);
    doc.text(`${index + 1}.  ${section.heading}`, MARGIN, doc.y, {
      width: CONTENT_WIDTH,
    });
    doc.moveDown(0.3);
  });

  /* Body. */
  newPage(doc, meta, cursor);

  sections.forEach((section, index) => {
    // A heading needs its first lines with it, so it asks for more room than
    // it occupies.
    ensureRoom(doc, meta, cursor, 90);

    doc
      .font(BOLD)
      .fontSize(13)
      .fillColor("#000000")
      .text(`${index + 1}.  ${section.heading}`, MARGIN, doc.y, {
        width: CONTENT_WIDTH,
      });
    doc.moveDown(0.5);

    doc.font(BODY).fontSize(10.5);

    for (const block of section.blocks) {
      writeBlock(doc, meta, cursor, block);
    }

    doc.moveDown(0.5);
  });

  doc.end();

  return finished;
}
