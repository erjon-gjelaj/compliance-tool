import "server-only";

import { getCompanyForEmail } from "@/lib/companies";
import { can, planOf, type Plan } from "@/lib/entitlements";
import { programById } from "@/lib/programs/registry";
import { getDocumentForEmail, listDocumentsForEmail } from "@/lib/programs/store";

/**
 * Who may have a document prepared.
 *
 * ## Why this exists at all
 *
 * `lib/entitlements` has described `document_preparation` as a paid
 * capability since it was written, and `lib/billing/catalog` lists the gap
 * check as free and the written programs as the thing that is sold. Meanwhile
 * `can()` was never called anywhere in the application.
 *
 * So the plan granted at the end of the money path — quote, acceptance,
 * payment, `setPlanForEmail` — decided nothing, and the four generated
 * programmes, which are the thing this product actually sells, were free to
 * anyone with an email address. The gap between "a platform" and "a business"
 * was one function call.
 *
 * ## Where the check belongs
 *
 * At the point of generation, not at the point of display. A page that hides
 * a button is a suggestion; the server action that writes a document is the
 * boundary. Both call this, but only one of them matters.
 *
 * ## What is deliberately NOT gated
 *
 * **Anything they already hold.** Downloading, re-downloading and revising a
 * document someone paid for stays available whatever their plan says later.
 * A plan is set by hand today, and the failure mode of getting that wrong
 * must never be a contractor losing access to the safety programme they
 * bought — especially not the week a hiring client asks for it. So the check
 * asks whether a NEW document may be prepared, and holding one is its own
 * answer for that document.
 *
 * **The gap check.** Free, and staying free. It is the reason anybody arrives.
 */

export type PreparationAccess = {
  plan: Plan;
  /** Whether a document they do not already hold may be prepared. */
  allowed: boolean;
  /** Programme ids they already hold, which stay available regardless. */
  held: string[];
};

export async function preparationAccess(
  email: string,
): Promise<PreparationAccess> {
  const [company, documents] = await Promise.all([
    getCompanyForEmail(email),
    listDocumentsForEmail(email),
  ]);

  const plan = planOf(company);

  return {
    plan,
    allowed: can(plan, "document_preparation"),
    held: documents.map((document) => document.program_id),
  };
}

/**
 * Whether this specific programme may be prepared or re-prepared.
 *
 * Separate from the plan check because holding a document is an answer on its
 * own: a revision of something already bought is covered by the revision
 * promise in lib/pricing, and re-running the questionnaire on a programme they
 * hold produces a new version of a document they own rather than a new
 * purchase.
 */
export async function mayPrepare(
  email: string,
  programId: string,
): Promise<boolean> {
  const access = await preparationAccess(email);
  return access.allowed || access.held.includes(programId);
}

/**
 * Whether a revision of an existing document may be produced.
 *
 * Ownership only. `REVISION_PROMISE` says a document sent back by a hiring
 * client is revised at no extra cost, and a plan that lapsed between the
 * purchase and the rejection must not turn that promise into a second sale.
 */
export async function mayRevise(
  email: string,
  documentId: string,
): Promise<boolean> {
  const document = await getDocumentForEmail(email, documentId);
  return Boolean(document?.current);
}

/** The programme's own title, for a message about it. */
export function programName(programId: string): string {
  return programById(programId)?.title ?? "this program";
}
