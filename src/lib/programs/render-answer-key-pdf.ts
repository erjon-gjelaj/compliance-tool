import "server-only";

import PDFDocument from "pdfkit";
import type { AnswerKeyItem } from "@/lib/programs/answer-key";

export async function renderAnswerKeyPdf({
  companyName,
  programTitle,
  items,
}: {
  companyName: string;
  programTitle: string;
  items: AnswerKeyItem[];
}): Promise<Buffer> {
  const pdf = new PDFDocument({
    size: "LETTER",
    margins: { top: 54, right: 54, bottom: 54, left: 54 },
    info: { Title: `${programTitle} answer key` },
  });
  const chunks: Buffer[] = [];
  pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
  });

  pdf.font("Helvetica-Bold").fontSize(18).text(`${programTitle} answer key`);
  pdf.moveDown(0.35);
  pdf.font("Helvetica").fontSize(10).text(companyName);
  pdf.moveDown(0.5);
  pdf
    .fillColor("#4b5563")
    .text(
      "Approximate working checklist. Review it against the questions in your own platform account and submit the answers yourself.",
    )
    .fillColor("#111827");
  pdf.moveDown();

  items.forEach((item, index) => {
    if (pdf.y > 680) pdf.addPage();
    pdf
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(`${index + 1}. ${item.questionText}`);
    pdf
      .font("Helvetica")
      .text(
        `Answer: ${item.answer.toUpperCase()}   Pages: ${item.pageRange ?? "Review required"}`,
      );
    if (item.snippet) {
      pdf.fillColor("#4b5563").text(item.snippet).fillColor("#111827");
    }
    pdf.moveDown(0.6);
  });

  pdf.end();
  return done;
}
