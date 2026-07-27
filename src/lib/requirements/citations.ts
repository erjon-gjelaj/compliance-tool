/**
 * Candidate CFR citations, and the words that must actually turn up in the
 * regulation before one is used.
 *
 * Nothing here is a claim. Every entry is a *proposal* to be checked against
 * the eCFR API by scripts/verify-citations.mts, and only what comes back
 * verified reaches src/lib/requirements/verified-citations.json, which is the
 * file the application reads. A section that does not exist, or whose real
 * heading does not contain the expected words, is dropped rather than shown.
 *
 * That ordering is the whole point of this module. Regulatory citations are
 * exactly the kind of thing that is easy to state confidently and wrongly, and
 * a wrong CFR number in an email to a contractor is worse than no number at
 * all — it is checkable, and it will be checked. So the number is never
 * asserted from memory: it is retrieved, and what gets displayed is the
 * heading the government publishes, not a description written here.
 *
 * ## What a citation means, and does not
 *
 * A verified citation says: this is the OSHA standard covering this subject.
 * It does NOT say the contractor is required to hold a particular document,
 * and the email must not imply that it does. Applicability turns on the work,
 * the industry and the site — 1910 is general industry, 1926 is construction,
 * and which applies is not something this software can determine. The value
 * here is giving someone the real reference to take to their safety adviser
 * or their hiring client, not telling them what the law requires of them.
 *
 * ## Requirements deliberately left without a citation
 *
 * Four of the twelve carry none, because no single OSHA standard requires the
 * document a prequalification platform is asking for:
 *
 *   written-safety-program   no standard mandates a "safety manual" as such
 *   drug-and-alcohol         a client contract term, not an OSHA requirement
 *   insurance-certificate    a commercial requirement, nothing to do with OSHA
 *   training-records         training duties are spread across many standards
 *                            rather than one that could be cited honestly
 *
 * Leaving these empty is the point of the exercise, not a gap in it. They stay
 * contractual, and the email keeps saying so.
 */

export type CitationCandidate = {
  /** Matches an id in REQUIREMENTS. */
  requirement: string;
  /** CFR title. 29 is Labor, which is where OSHA lives. */
  title: number;
  part: string;
  section: string;
  /**
   * Words that must ALL appear — this is a conjunction, not a list of
   * alternatives — in the retrieved subpart description and section heading
   * taken together, compared case-insensitively.
   *
   * Both halves are searched because either alone is insufficient. 1910.132
   * and 1926.1203 are both published as "General requirements", so the
   * heading says nothing; and a subpart covers many sections, so the subpart
   * alone would accept any of its siblings. Requiring every term across the
   * pair is what makes a plausible-looking wrong section fail.
   *
   * Body text is deliberately NOT searched. A phrase can appear anywhere in a
   * long regulation for reasons that have nothing to do with its subject —
   * matching on that would accept almost anything and quietly defeat the
   * point of checking at all.
   */
  expect: string[];
};

export const CITATION_CANDIDATES: readonly CitationCandidate[] = [
  {
    requirement: "hazard-communication",
    title: 29,
    part: "1910",
    section: "1910.1200",
    expect: ["hazard communication"],
  },
  {
    requirement: "lockout-tagout",
    title: 29,
    part: "1910",
    section: "1910.147",
    expect: ["control of hazardous energy", "lockout/tagout"],
  },
  {
    requirement: "confined-space",
    title: 29,
    part: "1910",
    section: "1910.146",
    expect: ["permit-required confined spaces"],
  },
  {
    // Construction has its own confined space rules, and a scaffolding or
    // welding subcontractor on a plant turnaround is far more likely to be
    // working to these than to the general industry ones.
    requirement: "confined-space",
    title: 29,
    part: "1926",
    section: "1926.1203",
    expect: ["general requirements", "confined spaces"],
  },
  {
    requirement: "fall-protection",
    title: 29,
    part: "1910",
    section: "1910.28",
    expect: ["duty to have fall protection"],
  },
  {
    requirement: "fall-protection",
    title: 29,
    part: "1926",
    section: "1926.501",
    expect: ["duty to have fall protection"],
  },
  {
    requirement: "respiratory-protection",
    title: 29,
    part: "1910",
    section: "1910.134",
    expect: ["respiratory protection"],
  },
  {
    requirement: "ppe",
    title: 29,
    part: "1910",
    section: "1910.132",
    expect: ["general requirements", "personal protective equipment"],
  },
  {
    requirement: "ppe",
    title: 29,
    part: "1926",
    section: "1926.95",
    expect: ["criteria for personal protective equipment"],
  },
  {
    requirement: "emergency-action-plan",
    title: 29,
    part: "1910",
    section: "1910.38",
    expect: ["emergency action plans"],
  },
  {
    requirement: "osha-logs",
    title: 29,
    part: "1904",
    section: "1904.4",
    expect: ["recording criteria"],
  },
  {
    requirement: "osha-logs",
    title: 29,
    part: "1904",
    section: "1904.32",
    expect: ["annual summary"],
  },
];

