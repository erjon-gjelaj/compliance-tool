import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  extractJson,
  openAiCompatibleModel,
  parseModelJson,
  strictResponseFormat,
} from "./openai-compatible.ts";
import type { StructuredRequest } from "./model.ts";

const REQUEST: StructuredRequest = {
  system: "Edit only what was requested.",
  user: "Remove the Responsibilities section.",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["status"],
    properties: { status: { type: "string" } },
  },
  schemaName: "RevisionResult",
  maxTokens: 1_000,
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function textResponse(
  body: string,
  status = 200,
  contentType = "text/plain",
): Response {
  return new Response(body, {
    status,
    headers: { "content-type": contentType },
  });
}

const TEST_CONFIG = {
  apiKey: "test-key",
  baseUrl: "https://openrouter.ai/api/v1",
  model: "openrouter/free",
};

test("the provider is asked to enforce the schema while decoding", () => {
  const schema = { type: "object", properties: {} };
  const responseFormat = strictResponseFormat({
    system: "system",
    user: "user",
    schema,
    schemaName: "RevisionResult",
    maxTokens: 100,
  });

  assert.deepEqual(responseFormat, {
    type: "json_schema",
    json_schema: {
      name: "RevisionResult",
      strict: true,
      schema,
    },
  });
});

test("a zero-text completion is retried once and the selected model is audited", async () => {
  const responses = [
    jsonResponse({
      id: "first",
      model: "free/provider-a",
      choices: [{ message: { content: "" }, finish_reason: null }],
      usage: { completion_tokens: 0 },
    }),
    jsonResponse({
      id: "second",
      model: "free/provider-b",
      choices: [
        {
          message: { content: '{"status":"clarification_required"}' },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 12, completion_tokens: 4 },
    }),
  ];
  const calls: string[] = [];
  const requestBodies: Record<string, unknown>[] = [];
  const model = openAiCompatibleModel({
    config: TEST_CONFIG,
    fetchImpl: async (input, init) => {
      calls.push(String(input));
      requestBodies.push(JSON.parse(String(init?.body)));
      const response = responses.shift();
      assert.ok(response, "unexpected provider call");
      return response;
    },
  });

  const result = await model.complete(REQUEST);

  assert.equal(calls.length, 2);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.json, { status: "clarification_required" });
  assert.equal(result.modelId, "openrouter.ai/free/provider-b");
  assert.deepEqual(result.usage, { input: 12, output: 4 });
  for (const body of requestBodies) {
    assert.deepEqual(body.reasoning, { effort: "none" });
  }
});

test("two zero-text completions fail closed without a third request", async () => {
  let calls = 0;
  const model = openAiCompatibleModel({
    config: TEST_CONFIG,
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse({
        id: `empty-${calls}`,
        model: "free/provider-a",
        choices: [{ message: { content: null }, finish_reason: null }],
        usage: { completion_tokens: 0 },
      });
    },
  });

  const result = await model.complete(REQUEST);

  assert.deepEqual(result, { ok: false, reason: "empty" });
  assert.equal(calls, 2);
});

test("permanent request errors are not retried", async () => {
  let calls = 0;
  const model = openAiCompatibleModel({
    config: TEST_CONFIG,
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse({ error: { message: "bad request" } }, 400);
    },
  });

  const result = await model.complete(REQUEST);

  assert.deepEqual(result, { ok: false, reason: "model_error" });
  assert.equal(calls, 1);
});

test("a transient provider error is retried once", async () => {
  const responses = [
    jsonResponse({ error: { message: "upstream unavailable" } }, 503),
    jsonResponse({
      model: "free/provider-b",
      choices: [
        {
          message: { content: '{"status":"clarification_required"}' },
          finish_reason: "stop",
        },
      ],
    }),
  ];
  let calls = 0;
  const model = openAiCompatibleModel({
    config: TEST_CONFIG,
    fetchImpl: async () => {
      calls += 1;
      const response = responses.shift();
      assert.ok(response, "unexpected provider call");
      return response;
    },
  });

  const result = await model.complete(REQUEST);

  assert.equal(result.ok, true);
  assert.equal(calls, 2);
});

