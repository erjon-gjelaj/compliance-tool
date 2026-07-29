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

const result = await analyseRevision({
  model: openAiCompatibleModel(),
  sections: original,
  request:
    'In the Responsibilities section, replace "Safety Manager" with "Owner".',
});

assert.equal(
  result.status,
  "success",
  `Expected a safe revision, received ${JSON.stringify(result)}`,
);

if (result.status !== "success") process.exit(1);

assert.deepEqual(
  result.revisedDocument,
  expected,
  "The provider changed more or less than the exact requested phrase.",
);
assert.ok(result.summary.length > 0, "The provider omitted its change summary.");

console.log(
  JSON.stringify(
    {
      status: result.status,
      selectedModel: result.modelId,
      summary: result.summary,
    },
    null,
    2,
  ),
);
