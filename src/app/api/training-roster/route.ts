import { NextResponse } from "next/server";

import { getCompanyForEmail } from "@/lib/companies";
import { renderTrainingRosterPdf } from "@/lib/training/render-roster-pdf";
import { currentWorkspace } from "@/lib/workspaces";

export async function POST(request: Request) {
  const workspace = await currentWorkspace();
  if (!workspace) return new NextResponse("Not found", { status: 404 });
  const form = await request.formData();
  const programTitle = String(form.get("program_title") ?? "").trim();
  const trainingDate = String(form.get("training_date") ?? "").trim();
  const instructorName = String(form.get("instructor_name") ?? "").trim();
  const attendees = String(form.get("attendees") ?? "")
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 100);
  if (!programTitle || !trainingDate || !instructorName || attendees.length === 0) {
    return new NextResponse("Complete the topic, date, instructor, and attendees.", {
      status: 400,
    });
  }
  const company = await getCompanyForEmail(workspace.email);
  const pdf = await renderTrainingRosterPdf({
    companyName: company?.name ?? "Contractor",
    programTitle,
    trainingDate,
    instructorName,
    attendees,
  });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=\"training-roster.pdf\"",
      "Cache-Control": "private, no-store",
    },
  });
}
