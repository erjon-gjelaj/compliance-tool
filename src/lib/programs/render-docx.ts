import "server-only";

import {
  AlignmentType,
  Document,
  Footer,
  Header,
  HeadingLevel,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import type { Block, Section } from "@/lib/programs/types";

/**
 * The Word file.
 *
 * Editable on purpose: a contractor asked for a change by their hiring client
 * needs to be able to make it, and a locked PDF alone would send them back to
 * us for a comma. The PDF is the copy they submit; the DOCX is the copy they
 * own.
 *
 * Rendered from the same `Section[]` the PDF writer takes, so the two cannot
 * drift into saying different things.
 */

export type DocumentMeta = {
  companyName: string;
  title: string;
  version: number;
  effectiveDate: string;
  revisionDate: string | null;
  /** Optional consultant brand, printed without adding product branding. */
  preparedBy?: string | null;
  /** PNG or JPEG bytes. Absent is normal and changes only the cover. */
  logo?: Uint8Array;
};

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]) {
  return new Paragraph({
    text,
    heading: level,
    spacing: { before: 280, after: 140 },
  });
}

function body(text: string) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22 })],
    spacing: { after: 140, line: 300 },
  });
}

function blocksToParagraphs(block: Block): (Paragraph | Table)[] {
  switch (block.type) {
    case "paragraph":
      return [body(block.text)];

    case "bullets":
      return block.items.map(
        (item) =>
          new Paragraph({
            children: [new TextRun({ text: item, size: 22 })],
            bullet: { level: 0 },
            spacing: { after: 80, line: 300 },
          }),
      );

    case "numbered":
      return block.items.map(
        (item) =>
          new Paragraph({
            children: [new TextRun({ text: item, size: 22 })],
            numbering: { reference: "program-numbering", level: 0 },
            spacing: { after: 80, line: 300 },
          }),
      );

    case "table":
      return [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: block.head.map(
                (cell) =>
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: cell, bold: true, size: 20 })],
                      }),
                    ],
                  }),
              ),
            }),
            ...block.rows.map(
              (row) =>
                new TableRow({
                  children: row.map(
                    (cell) =>
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [new TextRun({ text: cell, size: 20 })],
                          }),
                        ],
                      }),
                  ),
                }),
            ),
          ],
        }),
      ];
  }
}

export async function renderDocx(
  meta: DocumentMeta,
  sections: Section[],
): Promise<Buffer> {
  const cover: Paragraph[] = [];

  if (meta.logo) {
    cover.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 1200, after: 400 },
        children: [
          // Typed loosely because docx's ImageRun signature varies across
          // minor versions on the `type` discriminator, and pinning it here
          // would break on an upgrade for no benefit.
          new (
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            require("docx") as typeof import("docx")
          ).ImageRun({
            data: meta.logo,
            transformation: { width: 160, height: 160 },
            type: "png",
          }),
        ],
      }),
    );
  }

  cover.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: meta.logo ? 0 : 2400, after: 200 },
      children: [
        new TextRun({ text: meta.companyName, bold: true, size: 44 }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 1200 },
      children: [new TextRun({ text: meta.title, size: 36 })],
    }),
    ...(meta.preparedBy
      ? [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 600 },
            children: [
              new TextRun({ text: `Prepared by ${meta.preparedBy}`, size: 22 }),
            ],
          }),
        ]
      : []),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({ text: `Effective ${meta.effectiveDate}`, size: 22 }),
      ],
    }),
  );

  if (meta.revisionDate) {
    cover.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
          new TextRun({ text: `Revised ${meta.revisionDate}`, size: 22 }),
        ],
      }),
    );
  }

  cover.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `Version ${meta.version}`, size: 22 })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  );

  const contents: Paragraph[] = [
    heading("Contents", HeadingLevel.HEADING_1),
    ...sections.map(
      (section, index) =>
        new Paragraph({
          children: [
            new TextRun({ text: `${index + 1}.  ${section.heading}`, size: 22 }),
          ],
          spacing: { after: 80 },
        }),
    ),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  const bodyContent = sections.flatMap((section, index) => [
    heading(`${index + 1}.  ${section.heading}`, HeadingLevel.HEADING_1),
    ...section.blocks.flatMap(blocksToParagraphs),
  ]);

  const document = new Document({
    numbering: {
      config: [
        {
          reference: "program-numbering",
          levels: [
            { level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.START },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {},
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `${meta.companyName} — ${meta.title}`,
                    size: 18,
                    color: "666666",
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Page ", size: 18, color: "666666" }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "666666" }),
                  new TextRun({ text: " of ", size: 18, color: "666666" }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: "666666" }),
                ],
              }),
            ],
          }),
        },
        children: [...cover, ...contents, ...bodyContent],
      },
    ],
  });

  return Packer.toBuffer(document);
}
