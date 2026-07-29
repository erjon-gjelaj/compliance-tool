import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  extractJson,
  openAiCompatibleModel,
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
  const model = openAiCompatibleModel({
    config: TEST_CONFIG,
    fetchImpl: async (input) => {
      calls.push(String(input));
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

test("provider errors are not retried as if they were empty output", async () => {
  let calls = 0;
  const model = openAiCompatibleModel({
    config: TEST_CONFIG,
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse({ error: { message: "unavailable" } }, 503);
    },
  });

  const result = await model.complete(REQUEST);

  assert.deepEqual(result, { ok: false, reason: "model_error" });
  assert.equal(calls, 1);
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
