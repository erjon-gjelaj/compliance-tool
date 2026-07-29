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
  status: "asking" | "generated" | "error";
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

/**
 * The revision box, which is a small state machine rather than one field.
 *
 * `clarifying` is the state that earns the type: the model read the request
 * and could not carry it out without guessing, so it asked instead. The
 * original request is carried through that round trip because the retry needs
 * both halves — the reviewer's wording and the customer's answers — and
 * neither is stored anywhere until a version is actually produced.
 */
export type RevisionState = {
  status: "editing" | "clarifying" | "sent";
  error?: string;
  /** The reviewer's wording, kept across a clarification round trip. */
  request?: string;
  /** Asked when the request could not be carried out without assuming. */
  questions?: string[];
  /** What changed, in the model's words. Shown after a successful revision. */
  summary?: string[];
};

export const initialRevisionState: RevisionState = { status: "editing" };
