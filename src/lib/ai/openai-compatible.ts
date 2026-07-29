import "server-only";

import type {
  ModelOutcome,
  StructuredModel,
  StructuredRequest,
} from "@/lib/ai/model";

/**
 * The only file in this repo that knows a model provider exists.
 *
 * Written against the OpenAI chat-completions shape rather than against one
 * vendor, because every free provider worth using speaks it — Groq,
 * OpenRouter, Together, a local llama.cpp or Ollama server. Moving between
 * them is three environment variables and no code, which is the point: the
 * free tier you are on today is not necessarily the one you will be on in six
 * months, and that should not be a deploy.
 *
 * Plain `fetch`, no SDK. The protocol is one POST with a JSON body, an SDK
 * would be a dependency that has to be swapped whenever the provider is, and
 * 063 is a recent reminder that every dependency is also a bundling problem
 * waiting to happen. Node's global fetch has none of those failure modes.
 *
 * Structured output is strict. `json_object` only guarantees parseable JSON,
 * and the first OpenRouter trial proved that is not enough: the selected model
 * returned arrays where the document schema requires strings. `json_schema`
 * constrains decoding to the requested shape. `revise-analysis.ts` still
 * re-validates every field with zod and runs the change gate regardless,
 * because valid shape says nothing about whether the edit was faithful.
 */

const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";

/** Long enough for a slow free tier, short enough to fit inside maxDuration. */
const TIMEOUT_MS = 45_000;
const DEFAULT_MAX_TOKENS = 8_192;

type Config = { baseUrl: string; apiKey: string; model: string };
type Fetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type OpenAiCompatibleOptions = {
  /** Test seam. Production reads the same three LLM_* variables as before. */
  config?: Config | null;
  fetchImpl?: Fetch;
  timeoutMs?: number;
};

function maxTokensCeiling(): number {
  const configured = Number.parseInt(process.env.LLM_MAX_TOKENS ?? "", 10);

  if (!Number.isFinite(configured) || configured < 256) {
    return DEFAULT_MAX_TOKENS;
  }

  return configured;
}

export function strictResponseFormat(request: StructuredRequest) {
  return {
    type: "json_schema",
    json_schema: {
      name: request.schemaName,
      strict: true,
      schema: request.schema,
    },
  } as const;
}

function readConfig(): Config | null {
  const apiKey = process.env.LLM_API_KEY;
  /*
   * No default model. Free-tier model names churn — they are deprecated and
   * renamed far faster than paid ones — and a stale default fails at request
   * time with a confusing "model not found" rather than at boot with an
   * obvious one. Naming it explicitly is a one-line cost, once.
   */
  const model = process.env.LLM_MODEL;

  if (!apiKey || !model) return null;

  return {
    apiKey,
    model,
    baseUrl: (process.env.LLM_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ""),
  };
}

/**
 * Pulls the JSON object out of whatever the model actually sent.
 *
 * Strict schema enforcement should return bare JSON. Provider fallbacks and
 * proxies have historically wrapped valid JSON in a markdown fence or a
 * sentence of preamble, so take the outermost braced span defensively.
 *
 * Deliberately lenient here and strict afterwards. Nothing downstream trusts
 * this — zod re-validates every field and the change gate runs on the result
 * — so being generous about the wrapper costs nothing and saves a class of
 * failure that would otherwise look like the model refusing.
 */
export function extractJson(raw: string): string | null {
  const text = raw.trim();

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) return null;

  return candidate.slice(start, end + 1);
}

