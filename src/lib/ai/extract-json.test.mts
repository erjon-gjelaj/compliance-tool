import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  extractJson,
  strictResponseFormat,
} from "./openai-compatible.ts";

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
