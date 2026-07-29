import { strict as assert } from "node:assert";

import { openAiCompatibleModel } from "../src/lib/ai/openai-compatible.ts";
import { analyseRevision } from "../src/lib/programs/revise-analysis.ts";
import type { Section } from "../src/lib/programs/types.ts";

/**
 * A live provider smoke test using invented content only.
 *
 * This intentionally stops at revision analysis: no database, renderer,
 * storage bucket, customer document, or customer fact is involved.
 */

for (const name of ["LLM_API_KEY", "LLM_MODEL", "LLM_BASE_URL"]) {
  if (!process.env[name]?.trim()) {
    throw new Error(`${name} is missing from .env.local`);
  }
}

const original: Section[] = [
  {
    heading: "Purpose and Policy",
    sourceRef: "synthetic-purpose",
    blocks: [
      {
        type: "paragraph",
        text: "The Company maintains this synthetic test program.",
      },
    ],
  },
  {
    heading: "Responsibilities",
    sourceRef: "synthetic-responsibilities",
    blocks: [
      {
        type: "paragraph",
        text: "The Safety Manager administers this synthetic test program.",
      },
    ],
  },
];

const expected: Section[] = [
  original[0],
  {
    ...original[1],
    blocks: [
      {
        type: "paragraph",
        text: "The Owner administers this synthetic test program.",
      },
    ],
  },
];

const replacement = await analyseRevision({
  model: openAiCompatibleModel(),
  sections: original,
  request:
    'In the Responsibilities section, replace "Safety Manager" with "Owner".',
});

assert.equal(
  replacement.status,
  "success",
  `Expected a safe replacement, received ${JSON.stringify(replacement)}`,
);

if (replacement.status !== "success") process.exit(1);

assert.deepEqual(
  replacement.revisedDocument,
  expected,
  "The provider changed more or less than the exact requested phrase.",
);
assert.ok(
  replacement.summary.length > 0,
  "The provider omitted its change summary.",
);

const removal = await analyseRevision({
  model: openAiCompatibleModel(),
  sections: original,
  request: "Please remove the Responsibilities section.",
});

assert.equal(
  removal.status,
  "success",
  `Expected a safe removal, received ${JSON.stringify(removal)}`,
);

if (removal.status !== "success") process.exit(1);

assert.deepEqual(
  removal.revisedDocument,
  [original[0]],
  "The provider changed content outside the removed section.",
);

const ambiguous = await analyseRevision({
  model: openAiCompatibleModel(),
  sections: original,
  request: "Please update the responsible person.",
});

assert.equal(
  ambiguous.status,
  "clarification_required",
  `Expected a clarification question, received ${JSON.stringify(ambiguous)}`,
);

if (ambiguous.status !== "clarification_required") process.exit(1);

assert.ok(
  ambiguous.questions.length > 0,
  "The provider requested clarification without asking a question.",
);

console.log(
  JSON.stringify(
    [
      {
        scenario: "exact replacement",
        status: replacement.status,
        selectedModel: replacement.modelId,
        summary: replacement.summary,
      },
      {
        scenario: "section removal",
        status: removal.status,
        selectedModel: removal.modelId,
        summary: removal.summary,
      },
      {
        scenario: "ambiguous request",
        status: ambiguous.status,
        questions: ambiguous.questions,
      },
    ],
    null,
    2,
  ),
);
