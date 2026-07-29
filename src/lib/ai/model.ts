import "server-only";

/**
 * The seam between this product and a language model.
 *
 * Everything the app knows about models is this interface: give it a system
 * prompt, a user prompt, and a JSON Schema, get parsed JSON back. It does not
 * expose messages, tools, streaming, token budgets or any other vendor
 * concept, so swapping the model — or the vendor — is one file
 * (`openai-compatible.ts`) and one line in `revisionModel()`.
 *
 * It is deliberately narrow. A wider interface would let model-shaped thinking
 * leak into the rest of the codebase, and the whole point of the boundary is
 * that `lib/programs` stays deterministic code that happens to call something
 * slow and fallible, rather than an application built around a model.
 *
 * Note what is NOT here: no chat history, no memory, no retry-with-feedback.
 * The revision analysis is a single question with a single answer, checked
 * against a schema. If it fails, it fails — see revise-analysis.ts.
 */

export type StructuredRequest = {
  system: string;
  user: string;
  /** JSON Schema the reply must satisfy. Hand-written; see the note below. */
  schema: Record<string, unknown>;
  /** Names the schema for the model. Short and descriptive. */
  schemaName: string;
  maxTokens: number;
};

export type ModelOutcome =
  | { ok: true; json: unknown; usage: { input: number; output: number } }
  | { ok: false; reason: string };

export interface StructuredModel {
  /** For logging and for the review record. */
  readonly id: string;
  complete(request: StructuredRequest): Promise<ModelOutcome>;
}

/**
 * Never throws. A model is a network call to someone else's computer, and the
 * caller has a sensible thing to do with a failure — tell the customer we
 * could not do it this time — which is more useful than an exception
 * propagating out of a server action.
 */
