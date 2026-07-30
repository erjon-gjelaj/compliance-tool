import "server-only";

import PDFDocument from "pdfkit";

export async function renderTrainingRosterPdf({
  companyName,
  programTitle,
  trainingDate,
  instructorName,
  attendees,
}: {
  companyName: string;
  programTitle: string;
  trainingDate: string;
  instructorName: string;
  attendees: string[];
}): Promise<Buffer> {
  const pdf = new PDFDocument({ size: "LETTER", margin: 54 });
  const chunks: Buffer[] = [];
  pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
  });
  pdf.font("Helvetica-Bold").fontSize(18).text("Training sign-in sheet");
  pdf.moveDown();
  pdf.font("Helvetica").fontSize(11);
  pdf.text(`Company: ${companyName}`);
  pdf.text(`Topic/program: ${programTitle}`);
  pdf.text(`Date: ${trainingDate}`);
  pdf.text(`Instructor: ${instructorName}`);
  pdf.moveDown();
  pdf.text("Instructor signature: ________________________________________");
  pdf.moveDown(1.5);
  pdf.font("Helvetica-Bold").text("Attendee");
  pdf.moveDown(0.5);
  attendees.forEach((attendee, index) => {
    pdf
      .font("Helvetica")
      .text(`${index + 1}. ${attendee}`, { continued: true })
      .text("    Signature: ______________________________");
    pdf.moveDown(0.7);
  });
  pdf.end();
  return done;
}
