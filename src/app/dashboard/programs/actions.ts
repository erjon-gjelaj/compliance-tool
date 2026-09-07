"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { currentClient } from "@/lib/auth/session";
import { mayPrepare } from "@/lib/programs/access";
import { getCompanyForEmail } from "@/lib/companies";
import { recordServiceRequest } from "@/lib/service-requests";
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
  PreparationRequestState,
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

  /*
   * The paywall, and the only place it counts.
   *
   * Checked here rather than only on the page because this action is what
   * writes a document. A page that declines to render the questionnaire is a
   * suggestion; someone posting this form directly is the case that decides
   * whether the plan means anything.
   *
   * Deliberately after the questions rather than before them: somebody who
   * has answered seven questions has told us exactly what they want prepared,
   * and that is worth more as a service request than an empty one is. Nothing
   * is generated, so nothing is given away.
   */
  if (!(await mayPrepare(session.email, programId))) {
    return { status: "locked", answers };
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

  if (!document?.current) {
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

/**
 * Asking us to prepare a program the current plan does not include.
 *
 * This is what stands in for a checkout, and it reuses the path task 063
 * built: `recordServiceRequest` opens an event log, the operator sends a
 * quote against it, the customer accepts, payment is recorded and the plan is
 * granted. Nothing new is invented for money here.
 *
 * What makes this worth more than a bare "contact us" is the note. Somebody
 * arriving at this point has just answered every question the program asks,
 * so the request carries what they actually want prepared, in their own
 * answers — the operator can price it, or prepare it by hand, without a
 * single round trip asking what they meant.
 */
export async function requestProgramPreparation(
  _previous: PreparationRequestState,
  formData: FormData,
): Promise<PreparationRequestState> {
  const session = await currentClient();
  if (!session) redirect("/sign-in");

  const programId = String(formData.get("program_id") ?? "");
  const template = programById(programId);

  if (!template || !isOfferable(template.release)) {
    return { status: "error", error: "That program isn't available." };
  }

  const answers = readAnswers(formData, programId);
  const context = await companyContextFor(session.email);
  const company = await getCompanyForEmail(session.email);

  try {
    await recordServiceRequest({
      email: session.email,
      kind: "document_preparation",
      note: describeRequest(programId, answers, context?.companyName ?? null),
      companyId: company?.id ?? null,
    });
  } catch (cause) {
    console.error("Could not record a preparation request:", cause);
    return {
      status: "error",
      error: "We couldn't record that just now. Try again, or use Get help.",
    };
  }

  revalidatePath("/dashboard/requests");
  revalidatePath("/dashboard");

  return { status: "sent" };
}

/**
 * The answers, written out the way the operator needs to read them.
 *
 * Prompts and option labels rather than ids: "safety_manager" is what the
 * form stores and "A safety manager" is what the person chose, and the second
 * is the one that belongs in a note somebody reads at eight in the morning.
 * Unanswered questions are omitted rather than listed as blank.
 */
function describeRequest(
  programId: string,
  answers: Answers,
  companyName: string | null,
): string {
  const template = programById(programId);
  if (!template) return "";

  const lines = [
    `Asked for: ${template.title}`,
    companyName ? `Company: ${companyName}` : "Company: not given yet",
    "",
    "Their answers:",
  ];

  for (const question of template.questions) {
    const answer = answers[question.id];
    if (!answer) continue;

    const label =
      question.kind === "boolean"
        ? answer === "yes"
          ? "Yes"
          : "No"
        : (question.options?.find((option) => option.id === answer)?.label ??
          answer);

    lines.push(`- ${question.prompt} ${label}`);
  }

  return lines.join("\n");
}