test("a malformed successful response envelope is retried once", async () => {
  const responses = [
    textResponse("<html>temporary gateway response</html>", 200, "text/html"),
    jsonResponse({
      model: "free/provider-b",
      choices: [
        {
          message: { content: '{"status":"clarification_required"}' },
          finish_reason: "stop",
        },
      ],
    }),
  ];
  let calls = 0;
  const model = openAiCompatibleModel({
    config: TEST_CONFIG,
    fetchImpl: async () => {
      calls += 1;
      const response = responses.shift();
      assert.ok(response, "unexpected provider call");
      return response;
    },
  });

  const result = await model.complete(REQUEST);

  assert.equal(result.ok, true);
  assert.equal(calls, 2);
});

test("a first-attempt timeout is retried inside the shared deadline", async () => {
  let calls = 0;
  const model = openAiCompatibleModel({
    config: TEST_CONFIG,
    timeoutMs: 1_000,
    firstAttemptTimeoutMs: 100,
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) {
        throw new DOMException("timed out", "TimeoutError");
      }
      return jsonResponse({
        model: "free/provider-b",
        choices: [
          {
            message: { content: '{"status":"clarification_required"}' },
            finish_reason: "stop",
          },
        ],
      });
    },
  });

  const result = await model.complete(REQUEST);

  assert.equal(result.ok, true);
  assert.equal(calls, 2);
});

test("rate limits are reported without spending another free-tier request", async () => {
  let calls = 0;
  const model = openAiCompatibleModel({
    config: TEST_CONFIG,
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse({ error: { message: "rate limited" } }, 429);
    },
  });

  const result = await model.complete(REQUEST);

  assert.deepEqual(result, { ok: false, reason: "busy" });
  assert.equal(calls, 1);
});

test("a refusal is not retried or treated as an empty provider failure", async () => {
  let calls = 0;
  const model = openAiCompatibleModel({
    config: TEST_CONFIG,
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse({
        model: "free/provider-a",
        choices: [
          {
            message: { content: null, refusal: "I cannot do that." },
            finish_reason: "content_filter",
          },
        ],
      });
    },
  });

  const result = await model.complete(REQUEST);

  assert.deepEqual(result, { ok: false, reason: "declined" });
  assert.equal(calls, 1);
});

test("text content parts are accepted from compatible multimodal envelopes", async () => {
  const model = openAiCompatibleModel({
    config: TEST_CONFIG,
    fetchImpl: async () =>
      jsonResponse({
        model: "free/provider-a",
        choices: [
          {
            message: {
              content: [
                { type: "text", text: '{"status":' },
                { type: "text", text: '"clarification_required"}' },
              ],
            },
            finish_reason: "stop",
          },
        ],
      }),
  });

  const result = await model.complete(REQUEST);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.json, { status: "clarification_required" });
});

test("an incomplete first response is retried and a valid second response wins", async () => {
  const responses = [
    jsonResponse({
      model: "free/provider-a",
      choices: [
        {
          message: { content: '{"status":"clarification_required"' },
          finish_reason: "stop",
        },
      ],
    }),
    jsonResponse({
      model: "free/provider-b",
      choices: [
        {
          message: { content: '{"status":"clarification_required"}' },
          finish_reason: "stop",
        },
      ],
    }),
  ];
  let calls = 0;
  const model = openAiCompatibleModel({
    config: TEST_CONFIG,
    fetchImpl: async () => {
      calls += 1;
      const response = responses.shift();
      assert.ok(response, "unexpected provider call");
      return response;
    },
  });

  const result = await model.complete(REQUEST);

  assert.equal(result.ok, true);
  assert.equal(calls, 2);
});

test("two incomplete responses fail closed without a third request", async () => {
  let calls = 0;
  const model = openAiCompatibleModel({
    config: TEST_CONFIG,
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse({
        model: "free/provider-a",
        choices: [
          {
            message: { content: '{"status":"success"' },
            finish_reason: "stop",
          },
        ],
      });
    },
  });

  const result = await model.complete(REQUEST);

  assert.deepEqual(result, { ok: false, reason: "unparseable" });
  assert.equal(calls, 2);
});

test("OpenRouter-only routing controls do not leak to other compatible APIs", async () => {
  let body: Record<string, unknown> | undefined;
  const model = openAiCompatibleModel({
    config: {
      apiKey: "test-key",
      baseUrl: "https://api.groq.com/openai/v1",
      model: "free-model",
    },
    fetchImpl: async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return jsonResponse({
        model: "free-model",
        choices: [
          {
            message: { content: '{"status":"clarification_required"}' },
            finish_reason: "stop",
          },
        ],
      });
    },
  });

  const result = await model.complete(REQUEST);

  assert.equal(result.ok, true);
  assert.equal("provider" in (body ?? {}), false);
  assert.equal("reasoning" in (body ?? {}), false);
});

