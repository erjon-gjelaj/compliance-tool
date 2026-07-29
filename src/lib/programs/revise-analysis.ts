import "server-only";

import { z } from "zod";

import type { StructuredModel } from "@/lib/ai/model";
import type { Block, Section } from "@/lib/programs/types";

/**
 * Reading a customer's revision request against their document.
 *
 * The model's job is narrow on purpose: it is handed the document that exists
 * and one sentence from a hiring client's reviewer, and it either produces the
 * document with that one change applied, or it asks a question. It is never
 * asked what a programme should contain, never asked whether something is
 * compliant, and never given a blank page.
 *
 * Two gates stand between its answer and a file the customer downloads. The
 * first is the JSON Schema, enforced by the API. The second is everything in
 * `checkRevision` below, which is where the rules that actually matter live —
 * the schema can only promise shape, and shape was never the risk.
 *
 * `sourceRef` is deliberately not shown to the model and not accepted back
 * from it. It records which element of a regulation each section covers, it is
 * our own maintenance data, and a model inventing one would be inventing a
 * regulatory mapping. Deterministic code edits the original section objects,
 * so the stored reference never leaves our side of the trust boundary.
 */

/* ------------------------------------------------------------------ */
/* The shape we ask for, and the shape we accept                       */
/* ------------------------------------------------------------------ */

const revisionOperationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("remove_section"),
    targetHeading: z.string().min(1),
  }),
  z.object({
    type: z.literal("replace_text"),
    targetHeading: z.string().min(1),
    oldText: z.string().min(1),
    newText: z.string().min(1),
    replaceAll: z.boolean(),
  }),
]);

export const revisionResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("success"),
    operation: revisionOperationSchema,
    summary: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    status: z.literal("clarification_required"),
    questions: z.array(z.string().min(1)).min(1).max(5),
  }),
]);

export type RevisionResult =
  | {
      status: "success";
      revisedDocument: Section[];
      summary: string[];
      modelId: string;
    }
  | { status: "clarification_required"; questions: string[] }
  | { status: "failed"; reason: string };

export type RevisionOperation = z.infer<typeof revisionOperationSchema>;

/**
 * The shape we ask the provider for, kept beside the zod version above.
 *
 * This mirrors the zod union exactly. Every object is closed and every field
 * in a selected branch is required, which is the subset strict structured
 * outputs accepts. The provider enforces this while decoding; zod still
 * validates the reply because an external API is never the final trust
 * boundary.
 *
 * The model returns one operation against one exact existing heading, not a
 * copy of the document. Unchanged sections therefore cannot drift at all:
 * deterministic code carries them forward from the source of truth.
 */
export const REVISION_JSON_SCHEMA: Record<string, unknown> = {
  anyOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["status", "operation", "summary"],
      properties: {
        status: { type: "string", enum: ["success"] },
        operation: {
          anyOf: [
            {
              type: "object",
              additionalProperties: false,
              required: ["type", "targetHeading"],
              properties: {
                type: { type: "string", enum: ["remove_section"] },
                targetHeading: {
                  type: "string",
                  minLength: 1,
                  description:
                    "An exact heading copied from the current document.",
                },
              },
            },
            {
              type: "object",
              additionalProperties: false,
              required: [
                "type",
                "targetHeading",
                "oldText",
                "newText",
                "replaceAll",
              ],
              properties: {
                type: { type: "string", enum: ["replace_text"] },
                targetHeading: {
                  type: "string",
                  minLength: 1,
                  description:
                    "An exact heading copied from the current document.",
                },
                oldText: {
                  type: "string",
                  minLength: 1,
                  description:
                    "The smallest exact text span to find in the target section.",
                },
                newText: {
                  type: "string",
                  minLength: 1,
                  description:
                    "The replacement text, using only facts supplied by the document or customer.",
                },
                replaceAll: {
                  type: "boolean",
                  description:
                    "True only when every occurrence in this section must change.",
                },
              },
            },
          ],
          description:
            "One minimal operation against one existing section.",
        },
        summary: {
          type: "array",
          minItems: 1,
          items: { type: "string", minLength: 1 },
          description: "One short plain sentence per change.",
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["status", "questions"],
      properties: {
        status: { type: "string", enum: ["clarification_required"] },
        questions: {
          type: "array",
          minItems: 1,
          maxItems: 5,
          items: { type: "string", minLength: 1 },
        },
      },
    },
  ],
};

/* ------------------------------------------------------------------ */
/* The prompt                                                          */
/* ------------------------------------------------------------------ */

