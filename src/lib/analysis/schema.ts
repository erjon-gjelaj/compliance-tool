import { z } from "zod";

/**
 * The shape of a review.
 *
 * Structured rather than prose, and that is the point. Every claim has to
 * carry its own status, its own confidence and its own basis, which means the
 * email can be rendered under rules — low confidence becomes a question, an
 * unverified citation cannot be printed — instead of being trusted on tone.
 * A paragraph of free text can bury an unearned certainty in a subordinate
 * clause and nothing downstream can catch it.
 *
 * The review is built by lib/analysis/match.ts from what the documents
 * actually contain. It is still validated against this schema before anything
 * is sent: the checks below are invariants about what may be said, and they
 * are worth running against our own code, not just against input.
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
  /** e.g. "29 CFR 1910.147". Retrieved from eCFR, never recalled (task 032). */
  cfr: z.string(),
  title: z.string(),
  verifiedAt: z.string(),
  supportsClaim: z.boolean(),
  /**
   * A scope caveat taken from the standard's own text — currently only that
   * it does not cover construction. Optional because most sections carry no
   * such limit, and absent is not the same as "applies to everyone".
   */
  note: z.string().optional(),
});

export const analysisItemSchema = z.object({
  requirement: z.string(),
  source: z.enum(REQUIREMENT_SOURCES),
  status: z.enum(ITEM_STATUSES),
  confidence: z.enum(CONFIDENCE_LEVELS),
  /**
   * What this item is founded on: a document that was read, or the client's
   * own checkbox answer. Never empty, and an item with nothing solid behind
   * it must be low confidence — both enforced by the validator below.
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
  /** Which edition of lib/requirements produced this, for the audit trail. */
  referenceVersion: z.string(),
});

export type Analysis = z.infer<typeof analysisSchema>;
export type AnalysisItem = z.infer<typeof analysisItemSchema>;
export type Citation = z.infer<typeof citationSchema>;

export type ValidationOutcome =
  | { ok: true; value: Analysis }
  | { ok: false; error: string };

/**
 * Checks a review against the schema, then against the rules the schema
 * cannot express.
 *
 * The second half is the point. A structurally perfect object can still
 * assert something it has no business asserting — an item with no basis
 * marked high confidence, or a hiring client's requirement stated as known.
 * Those fail the whole analysis, and the generic explainer goes out instead.
 * Refusing to send is always available; unsaying a confident wrong answer is
 * not.
 *
 * Running this over our own output rather than only over untrusted input is
 * deliberate. These are the promises the emails make, and a change to the
 * matcher that quietly breaks one should fail here rather than in somebody's
 * inbox.
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

    // What a specific named hiring client requires is set in a portal we
    // cannot see. These are unknown, always.
    if (item.source === "hiring_client" && item.status !== "unknown") {
      problems.push(
        `${where}: hiring-client requirements must be status unknown`,
      );
    }

    // Every citation must have been retrieved and confirmed (task 032). An
    // unverified one is worse than none at all: it looks authoritative, and
    // anyone in this industry can check it in a minute.
    //
    // Deliberately NOT restricted to source === "osha" any more. That rule
    // conflated two different things. A retrieved citation says "here is the
    // OSHA standard on this subject"; `source` says "here is who is asking
    // for this document". Hazard communication is both — ISNetworld asks for
    // the programme, and 1910.1200 exists — and forcing a choice between them
    // meant either dropping a real reference or restating a contractual ask
    // as a legal requirement. The second is the mistake lib/requirements
    // warns about most loudly, so the items keep source "platform" and carry
    // the standard alongside, labelled as a reference.
    for (const citation of item.citations) {
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