/**
 * Getting the JSON out of what a free-tier model actually sends.
 *
 * Strict schema enforcement should return a bare object. This remains
 * defensive because provider fallbacks and proxies have historically wrapped
 * valid JSON in a fence or preamble, and a naive `JSON.parse(content)` would
 * turn that harmless wrapper into "the revision failed".
 *
 * Lenient here, strict immediately afterwards: whatever this returns is
 * re-validated field by field with zod and then put through the change gate.
 * So there is no risk in accepting a messy wrapper, and a real cost in not.
 */

test("bare JSON is returned unchanged", () => {
  assert.equal(extractJson('{"status":"success"}'), '{"status":"success"}');
});

test("a markdown fence is stripped", () => {
  const raw = '```json\n{"status":"success"}\n```';
  assert.equal(extractJson(raw), '{"status":"success"}');
});

test("an unlabelled fence is stripped too", () => {
  assert.equal(extractJson('```\n{"status":"ok"}\n```'), '{"status":"ok"}');
});

test("a chatty preamble is discarded", () => {
  const raw = 'Sure! Here is the revised document:\n\n{"status":"success"}';
  assert.equal(extractJson(raw), '{"status":"success"}');
});

test("trailing commentary after the object is discarded", () => {
  const raw = '{"status":"success"}\n\nLet me know if you need anything else.';
  assert.equal(extractJson(raw), '{"status":"success"}');
});

test("nested braces are not truncated at the first closing brace", () => {
  // The failure this guards against would cut a document off after its first
  // section and still parse, which is worse than not parsing at all.
  const raw = '{"a":{"b":{"c":1}},"d":2}';
  assert.equal(extractJson(raw), raw);
});

test("a fenced object containing braces in a string survives", () => {
  const raw = '```json\n{"text":"use {this} form"}\n```';
  assert.equal(extractJson(raw), '{"text":"use {this} form"}');
});

test("prose with no object at all is refused rather than guessed at", () => {
  assert.equal(extractJson("I cannot help with that request."), null);
  assert.equal(extractJson(""), null);
  assert.equal(extractJson("```json\n```"), null);
});

test("a lone opening brace is refused", () => {
  // Truncated output. Returning it would produce a parse error one layer
  // later, with a reason that points at the wrong thing.
  assert.equal(extractJson('{"status":"suc'), null);
});

test("valid model JSON parses without repair", () => {
  assert.deepEqual(parseModelJson('{"status":"success"}'), {
    ok: true,
    value: { status: "success" },
    repaired: false,
  });
});

test("complete JSON with common model syntax mistakes is repaired", () => {
  const cases = [
    '{"status":"success",}',
    "{'status':'success'}",
    '{"status":"success" "summary":[]}',
    '```json\n{"status":"success",}\n```',
  ];

  for (const raw of cases) {
    const result = parseModelJson(raw);
    assert.equal(result.ok, true, raw);
    if (!result.ok) continue;
    assert.equal(result.repaired, true, raw);
    assert.equal(
      (result.value as { status?: string }).status,
      "success",
      raw,
    );
  }
});

test("truncated JSON is never completed by the repair library", () => {
  for (const raw of [
    '{"status":"success"',
    '{"status":"success","revisedDocument":{"sections":[',
    '{"status":"success","summary":["half a sentence',
  ]) {
    assert.deepEqual(parseModelJson(raw), {
      ok: false,
      reason: "incomplete",
    });
  }
});

test("multiple top-level objects are refused rather than merged or selected", () => {
  assert.deepEqual(
    parseModelJson(
      '{"status":"clarification_required"}\n{"status":"success"}',
    ),
    { ok: false, reason: "incomplete" },
  );
});

test("braces and escaped quotes inside strings do not look like structure", () => {
  const raw =
    '{"status":"success","summary":["Keep {braces} and \\"quotes\\"."]}';
  const result = parseModelJson(raw);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.repaired, false);
});

test("prose without a JSON object remains unparseable", () => {
  assert.deepEqual(parseModelJson("I cannot complete this request."), {
    ok: false,
    reason: "no_object",
  });
});
