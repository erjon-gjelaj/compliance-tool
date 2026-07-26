import { z } from "zod";

/**
 * The shape the model must answer in.
 *
 * Prose is not acceptable here. A free-text answer can hedge, bury a
 * certainty it hasn't earned in a subordinate clause, or state a requirement
 * as fact — and none of that is checkable before it goes out. A structured
 * answer forces every claim to carry its own confidence, its own basis, and
 * its own status, which is what makes the email renderable under rules rather
 * than trusted on tone.
 *
 * This schema is also sent to the API as a structured-output format, so the
 * model is constrained to it at generation time rather than only checked
 * afterwards. It is still validated on the way back: constrained decoding is
 * not a guarantee we should take on trust for something that gets emailed to
 * a stranger.
 */

/**
 * The three buckets an item can sit in, and they are not interchangeable.
 *
 * ISNetworld and Avetta requirements are contractual — set by the platform
 * and the hiring client. They overlap with OSHA but plenty of what ISN asks
 * for (written program formats, EMR thresholds, insurance limits,
 * client-specific questionnaires) has no OSHA basis at all. Keeping the
 * source on the item is what stops the email implying a CFR citation proves
 * an ISN requirement, or that satisfying ISN means OSHA compliance.
 */
export const REQUIREMENT_SOURCES = [
  "osha",
  "platform",
  "hiring_client",
] as const;

export const ITEM_STATUSES = ["present", "likely_missing", "unknown"] as const;

export const CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;

export const PRICE_BANDS = ["low", "medium", "high", "unknown"] as const;

export const citationSchema = z.object({
  /** e.g. "29 CFR 1910.147". Verified against eCFR before rendering (task 032). */
  cfr: z.string(),
  title: z.string(),
  verifiedAt: z.string(),
  supportsClaim: z.boolean(),
});

export const analysisItemSchema = z.object({
  requirement: z.string(),
  source: z.enum(REQUIREMENT_SOURCES),
  status: z.enum(ITEM_STATUSES),
  confidence: z.enum(CONFIDENCE_LEVELS),
  /**
   * What this item is founded on: a document that was read, or the client's
   * own checkbox answer. An item with nothing behind it must be low
   * confidence, which is checked below rather than left to the prompt.
   */
  basis: z.string(),
  action: z.string(),
  citations: z.array(citationSchema),
});

export const analysisSchema = z.object({
  summary: z.string(),
  items: z.array(analysisItemSchema),
  questionsForClient: z.array(z.string()),
  priceBand: z.enum(PRICE_BANDS),
  unreadableFiles: z.array(z.string()),
});

export type Analysis = z.infer<typeof analysisSchema>;
export type AnalysisItem = z.infer<typeof analysisItemSchema>;
export type Citation = z.infer<typeof citationSchema>;

export type ValidationOutcome =
  | { ok: true; value: Analysis }
  | { ok: false; error: string };

/**
 * Checks the model's answer against the schema, then against the rules the
 * schema cannot express.
 *
 * The second half is the point. A structurally perfect object can still
 * assert something it has no business asserting — an item with no basis
 * marked high confidence, or a hiring client's requirement stated as known.
 * Those are caught here and fail the whole analysis, which sends the generic
 * explainer instead. Refusing to send is always available; unsaying a
 * confident wrong answer is not.
 */
export function validateAnalysis(raw: unknown): ValidationOutcome {
  const parsed = analysisSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; "),
    };
  }

  const value = parsed.data;
  const problems: string[] = [];

  value.items.forEach((item, index) => {
    const where = `items[${index}]`;

    if (!item.basis.trim()) {
      problems.push(`${where}: no basis given`);
    }

    // An unknown is a question, not a finding, so it cannot be confident.
    if (item.status === "unknown" && item.confidence === "high") {
      problems.push(`${where}: status unknown but confidence high`);
    }

    // What a specific named hiring client requires is not something we know
    // unless it is in the reference data, and the reference data is not the
    // model's memory. These default to unknown, always.
    if (item.source === "hiring_client" && item.status !== "unknown") {
      problems.push(
        `${where}: hiring-client requirements must be status unknown`,
      );
    }

    // A citation only belongs on an OSHA item, and only once it has been
    // retrieved and confirmed to support the claim (task 032). Anything else
    // is an unverified citation, which is worse than none — it looks
    // authoritative and anyone in the industry can check it in a minute.
    for (const citation of item.citations) {
      if (item.source !== "osha") {
        problems.push(`${where}: citation on a non-OSHA item`);
      }
      if (!citation.supportsClaim) {
        problems.push(`${where}: citation not confirmed to support the claim`);
      }
    }
  });

  if (problems.length > 0) {
    return { ok: false, error: problems.join("; ") };
  }

  return { ok: true, value };
}

/**
 * The JSON Schema handed to the API as the output format.
 *
 * Written out rather than generated from the zod schema, because structured
 * outputs require `additionalProperties: false` on every object and reject
 * several constructs a generator will happily emit. Keeping it explicit means
 * what the model is constrained to is readable in one place.
 */
export const ANALYSIS_JSON_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description:
        "Two or three plain sentences describing where this contractor's " +
        "file stands. No verdict on whether they are compliant.",
    },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          requirement: {
            type: "string",
            description: "The document or programme, named the way ISN names it.",
          },
          source: {
            type: "string",
            enum: [...REQUIREMENT_SOURCES],
            description:
              "osha = required by regulation. platform = commonly requested " +
              "by ISNetworld/Avetta, per our reference data, which is our " +
              "understanding and not law. hiring_client = specific to their " +
              "client, which we do not know.",
          },
          status: { type: "string", enum: [...ITEM_STATUSES] },
          confidence: { type: "string", enum: [...CONFIDENCE_LEVELS] },
          basis: {
            type: "string",
            description:
              "The document this came from, or the client's own answer. " +
              "Never empty.",
          },
          action: {
            type: "string",
            description: "What they should do next about this item.",
          },
          citations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                cfr: { type: "string" },
                title: { type: "string" },
                verifiedAt: { type: "string" },
                supportsClaim: { type: "boolean" },
              },
              required: ["cfr", "title", "verifiedAt", "supportsClaim"],
              additionalProperties: false,
            },
          },
        },
        required: [
          "requirement",
          "source",
          "status",
          "confidence",
          "basis",
          "action",
          "citations",
        ],
        additionalProperties: false,
      },
    },
    questionsForClient: {
      type: "array",
      items: { type: "string" },
      description:
        "Anything you are not sure about, phrased as a question to them.",
    },
    priceBand: { type: "string", enum: [...PRICE_BANDS] },
    unreadableFiles: {
      type: "array",
      items: { type: "string" },
      description: "Files that could not be read, by name.",
    },
  },
  required: [
    "summary",
    "items",
    "questionsForClient",
    "priceBand",
    "unreadableFiles",
  ],
  additionalProperties: false,
} as const;
