import { strict as assert } from "node:assert";

import { openAiCompatibleModel } from "../src/lib/ai/openai-compatible.ts";
import { assembleProgram } from "../src/lib/programs/assemble.ts";
import { HAZCOM } from "../src/lib/programs/hazcom.ts";
import { analyseRevision } from "../src/lib/programs/revise-analysis.ts";
import type {
  Answers,
  CompanyContext,
  Section,
} from "../src/lib/programs/types.ts";

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

const context: CompanyContext = {
  companyName: "Redline Industrial Services",
  trade: "Welding / fabrication",
  headcountBand: "6-10",
  operatingStates: ["TX"],
  platforms: "ISNetworld",
  hiringClients: ["Gulf Refining"],
  operations: null,
  logoUrl: null,
};

const answers: Answers = {
  responsible_role: "safety_manager",
  sds_format: "both",
  sds_location: "the site office and each work truck",
  labelling: "both",
  multi_employer: "yes",
  unlabelled_pipes: "yes",
  non_routine: "yes",
};

const assembled = assembleProgram({
  template: HAZCOM,
  answers,
  context,
});
assert.equal(assembled.ok, true, JSON.stringify(assembled));
if (!assembled.ok) process.exit(1);

const original = assembled.sections;
assert.ok(original.length >= 10, "The live probe must use the full programme.");

const expectedReplacement: Section[] = original.map((section) => {
  if (section.heading !== "Responsibilities") return section;

  return {
    ...section,
    blocks: section.blocks.map((block) =>
      block.type === "paragraph"
        ? {
            ...block,
            text: block.text.replace("Safety Manager", "Owner"),
          }
        : block,
    ),
  };
});

const expectedRemoval = original.filter(
  (section) => section.heading !== "Responsibilities",
);

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
  expectedReplacement,
  "The provider changed more or less than the exact requested phrase.",
);
assert.ok(
  replacement.summary.length > 0,
  "The provider omitted its change summary.",
);

const removal = await analyseRevision({
  model: openAiCompatibleModel(),
  sections: original,
  request: "Please remove the Responsibilites section.",
});

assert.equal(
  removal.status,
  "success",
  `Expected a safe removal, received ${JSON.stringify(removal)}`,
);

if (removal.status !== "success") process.exit(1);

assert.deepEqual(
  removal.revisedDocument,
  expectedRemoval,
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

const missingFact = await analyseRevision({
  model: openAiCompatibleModel(),
  sections: original,
  request:
    "In the Responsibilities section, replace Safety Manager with the new responsible role.",
});

assert.equal(
  missingFact.status,
  "clarification_required",
  `Expected a missing-fact question, received ${JSON.stringify(missingFact)}`,
);

if (missingFact.status !== "clarification_required") process.exit(1);

const contradictory = await analyseRevision({
  model: openAiCompatibleModel(),
  sections: original,
  request:
    'In the Responsibilities section, replace "Safety Manager" with "Owner" but keep "Safety Manager" unchanged.',
});

assert.equal(
  contradictory.status,
  "clarification_required",
  `Expected a contradiction question, received ${JSON.stringify(contradictory)}`,
);

if (contradictory.status !== "clarification_required") process.exit(1);

const clarified = await analyseRevision({
  model: openAiCompatibleModel(),
  sections: original,
  request: "Please update the responsible person.",
  clarifications: ambiguous.questions.map((question) => ({
    question,
    answer:
      'In the Responsibilities section, replace only "Safety Manager" with "Owner" and preserve all other text.',
  })),
});

assert.equal(
  clarified.status,
  "success",
  `Expected the clarified revision to succeed, received ${JSON.stringify(clarified)}`,
);

if (clarified.status !== "success") process.exit(1);

assert.deepEqual(
  clarified.revisedDocument,
  expectedReplacement,
  "The clarification answer changed content outside Responsibilities.",
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
      {
        scenario: "missing replacement fact",
        status: missingFact.status,
        questions: missingFact.questions,
      },
      {
        scenario: "contradictory request",
        status: contradictory.status,
        questions: contradictory.questions,
      },
      {
        scenario: "clarification answer",
        status: clarified.status,
        selectedModel: clarified.modelId,
        summary: clarified.summary,
      },
    ],
    null,
    2,
  ),
);