const SYSTEM = `You edit an existing safety programme document on behalf of the company that owns it. You are not writing a programme and you are not advising anyone on the law.

THE DOCUMENT IS THE SOURCE OF TRUTH.
Everything you need is either in the document or in the customer's request. You have no other knowledge of this company. If you find yourself about to write a fact that is in neither place, stop and ask a question instead.

MAKE THE SMALLEST CHANGE THAT SATISFIES THE REQUEST.
- Change only what the request explicitly asks you to change.
- Return one operation against one exact existing section heading.
- Use remove_section only when the customer explicitly asked to remove that whole section.
- Use replace_text for an edit inside one section. oldText must be the smallest exact text span copied character-for-character from that section; newText is only its replacement.
- Set replaceAll to true only when every occurrence of oldText in that section must change. If oldText occurs more than once and the request does not clearly mean all occurrences, ask a question.
- Never return unchanged sections. The application preserves them directly from the source document.
- Do not add, rename, or reorder sections. If the request requires that, ask a clarification question instead.
- If the request clearly changes more than one section, ask which single section to handle first.

NEVER INVENT A FACT.
Never introduce a name, job title, date, number, quantity, address, location, product, chemical, department, phone number, email, regulation, standard, CFR citation, or legal requirement that does not already appear in the document or in the customer's request. This is absolute. A plausible-sounding invented detail is the worst thing you can produce here, because the reader cannot tell it from a real one.

ASK RATHER THAN ASSUME.
Return clarification questions when the request is ambiguous, when it contradicts the document or itself, when it could reasonably be read more than one way, or when carrying it out would require a fact you have not been given. Asking is always safe. Guessing is never safe. Ask at most five questions, each a single plain sentence a contractor can answer without looking anything up. Do not ask about anything you can already determine from the document.

VOICE AND CONTENT RULES.
- The document is written in the company's own voice: "the Company maintains...". Keep that. Never write a sentence telling the reader what a law, regulation or platform obliges them to do.
- Never add a regulation number or citation, even if the surrounding text discusses the same subject.
- Never write a placeholder. No "[insert name]", no "TBD", no "to be determined". If you would need one, ask a question instead.

If the request asks for something you should not do — removing a section the document needs to remain coherent, adding content that would require inventing facts, or anything you cannot do without guessing — do not refuse silently and do not do it partially. Ask a question that explains what you need.

Reply only with JSON matching the schema.`;

function describeDocument(sections: Section[]): string {
  return JSON.stringify(
    { sections: sections.map(({ heading, blocks }) => ({ heading, blocks })) },
    null,
    1,
  );
}

export type ClarificationExchange = { question: string; answer: string };

function buildUserPrompt({
  sections,
  request,
  clarifications,
}: {
  sections: Section[];
  request: string;
  clarifications: ClarificationExchange[];
}): string {
  const parts = [
    "Here is the current document.",
    describeDocument(sections),
    "",
    "The customer's hiring client asked for this change, in the reviewer's own words:",
    request,
  ];

  if (clarifications.length > 0) {
    /*
     * The retry carries the original request plus what was asked and
     * answered. The model is told these are the customer's own words so it
     * treats them as fact about the company — they are the only new facts it
     * is permitted to use.
     */
    parts.push(
      "",
      "You previously asked for clarification. The customer answered:",
      ...clarifications.map(
        ({ question, answer }) => `Q: ${question}\nA: ${answer}`,
      ),
      "",
      "Use those answers as fact. If they still do not tell you something you need, ask again.",
    );
  }

  return parts.join("\n");
}

/* ------------------------------------------------------------------ */
/* The gate                                                            */
/* ------------------------------------------------------------------ */

function textOf(block: Block): string[] {
  switch (block.type) {
    case "paragraph":
      return [block.text];
    case "bullets":
    case "numbered":
      return block.items;
    case "table":
      return [...block.head, ...block.rows.flat()];
  }
}

function bodyOf(section: { heading: string; blocks: Block[] }): string {
  return section.blocks.flatMap(textOf).join("\n");
}

function regexEscape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function editDistance(left: string, right: string): number {
  const previous = Array.from(
    { length: right.length + 1 },
    (_, index) => index,
  );

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitution =
        previous[rightIndex - 1] +
        (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1);
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        substitution,
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
}

function namedHeadings(
  sections: Section[],
  instructions: string,
): string[] {
  const words = instructions.match(/[a-z0-9]+/g) ?? [];

  return sections
    .filter((section) => {
      const heading = section.heading.toLocaleLowerCase();
      if (instructions.includes(heading)) return true;

      const headingWords = heading.match(/[a-z0-9]+/g) ?? [];
      const threshold = Math.min(
        2,
        Math.max(1, Math.floor(heading.length * 0.12)),
      );

      for (
        let index = 0;
        index <= words.length - headingWords.length;
        index += 1
      ) {
        const candidate = words
          .slice(index, index + headingWords.length)
          .join(" ");
        if (editDistance(candidate, headingWords.join(" ")) <= threshold) {
          return true;
        }
      }

      return false;
    })
    .map((section) => section.heading);
}