function singleAttemptModel(
  config: Config,
  fetchImpl: Fetch,
  timeoutMs: number,
): StructuredModel {
  return {
    id: `${new URL(config.baseUrl).host}/${config.model}`,

    async complete(request: StructuredRequest): Promise<ModelOutcome> {
      /*
       * An explicit abort rather than relying on the platform's timeout. This
       * runs inside a server action with a 60s ceiling, and a request that
       * hangs until the function is killed gives the customer a blank page
       * instead of "we couldn't do that" — losing the one thing they need,
       * which is to know it did not happen.
       */
      const abort = AbortSignal.timeout(timeoutMs);

      let response: Response;

      try {
        response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
          method: "POST",
          signal: abort,
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${config.apiKey}`,
            /*
             * OpenRouter asks for these to attribute traffic and applies
             * better rate limits when they are present. Every other provider
             * ignores unknown headers, so they are always sent.
             */
            "http-referer": process.env.LLM_REFERER || "https://certloop.net",
            "x-title": "CertLoop",
          },
          body: JSON.stringify({
            model: config.model,
            /*
             * Zero temperature. It does not make a model deterministic and it
             * is not claimed to — but this is an editing task with one right
             * answer shape, and sampling variety is pure downside here.
             */
            temperature: 0,
            /*
             * The caller asks for enough room to return a whole programme.
             * Free models vary wildly in what they will accept — several cap
             * output well below that and reject the request outright, which
             * surfaces as a flat `model_error` and reads like the integration
             * is broken rather than like one number being too big.
             *
             * `LLM_MAX_TOKENS` is the escape hatch: set it to the model's own
             * ceiling. Lowering it does not corrupt anything — a document
             * that no longer fits comes back as `too_long`, which is a
             * refusal, not a truncated file.
             */
            max_completion_tokens: Math.min(
              request.maxTokens,
              maxTokensCeiling(),
            ),
            response_format: strictResponseFormat(request),
            messages: [
              {
                role: "system",
                content: `${request.system}\n\nReturn a single JSON object matching this schema, and nothing else:\n${JSON.stringify(request.schema)}`,
              },
              { role: "user", content: request.user },
            ],
          }),
        });
      } catch (cause) {
        if (cause instanceof Error && cause.name === "TimeoutError") {
          console.warn("The model did not answer in time.");
          return { ok: false, reason: "timeout" };
        }
        console.warn("Could not reach the model:", cause);
        return { ok: false, reason: "unreachable" };
      }

      if (response.status === 429) {
        // The expected failure on a free tier, and the one worth its own
        // message: it means try later, not that anything is broken.
        console.warn("Model rate limit reached.");
        return { ok: false, reason: "busy" };
      }

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        console.error(`Model error ${response.status}: ${detail.slice(0, 300)}`);
        return { ok: false, reason: "model_error" };
      }

      let payload: {
        id?: string;
        model?: string;
        choices?: {
          message?: { content?: string | null; refusal?: string | null };
          finish_reason?: string | null;
        }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      try {
        payload = await response.json();
      } catch {
        console.error("Model response was not JSON.");
        return { ok: false, reason: "model_error" };
      }

      const choice = payload.choices?.[0];

      /*
       * Truncation is the failure that would otherwise look like a bad model:
       * the JSON stops mid-document, parsing fails, and the logged reason
       * points at the provider rather than at a token budget we set too low.
       */
      if (choice?.finish_reason === "length") {
        console.error("Revision output hit the token limit; document too long.");
        return { ok: false, reason: "too_long" };
      }

      const content = choice?.message?.content;

      if (!content?.trim()) {
        console.error(
          "The model returned no text.",
          JSON.stringify({
            responseId: payload.id ?? null,
            requestedModel: config.model,
            selectedModel: payload.model ?? null,
            finishReason: choice?.finish_reason ?? null,
            completionTokens: payload.usage?.completion_tokens ?? 0,
            refusal: choice?.message?.refusal ?? null,
          }),
        );
        return { ok: false, reason: "empty" };
      }

      const json = extractJson(content);

      if (!json) {
        console.error("No JSON object found in the model's reply.");
        return { ok: false, reason: "unparseable" };
      }

      try {
        return {
          ok: true,
          json: JSON.parse(json),
          usage: {
            input: payload.usage?.prompt_tokens ?? 0,
            output: payload.usage?.completion_tokens ?? 0,
          },
          modelId: `${new URL(config.baseUrl).host}/${payload.model || config.model}`,
        };
      } catch {
        console.error("The model's JSON did not parse.");
        return { ok: false, reason: "unparseable" };
      }
    },
  };
}

/**
 * Retries only the free-provider failure where a successful HTTP response has
 * no completion text. Both attempts share the original deadline, so retrying
 * cannot double latency or leave the server action stuck.
 */
export function openAiCompatibleModel(
  options: OpenAiCompatibleOptions = {},
): StructuredModel {
  const config =
    options.config === undefined ? readConfig() : options.config;
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  const id = config
    ? `${new URL(config.baseUrl).host}/${config.model}`
    : "unconfigured";

  return {
    id,

    async complete(request: StructuredRequest): Promise<ModelOutcome> {
      if (!config) {
        console.error("LLM_API_KEY or LLM_MODEL is not set; revisions are off.");
        return { ok: false, reason: "not_configured" };
      }

      const startedAt = Date.now();
      const first = await singleAttemptModel(
        config,
        fetchImpl,
        timeoutMs,
      ).complete(request);

      if (first.ok || first.reason !== "empty") return first;

      const remainingMs = timeoutMs - (Date.now() - startedAt);
      if (remainingMs <= 0) return first;

      console.warn("Retrying the zero-text model response once.");
      return singleAttemptModel(config, fetchImpl, remainingMs).complete(request);
    },
  };
}
