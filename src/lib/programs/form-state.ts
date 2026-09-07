import type { Answers } from "@/lib/programs/types";

/**
 * Form state for the programme questionnaire and the revision box.
 *
 * Lives here rather than beside the actions for the reason `lib/messages.ts`
 * already records: a `"use server"` module may only export async functions.
 * Exporting an initial-state object from one is a runtime error — "A 'use
 * server' file can only export async functions, found object" — and it does
 * not surface at build time, only when the module is first evaluated on a
 * request.
 *
 * The types themselves are erased, so they could have stayed. Keeping them
 * with the value they describe is worth more than that distinction.
 */

export type ProgramFormState = {
  /**
   * `locked` is its own state rather than an error.
   *
   * Reaching it means the questionnaire was completed by somebody whose plan
   * does not include having a document prepared. Nothing went wrong, and
   * rendering it as an error would tell a customer they had made a mistake
   * when what they had actually done was describe exactly what they want.
   */
  status: "asking" | "generated" | "error" | "locked";
  answers: Answers;
  /** Set once a document exists, so the page can link to it. */
  documentId?: string;
  version?: number;
  error?: string;
};

export const initialProgramState: ProgramFormState = {
  status: "asking",
  answers: {},
};

export type RevisionState = { status: "editing" | "sent"; error?: string };

export const initialRevisionState: RevisionState = { status: "editing" };

/**
 * Asking for a program the current plan does not include.
 *
 * Separate from `ProgramFormState` because it is a different act: the
 * questionnaire produces a document, this produces a conversation. Reaching
 * `sent` means a service request exists and the operator console will show it
 * alongside the answers that were given.
 */
export type PreparationRequestState = {
  status: "idle" | "sent" | "error";
  error?: string;
};

export const initialPreparationRequest: PreparationRequestState = {
  status: "idle",
};
