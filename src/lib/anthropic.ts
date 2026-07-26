import "server-only";

import Anthropic from "@anthropic-ai/sdk";

/**
 * The Anthropic client. Server-side only.
 *
 * ANTHROPIC_API_KEY has no NEXT_PUBLIC_ prefix and never may — that would
 * publish a billable key to every visitor's browser.
 *
 * Returns null rather than throwing when the key is absent. That is the
 * normal state locally and in any environment where the pipeline hasn't been
 * switched on, and a submission must still save and still get an email in
 * that case.
 */

export const ANALYSIS_MODEL = process.env.ANTHROPIC_MODEL?.trim() || "claude-opus-5";

export function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();

  if (!apiKey) {
    console.warn(
      "Analysis skipped: set ANTHROPIC_API_KEY to have submissions reviewed " +
        "automatically. The generic explainer email is sent instead.",
    );
    return null;
  }

  return new Anthropic({ apiKey });
}
