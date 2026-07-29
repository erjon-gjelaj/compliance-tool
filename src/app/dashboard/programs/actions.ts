"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { currentClient } from "@/lib/auth/session";
import { programById } from "@/lib/programs/registry";
import { isOfferable } from "@/lib/programs/types";
import {
  companyContextFor,
  generateVersion,
  getDocumentForEmail,
} from "@/lib/programs/store";
import { nextUnanswered, visibleQuestions } from "@/lib/programs/validate";
import type { Answers } from "@/lib/programs/types";
import type {
  ProgramFormState,
  RevisionState,
} from "@/lib/programs/form-state";

/**
 * The questionnaire and the generate step.
 *
 * Answers live in the form itself rather than in a table. The whole flow is
 * two or three minutes long, and a half-finished questionnaire is not worth a
 * row — what is worth keeping is the finished document, and the answers are
 * stored on the version when one is produced. That also means a revision can
 * start from exactly what was answered last time.
 */

function readAnswers(formData: FormData, programId: string): Answers {
  const template = programById(programId);
  if (!template) return {};

  const answers: Answers = {};

  for (const question of template.questions) {
    const raw = formData.get(`answer_${question.id}`);
    if (typeof raw === "string" && raw.trim()) {
      answers[question.id] = raw.trim();
    }
  }

  return answers;
}

export async function answerProgramStep(
  _previous: ProgramFormState,
  formData: FormData,
): Promise<ProgramFormState> {
  const session = await currentClient();
  if (!session) redirect("/sign-in");

  const programId = String(formData.get("program_id") ?? "");
  const template = programById(programId);

  if (!template || !isOfferable(template.release)) {
    return { status: "error", answers: {}, error: "That program isn't available." };
  }

  const context = await companyContextFor(session.email);

  if (!context) {
    return {
      status: "error",
      answers: {},
      error: "Add your company name first — the document is prepared in its name.",
    };
  }

  let answers = readAnswers(formData, programId);

  /*
   * Answers to questions that no longer apply are dropped rather than kept.
   *
   * Someone who says yes to multi-employer sites, answers the unlabelled-pipes
   * question, then goes back and says no, would otherwise carry a stale answer
   * that the validator correctly rejects as contradictory — leaving them stuck
   * on a form with no visible problem. Clearing it here means changing your
   * mind just works.
   */
  const applicable = new Set(
    visibleQuestions(template, answers, context).map((question) => question.id),
  );
  answers = Object.fromEntries(
    Object.entries(answers).filter(([id]) => applicable.has(id)),
  );

  const outstanding = nextUnanswered(template, answers, context);

  // Still questions to go: hand the answers back and let the form render the
  // next one. No generation is attempted.
  if (outstanding) {
    return { status: "asking", answers };
  }

  const outcome = await generateVersion({
    email: session.email,
    programId,
    answers,
  });

  if (!outcome.ok) {
    return { status: "error", answers, error: outcome.reason };
  }

  revalidatePath("/dashboard/documents");
  revalidatePath("/dashboard");

  return {
    status: "generated",
    answers,
    documentId: outcome.documentId,
    version: outcome.version,
  };
}

/**
 * A revision after a hiring client sent the document back.
 *
 * Starts from the answers that produced the version being revised, so the
 * customer is not asked the same seven questions again. What they add is the
 * reviewer's wording, which is recorded against the new version.
 *
 * The revision policy lives in lib/pricing rather than here: whether a given
 * revision is free is a commercial decision that will change, and it should
 * not be spelled out in a server action.
 */
export async function reviseDocument(
  _previous: RevisionState,
  formData: FormData,
): Promise<RevisionState> {
  const session = await currentClient();
  if (!session) redirect("/sign-in");

  const documentId = String(formData.get("document_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!reason) {
    return { status: "editing", error: "Tell us what they asked you to change." };
  }

  const document = await getDocumentForEmail(session.email, documentId);

  // Not yours, not real, and never successfully generated are all "not
  // found" here — the reader drops documents with no version behind them.
  if (!document) {
    return { status: "editing", error: "We couldn't find that document." };
  }

  const outcome = await generateVersion({
    email: session.email,
    programId: document.program_id,
    // The same answers as the version being revised. A revision that silently
    // changed an answer would produce a document the customer never described.
    answers: document.current.answers,
    revisionReason: reason,
  });

  if (!outcome.ok) {
    return { status: "editing", error: outcome.reason };
  }

  revalidatePath(`/dashboard/documents/${documentId}`);
  revalidatePath("/dashboard/documents");

  return { status: "sent" };
}
