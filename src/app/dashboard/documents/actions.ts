"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { currentWorkspace } from "@/lib/workspaces";
import { getSubmissionForEmail } from "@/lib/dashboard";
import { requestUploadSlots, confirmUploads } from "@/lib/documents";
import { runAnalysis } from "@/lib/analysis/run";
import type { FileClaim } from "@/lib/uploads";

async function authorize(submissionId: string) {
  const workspace = await currentWorkspace();
  if (!workspace) return null;
  return getSubmissionForEmail(workspace.email, submissionId);
}

export async function createProjectUploadSlots(submissionId: string, claims: FileClaim[]) {
  if (!(await authorize(submissionId))) return { ok: false as const, error: "That approval project is not available." };
  return requestUploadSlots(submissionId, claims);
}

export async function finishProjectUpload(submissionId: string, uploaded: { path: string; fileName: string }[]) {
  if (!(await authorize(submissionId))) return { ok: false as const, accepted: 0, rejected: [{ fileName: "Upload", reason: "that approval project is not available" }] };
  const result = await confirmUploads(submissionId, uploaded);
  if (result.accepted.length > 0) after(async () => { await runAnalysis(submissionId); });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/documents");
  revalidatePath(`/dashboard/${submissionId}`);
  return { ok: result.accepted.length > 0, accepted: result.accepted.length, rejected: result.rejected };
}