/* -------------------------------------------------------------------------
 * Mappings we have deliberately NOT made
 * ---------------------------------------------------------------------- */

/**
 * Why a requirement has no citation for a given kind of work.
 *
 * An empty citation list is ambiguous in a way that matters: it could mean
 * nobody researched it, that it was researched and nothing applies, or that
 * it was dropped by accident. Those call for completely different responses,
 * so the refusal is declared rather than inferred from absence.
 */
export type CitationMappingStatus =
  /** A section was retrieved and checked. */
  | "verified"
  /** Researched; the regulations genuinely contain no counterpart. */
  | "no-direct-counterpart"
  /** Counterparts exist but depend on the equipment or activity. */
  | "context-dependent"
  /** Not yet researched. Distinct from a decision. */
  | "unresolved";

export type WorkContext = "general-industry" | "construction";

export type CitationGap = {
  requirement: string;
  industry: WorkContext;
  status: Exclude<CitationMappingStatus, "verified">;
  /**
   * Stable identifier for this class of gap. Callers and tests key off this
   * rather than the prose, so the wording can be improved without breaking
   * anything that depends on the behaviour.
   */
  code: string;
  reason: string;
};

/**
 * Declared gaps.
 *
 * Note the split this file maintains throughout. That 1910.147 excludes
 * construction is a *retrieved fact* — scripts/verify-citations.mts reads it
 * out of the regulation. That no Part 1926 section is a universal substitute
 * is a *mapping decision* made here, and it is a much weaker claim than it
 * might look: it says no validated one-to-one counterpart exists, not that
 * construction has no energy-control rules. It plainly does. Which one
 * applies depends on the equipment and the activity, which is exactly why
 * this is refused rather than guessed.
 */
export const CITATION_GAPS: readonly CitationGap[] = [
  {
    requirement: "lockout-tagout",
    industry: "construction",
    status: "context-dependent",
    code: "CONTEXT_DEPENDENT_CITATION",
    reason:
      "No universal Part 1926 counterpart to 29 CFR 1910.147 has been verified. " +
      "Construction lockout/tagout requirements are context-dependent and may arise " +
      "under electrical, equipment-specific, or process-specific provisions. No " +
      "construction citation is given without more detail about the work.",
  },
];

/**
 * Citations that apply only in a named context.
 *
 * Empty, and that is the point of having it. 1926.417 ("Lockout and tagging
 * of circuits") is a real construction provision, but it is about electrical
 * circuits — offering it as *the* construction answer for lockout/tagout
 * would be over-mapping of exactly the kind CITATION_GAPS exists to prevent.
 * This shape lets a narrower, verified mapping be added later without anyone
 * having to declare a universal counterpart to do it.
 */
export type ContextualCitationCandidate = CitationCandidate & {
  industry: WorkContext;
  /** e.g. "electrical-circuits". Callers must ask for it explicitly. */
  context: string;
};

export const CONTEXTUAL_CITATION_CANDIDATES: readonly ContextualCitationCandidate[] =
  [];
