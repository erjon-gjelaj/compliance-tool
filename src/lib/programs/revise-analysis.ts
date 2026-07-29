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
 * regulatory mapping. It is re-attached from the original by heading after the
 * model replies.
 */

/* ------------------------------------------------------------------ */
/* The shape we ask for, and the shape we accept                       */
/* ------------------------------------------------------------------ */

const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("paragraph"), text: z.string().min(1) }),
  z.object({ type: z.literal("bullets"), items: z.array(z.string().min(1)).min(1) }),
  z.object({ type: z.literal("numbered"), items: z.array(z.string().min(1)).min(1) }),
  z.object({
    type: z.literal("table"),
    head: z.array(z.string()).min(1),
    rows: z.array(z.array(z.string())).min(1),
  }),
]);

const sectionSchema = z.object({
  heading: z.string().min(1),
  blocks: z.array(blockSchema).min(1),
});

export const revisionResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("success"),
    revisedDocument: z.object({ sections: z.array(sectionSchema).min(1) }),
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

/**
 * The shape we ask the provider for, kept beside the zod version above.
 *
 * This mirrors the zod union exactly. Every object is closed and every field
 * in a selected branch is required, which is the subset strict structured
 * outputs accepts. The provider enforces this while decoding; zod still
 * validates the reply because an external API is never the final trust
 * boundary.
 *
 * `additionalProperties: false` on a section stays, and is doing a specific
 * job: it is the line that tells the model not to hand back a `sourceRef`.
 * It is belt to `reattachSourceRefs`'s braces, which drops one regardless.
 */
const BLOCK_SCHEMA = {
  anyOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "text"],
      properties: {
        type: { type: "string", enum: ["paragraph"] },
        text: { type: "string" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "items"],
      properties: {
        type: { type: "string", enum: ["bullets"] },
        items: { type: "array", items: { type: "string" } },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "items"],
      properties: {
        type: { type: "string", enum: ["numbered"] },
        items: { type: "array", items: { type: "string" } },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "head", "rows"],
      properties: {
        type: { type: "string", enum: ["table"] },
        head: { type: "array", items: { type: "string" } },
        rows: { type: "array", items: { type: "array", items: { type: "string" } } },
      },
    },
  ],
};

export const REVISION_JSON_SCHEMA: Record<string, unknown> = {
  anyOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["status", "revisedDocument", "summary"],
      properties: {
        status: { type: "string", enum: ["success"] },
        revisedDocument: {
          type: "object",
          additionalProperties: false,
          required: ["sections"],
          description:
            "The WHOLE document, including every unchanged section reproduced exactly.",
          properties: {
            sections: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["heading", "blocks"],
                properties: {
                  heading: { type: "string", minLength: 1 },
                  blocks: {
                    type: "array",
                    minItems: 1,
                    items: BLOCK_SCHEMA,
                  },
                },
              },
            },
          },
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
- Reproduce every other section, heading, sentence, bullet and table cell exactly as given, character for character. Do not reword, tidy, reorder, retitle or "improve" anything you were not asked about.
- Do not add sections. Do not add sentences to sections you were not asked to change.

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
 * Puts `sourceRef` back, from the original, matched on heading.
 *
 * Never taken from the model. A section it renamed loses its ref rather than
 * acquiring a wrong one — and a lost ref is caught by `checkRevision`, which
 * counts a rename as a removal plus an addition.
 */
function reattachSourceRefs(
  original: Section[],
  revised: { heading: string; blocks: Block[] }[],
): Section[] {
  const refs = new Map(original.map((s) => [s.heading, s.sourceRef]));
  return revised.map((section) => {
    const sourceRef = refs.get(section.heading);
    return sourceRef ? { ...section, sourceRef } : section;
  });
}

/* ------------------------------------------------------------------ */
/* The call                                                            */
/* ------------------------------------------------------------------ */

/** A revised programme can be long; leave room rather than truncate. */
const MAX_TOKENS = 32000;

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

  const revised = parsed.data.revisedDocument.sections;
  const problems = checkRevision(sections, revised);

  if (problems.length > 0) {
    console.error("Revision refused by the change gate:", problems);
    return { status: "failed", reason: "unsafe_change" };
  }

  return {
    status: "success",
    revisedDocument: reattachSourceRefs(sections, revised),
    summary: parsed.data.summary,
    modelId: outcome.modelId,
  };
}
