import { NextResponse } from "next/server";

import { answerKeyForEmail } from "@/lib/assessments";
import { programConfigByKey } from "@/lib/config";
import { renderAnswerKeyPdf } from "@/lib/programs/render-answer-key-pdf";
import { currentWorkspace } from "@/lib/workspaces";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const workspace = await currentWorkspace();
  if (!workspace) return new NextResponse("Not found", { status: 404 });
  const { id } = await params;
  const key = await answerKeyForEmail(workspace.email, id);
  if (!key) return new NextResponse("Not found", { status: 404 });
  const title = programConfigByKey(key.programKey)?.title ?? key.programKey;
  const pdf = await renderAnswerKeyPdf({
    companyName: key.companyName,
    programTitle: title,
    items: key.items,
  });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${key.programKey}-answer-key.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
