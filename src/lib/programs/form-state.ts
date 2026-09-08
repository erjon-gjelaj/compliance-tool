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

/**
 * Starting a payment.
 *
 * There is no success case: a successful checkout redirects to Stripe and
 * this state is never rendered. Only a failure comes back here, which is why
 * the shape carries nothing else.
 */
export type CheckoutState = { status: "idle" | "error"; error?: string };

export const initialCheckout: CheckoutState = { status: "idle" };

/**
 * Asking to be invoiced.
 *
 * Separate from the checkout state because it is a different act: a checkout
 * ends in a redirect and never renders a success, while this ends in a
 * message on the page saying an invoice is coming.
 */
export type PreparationRequestState = {
  status: "idle" | "sent" | "error";
  error?: string;
};

export const initialPreparationRequest: PreparationRequestState = {
  status: "idle",
};