/**
 * Refuses a revision whose changes go beyond what was asked for.
 *
 * The schema cannot see any of this. A perfectly-shaped document that quietly
 * rewrote three sections nobody mentioned, or dropped a citation, or added a
 * regulation reference, satisfies every structural rule and is exactly the
 * output this product must not ship.
 *
 * The rule is blunt on purpose: a revision may change at most one section
 * unless the request named more, and may not introduce a citation anywhere.
 * A blunt rule that occasionally refuses a legitimate edit is the right trade
 * against one that occasionally passes an illegitimate one — the customer can
 * ask again or a person can do it, and neither of those ends with a
 * contractor submitting a document nobody wrote.
 */
export type RevisionProblem = { code: string; detail: string };

const CITATION = /\b\d{2}\s*CFR\s*\d|\b1910\.\d|\b1926\.\d/i;

export function checkRevision(
  original: Section[],
  revised: { heading: string; blocks: Block[] }[],
): RevisionProblem[] {
  const problems: RevisionProblem[] = [];

  const before = new Map(original.map((s) => [s.heading, bodyOf(s)]));
  const after = new Map(revised.map((s) => [s.heading, bodyOf(s)]));

  const removed = [...before.keys()].filter((h) => !after.has(h));
  const added = [...after.keys()].filter((h) => !before.has(h));
  const changed = [...after.keys()].filter(
    (h) => before.has(h) && before.get(h) !== after.get(h),
  );

  /*
   * A new section is content nobody asked us to write. Even when the request
   * did ask for one, we would be inventing its substance, which is the thing
   * the whole prompt is built to prevent.
   */
  for (const heading of added) {
    problems.push({ code: "section_added", detail: `added "${heading}"` });
  }

  const touched = removed.length + changed.length;
  if (touched > 1) {
    problems.push({
      code: "too_many_changes",
      detail: `${touched} sections changed or removed; a revision changes one`,
    });
  }

  /*
   * Citations are retrieved at build time from eCFR and never written by
   * hand — see the regulatory output rules. A model producing one is
   * producing exactly the artefact those rules exist to keep out, and it
   * would look as official as a real one.
   */
  for (const section of revised) {
    const beforeText = before.get(section.heading) ?? "";
    for (const value of section.blocks.flatMap(textOf)) {
      if (CITATION.test(value) && !CITATION.test(beforeText)) {
        problems.push({
          code: "citation_introduced",
          detail: `"${section.heading}": ${value.slice(0, 80)}`,
        });
      }
    }
  }

  if (revised.length === 0) {
    problems.push({ code: "empty_document", detail: "no sections left" });
  }

  return problems;
}

/**
 * Applies one exact operation to the source-of-truth document.
 *
 * Untouched sections, headings, block structure, and `sourceRef` values come
 * only from the original. A text replacement is accepted only when its exact
 * old text exists unambiguously, unless the model explicitly says every
 * occurrence must change.
 */
export function applyRevisionOperation(
  original: Section[],
  operation: RevisionOperation,
): Section[] | null {
  const targetIndex = original.findIndex(
    (section) => section.heading === operation.targetHeading,
  );
  if (targetIndex === -1) return null;

  if (operation.type === "remove_section") {
    return original.filter((_, index) => index !== targetIndex);
  }

  if (operation.oldText === operation.newText) return null;

  const target = original[targetIndex];
  const occurrences = target.blocks
    .flatMap(textOf)
    .reduce(
      (total, value) =>
        total + value.split(operation.oldText).length - 1,
      0,
    );

  if (
    occurrences === 0 ||
    (!operation.replaceAll && occurrences !== 1)
  ) {
    return null;
  }

  const replace = (value: string) =>
    value.split(operation.oldText).join(operation.newText);

  const blocks = target.blocks.map((block): Block => {
    switch (block.type) {
      case "paragraph":
        return { ...block, text: replace(block.text) };
      case "bullets":
      case "numbered":
        return { ...block, items: block.items.map(replace) };
      case "table":
        return {
          ...block,
          head: block.head.map(replace),
          rows: block.rows.map((row) => row.map(replace)),
        };
    }
  });

  return original.map((section, index) =>
    index === targetIndex ? { ...section, blocks } : section,
  );
}

/* ------------------------------------------------------------------ */
/* The call                                                            */
/* ------------------------------------------------------------------ */

/** One section patch plus a short summary; the whole document is never echoed. */
const MAX_TOKENS = 4096;

