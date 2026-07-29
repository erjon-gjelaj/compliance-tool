import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import type {
  ModelOutcome,
  StructuredModel,
  StructuredRequest,
} from "@/lib/ai/model";

/**
 * The only file in this repo that knows a model vendor exists.
 *
 * Claude Haiku 4.5 (`claude-haiku-4-5`) rather than a frontier model, because
 * the task is narrow — read a document, read a sentence describing a change,
 * either apply it or ask a question — and revisions are promised free. It is
 * also the cheapest current model that supports structured outputs, which the
 * whole design rests on.
 *
 * Structured output is requested through `output_config.format`, so the schema
 * is enforced by the API rather than by asking nicely in the prompt and hoping.
 * The schema is hand-written JSON Schema rather than generated from the zod
 * types: the SDK's zod helper targets zod 3 and this project is on zod 4, and
 * the output has to be re-validated with zod on the way in regardless — the
 * API guarantees shape, not truthfulness. One hand-written schema is a smaller
 * liability than a version-pinned helper plus a second validation pass that
 * disagrees with it.
 *
 * Streaming, despite the caller not streaming anything to the browser. A
 * revised programme can run to tens of thousands of output tokens, and a
 * non-streaming request of that size risks an SDK HTTP timeout — the answer
 * arrives, the connection has already gone. `finalMessage()` reassembles it.
 */

const MODEL = "claude-haiku-4-5";

let client: Anthropic | null = null;

function anthropic(): Anthropic {
  // Constructed once and reused, so a burst of revisions does not create a
  // connection pool per request.
  client ??= new Anthropic();
  return client;
}

export function anthropicModel(): StructuredModel {
  return {
    id: MODEL,

    async complete(request: StructuredRequest): Promise<ModelOutcome> {
      /*
       * Checked here rather than at import time. A missing key must not stop
       * the rest of the product from starting — every other page works
       * without a model, and this is the one that should degrade.
       */
      if (!process.env.ANTHROPIC_API_KEY) {
        console.error("ANTHROPIC_API_KEY is not set; revision analysis is off.");
        return { ok: false, reason: "not_configured" };
      }

      let message;

      try {
        const stream = anthropic().messages.stream({
          model: MODEL,
          max_tokens: request.maxTokens,
          system: request.system,
          messages: [{ role: "user", content: request.user }],
          output_config: {
            format: {
              type: "json_schema",
              schema: { title: request.schemaName, ...request.schema },
            },
          },
        });

        message = await stream.finalMessage();
      } catch (cause) {
        /*
         * Typed classes rather than matching on the message text, so a
         * rewording upstream cannot silently turn a rate limit into an
         * unknown error. Each maps to a different thing the customer is told.
         */
        if (cause instanceof Anthropic.RateLimitError) {
          console.warn("Revision analysis rate limited.");
          return { ok: false, reason: "busy" };
        }
        if (cause instanceof Anthropic.APIConnectionError) {
          console.warn("Could not reach the model.");
          return { ok: false, reason: "unreachable" };
        }
        if (cause instanceof Anthropic.APIError) {
          console.error(`Model error ${cause.status}: ${cause.message}`);
          return { ok: false, reason: "model_error" };
        }
        console.error("Unexpected failure calling the model:", cause);
        return { ok: false, reason: "model_error" };
      }

      /*
       * A refusal is a successful HTTP response with nothing usable in it.
       * Checked before touching `content`, which is empty or partial here.
       */
      if (message.stop_reason === "refusal") {
        console.error("The model declined the revision request.");
        return { ok: false, reason: "declined" };
      }

      /*
       * Truncation is the failure that would otherwise look like success:
       * the JSON is cut off mid-document, parsing fails, and the reason
       * reads as a model fault rather than a budget we set too low.
       */
      if (message.stop_reason === "max_tokens") {
        console.error("Revision output hit max_tokens; document too long.");
        return { ok: false, reason: "too_long" };
      }

      const text = message.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");

      if (!text.trim()) {
        console.error("The model returned no text.");
        return { ok: false, reason: "empty" };
      }

      try {
        return {
          ok: true,
          json: JSON.parse(text),
          usage: {
            input: message.usage.input_tokens,
            output: message.usage.output_tokens,
          },
        };
      } catch {
        // Should not happen behind a JSON Schema, which is exactly why it is
        // worth logging loudly if it ever does.
        console.error("Model output was not valid JSON despite the schema.");
        return { ok: false, reason: "unparseable" };
      }
    },
  };
}