export async function analyseRevision({
  model,
  sections,
  request,
  clarifications = [],
}: {
  model: StructuredModel;
  sections: Section[];
  request: string;
  clarifications?: ClarificationExchange[];
}): Promise<RevisionResult> {
  const outcome = await model.complete({
    system: SYSTEM,
    user: buildUserPrompt({ sections, request, clarifications }),
    schema: REVISION_JSON_SCHEMA,
    schemaName: "RevisionResult",
    maxTokens: MAX_TOKENS,
  });

  if (!outcome.ok) return { status: "failed", reason: outcome.reason };

  const parsed = revisionResultSchema.safeParse(outcome.json);

  if (!parsed.success) {
    console.error("Revision output failed validation:", parsed.error.issues);
    return { status: "failed", reason: "invalid_shape" };
  }

  if (parsed.data.status === "clarification_required") {
    return {
      status: "clarification_required",
      questions: parsed.data.questions,
    };
  }

  const operation = parsed.data.operation;
  const instructions = [
    request,
    ...clarifications.flatMap(({ question, answer }) => [question, answer]),
  ]
    .join("\n")
    .toLocaleLowerCase();
  const target = sections.find(
    (section) => section.heading === operation.targetHeading,
  );
  const mentionedHeadings = namedHeadings(sections, instructions);

  if (
    !target ||
    mentionedHeadings.length !== 1 ||
    mentionedHeadings[0] !== target.heading
  ) {
    return {
      status: "clarification_required",
      questions: [
        "Which exact section heading should be changed?",
      ],
    };
  }

  if (operation.type === "remove_section") {
    const removalWasRequested =
      /\b(remove|delete|drop|omit)\b/.test(instructions) ||
      instructions.includes("take out");
    const removalWasNegated =
      /\b(?:do not|don't|never|not to)\s+(?:remove|delete|drop|omit)\b/.test(
        instructions,
      ) ||
      /\b(?:do not|don't|never|not to)\s+take\s+out\b/.test(instructions);

    if (!removalWasRequested || removalWasNegated) {
      return {
        status: "clarification_required",
        questions: [
          `Should the entire "${target.heading}" section be removed?`,
        ],
      };
    }
  }

  if (operation.type === "replace_text") {
    const oldTextPattern = regexEscape(operation.oldText.toLocaleLowerCase());
    const preserveOldText = new RegExp(
      `(?:keep|leave)\\s+["']?${oldTextPattern}["']?\\s+unchanged|(?:do not|don't)\\s+(?:change|replace)\\s+["']?${oldTextPattern}`,
    );

    if (preserveOldText.test(instructions)) {
      return {
        status: "clarification_required",
        questions: [
          `Should "${operation.oldText}" remain unchanged or be replaced?`,
        ],
      };
    }

    const occurrences = target.blocks
      .flatMap(textOf)
      .reduce(
        (total, value) =>
          total + value.split(operation.oldText).length - 1,
        0,
      );

    if (occurrences === 0) {
      return {
        status: "clarification_required",
        questions: [
          `What exact existing text in "${target.heading}" should be changed?`,
        ],
      };
    }

    if (!instructions.includes(operation.newText.toLocaleLowerCase())) {
      return {
        status: "clarification_required",
        questions: [
          `What exact replacement text should be used in "${target.heading}"?`,
        ],
      };
    }

    if (!operation.replaceAll && occurrences > 1) {
      return {
        status: "clarification_required",
        questions: [
          `Should every occurrence of "${operation.oldText}" in "${target.heading}" be changed?`,
        ],
      };
    }

    if (
      operation.replaceAll &&
      occurrences > 1 &&
      !/\b(all|every|each)\b/.test(instructions) &&
      !instructions.includes("throughout")
    ) {
      return {
        status: "clarification_required",
        questions: [
          `Should every occurrence of "${operation.oldText}" in "${target.heading}" be changed?`,
        ],
      };
    }

    if (operation.oldText === operation.newText) {
      return {
        status: "clarification_required",
        questions: ["What should the existing text be changed to?"],
      };
    }
  }

  const revised = applyRevisionOperation(sections, operation);
  if (!revised) {
    console.error(
      `Revision operation did not apply safely: ${parsed.data.operation.type} on ${parsed.data.operation.targetHeading}`,
    );
    return { status: "failed", reason: "operation_not_applicable" };
  }

  const problems = checkRevision(sections, revised);

  if (problems.length > 0) {
    console.error("Revision refused by the change gate:", problems);
    return { status: "failed", reason: "unsafe_change" };
  }

  return {
    status: "success",
    revisedDocument: revised,
    summary: parsed.data.summary,
    modelId: outcome.modelId,
  };
}
