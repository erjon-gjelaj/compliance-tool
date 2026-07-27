/**
 * Reference data: the documents a prequalification file is commonly built
 * from, and the words that identify each one inside an uploaded document.
 *
 * ## Editing this file
 *
 * You do not need to be a developer. Each entry is a block of plain
 * settings between `{` and `}`, and the fields are described below. Add a
 * new one by copying an existing block, changing the values, and keeping the
 * comma at the end. Everything is checked when the site is built, so a typo
 * shows up immediately rather than quietly doing nothing.
 *
 *   id          a short unique name, lowercase with hyphens
 *   label       what to call it in an email, the way the platforms name it
 *   source      "osha" | "platform" | "hiring_client" — see below
 *   verified    false until a real person has checked it against a source
 *   trades      which trades it applies to, or "all"
 *   platforms   which platforms ask for it, or "all"
 *   checklist   the matching line on the intake checklist, if there is one
 *   phrases     words to look for inside an uploaded document
 *   action      what the contractor should do about it
 *
 * ## What "source" means, and why it matters more than anything else here
 *
 *   "osha"           required by regulation. Nothing may carry this until a
 *                    real CFR citation has been retrieved and confirmed —
 *                    which is task 032. Today nothing does, deliberately.
 *   "platform"       commonly requested by ISNetworld or Avetta. This is
 *                    contractual, not law, and it is our understanding
 *                    rather than a rule.
 *   "hiring_client"  set by the plant or GC. We cannot see their portal, so
 *                    this is always reported as unknown.
 *
 * Never move something to "osha" because it feels obvious. Plenty of what
 * ISN asks for — programme formats, EMR thresholds, insurance limits — has
 * no OSHA basis at all, and a regulation cited for a contractual
 * requirement is the most damaging mistake this file can make.
 *
 * ## TODO-VERIFY
 *
 * Every entry below is `verified: false`. Nothing here has been checked
 * against a platform's own published requirements, and the output says so:
 * an unverified requirement is reported as something commonly asked for,
 * never as something this contractor must have. Setting `verified: true`
 * means a person has read a real source and can point at it — it is not a
 * tidy-up step.
 */

export const REQUIREMENTS_VERSION = "2026-07-26.1";

export type RequirementSource = "osha" | "platform" | "hiring_client";

export type Requirement = {
  id: string;
  label: string;
  source: RequirementSource;
  verified: boolean;
  trades: readonly string[] | "all";
  platforms: readonly string[] | "all";
  checklist?: string;
  phrases: readonly string[];
  action: string;
};

/*
 * Phrases are matched case-insensitively against the text pulled out of an
 * upload. Two or three distinctive wordings beat a long list of near
 * synonyms: the aim is to recognise a document that is genuinely about this
 * subject, not to catch a passing mention of it.
 */
export const REQUIREMENTS: readonly Requirement[] = [
  {
    id: "written-safety-program",
    label: "Written safety manual or programme",
    source: "platform",
    verified: false,
    trades: "all",
    platforms: "all",
    checklist: "Written safety manual or program",
    phrases: ["safety manual", "safety program", "safety programme", "health and safety policy"],
    action: "Have the written manual to hand as a single PDF.",
  },
  {
    id: "hazard-communication",
    label: "Hazard communication programme",
    source: "platform",
    verified: false,
    trades: "all",
    platforms: "all",
    checklist: "Hazard communication program",
    phrases: ["hazard communication", "hazcom", "safety data sheet", "right to know"],
    action: "Check it names who keeps the safety data sheets and where.",
  },
  {
    id: "lockout-tagout",
    label: "Lockout/tagout programme",
    source: "platform",
    verified: false,
    trades: "all",
    platforms: "all",
    checklist: "Lockout/tagout program",
    phrases: ["lockout", "tagout", "loto", "energy control procedure"],
    action: "Check it covers the equipment your crew actually isolates.",
  },
  {
    id: "confined-space",
    label: "Confined space entry programme",
    source: "platform",
    verified: false,
    trades: "all",
    platforms: "all",
    checklist: "Confined space entry program",
    phrases: ["confined space", "permit-required confined space", "entry permit"],
    action: "Only relevant if your crew enters confined spaces — confirm that first.",
  },
  {
    id: "fall-protection",
    label: "Fall protection programme",
    source: "platform",
    verified: false,
    trades: "all",
    platforms: "all",
    checklist: "Fall protection program",
    phrases: ["fall protection", "fall arrest", "working at height", "harness inspection"],
    action: "Check it covers the heights and anchor points on your jobs.",
  },
  {
    id: "respiratory-protection",
    label: "Respiratory protection programme",
    source: "platform",
    verified: false,
    trades: "all",
    platforms: "all",
    checklist: "Respiratory protection program",
    phrases: ["respiratory protection", "respirator", "fit test", "scba"],
    action: "Fit-test records usually get asked for alongside this.",
  },
  {
    id: "ppe",
    label: "Personal protective equipment programme",
    source: "platform",
    verified: false,
    trades: "all",
    platforms: "all",
    checklist: "Personal protective equipment program",
    phrases: ["personal protective equipment", "ppe program", "ppe policy", "hazard assessment"],
    action: "Check it includes the written hazard assessment, not just a kit list.",
  },
  {
    id: "emergency-action-plan",
    label: "Emergency action plan",
    source: "platform",
    verified: false,
    trades: "all",
    platforms: "all",
    checklist: "Emergency action plan",
    phrases: ["emergency action plan", "evacuation procedure", "muster point", "emergency response plan"],
    action: "Site-specific detail is usually what gets it sent back.",
  },
  {
    id: "drug-and-alcohol",
    label: "Drug and alcohol policy",
    source: "platform",
    verified: false,
    trades: "all",
    platforms: "all",
    checklist: "Drug and alcohol policy",
    phrases: ["drug and alcohol", "substance abuse policy", "drug testing policy"],
    action: "Plants often specify their own testing standard — ask which.",
  },
  {
    id: "training-records",
    label: "Training records for the crew",
    source: "platform",
    verified: false,
    trades: "all",
    platforms: "all",
    checklist: "Training records for the crew",
    phrases: ["training record", "certificate of completion", "competency", "toolbox talk"],
    action: "Per-person records, dated, are what gets asked for.",
  },
  {
    id: "insurance-certificate",
    label: "Certificate of insurance",
    source: "platform",
    verified: false,
    trades: "all",
    platforms: "all",
    checklist: "Certificate of insurance",
    phrases: ["certificate of liability insurance", "certificate of insurance", "acord", "general liability"],
    action: "Check the limits and the named insured against what your client asked for.",
  },
  {
    id: "osha-logs",
    label: "OSHA 300 / 300A logs",
    source: "platform",
    verified: false,
    trades: "all",
    platforms: "all",
    checklist: "OSHA 300 / 300A logs",
    phrases: ["osha 300", "300a", "log of work-related injuries", "summary of work-related injuries"],
    action: "Usually the last three years, signed.",
  },
];

/** Everything that applies to a given trade and platform. */
export function requirementsFor({
  trade,
  platform,
}: {
  trade: string;
  platform: string;
}): readonly Requirement[] {
  const wanted = (list: readonly string[] | "all", value: string) =>
    list === "all" ||
    list.some((entry) => entry.toLowerCase() === value.toLowerCase());

  return REQUIREMENTS.filter(
    (requirement) =>
      wanted(requirement.trades, trade) &&
      // "Both" and "Not sure" are not platform names, so anything
      // platform-specific is kept rather than filtered away on a guess.
      (requirement.platforms === "all" ||
        platform === "Both" ||
        platform === "Not sure" ||
        wanted(requirement.platforms, platform)),
  );
}

/** True when a real person has checked at least one entry against a source. */
export function anyVerified(): boolean {
  return REQUIREMENTS.some((requirement) => requirement.verified);
}

/* -------------------------------------------------------------------------
 * Retrieved CFR citations (task 032)
 * ---------------------------------------------------------------------- */

import verifiedCitations from "./verified-citations.json";
import {
  CITATION_GAPS,
  type CitationGap,
  type WorkContext,
} from "./citations";

export type VerifiedCitation = {
  /** e.g. "29 CFR 1910.147". */
  cfr: string;
  /** The official section heading, exactly as eCFR publishes it. */
  title: string;
  part: string;
  subpart: string;
  url: string;
  /** The standard's own text says it does not cover construction employment. */
  excludesConstruction: boolean;
};

/** The eCFR edition the cached citations were taken from. */
export const CITATIONS_SOURCE_DATE = verifiedCitations.sourceDate;

/**
 * The OSHA standards covering a requirement's subject, if any.
 *
 * Read from a file generated by scripts/verify-citations.mts, never written
 * by hand: every heading in it was retrieved from the eCFR API and checked to
 * mention the subject before being kept.
 *
 * What this is NOT, and the distinction matters more than anything else in
 * this module:
 *
 *   It does not make the requirement an OSHA requirement. `source` stays
 *   "platform" and `verified` stays false, because neither of those is about
 *   the regulation — they are about whether ISNetworld or Avetta actually
 *   asks for this document, which no amount of CFR retrieval can establish.
 *
 *   It does not say the contractor must hold a document. Whether 1910 or 1926
 *   applies, and what it requires of a particular employer, turns on the work
 *   and the site. This software cannot determine that and must not imply it.
 *
 * What it does is hand someone the real reference for the subject, so they
 * can take it to their safety adviser or their client instead of taking our
 * word for anything.
 */
export function citationsFor(requirementId: string): VerifiedCitation[] {
  const table = verifiedCitations.citations as Record<
    string,
    VerifiedCitation[] | undefined
  >;
  return table[requirementId] ?? [];
}

/**
 * Citations for a requirement, resolved against the kind of work.
 *
 * Fails closed. A citation whose own text excludes an industry is never
 * returned for that industry, and a declared gap returns no citation at all
 * rather than the nearest available one. Both matter because the failure mode
 * is silent: the tempting refactor is "we have exactly one lockout/tagout
 * citation, use it", and that citation says in its own scope clause that it
 * does not cover construction.
 *
 * `industry` is optional and callers mostly do not know it — a trade is not
 * an industry, and the same scaffolding firm can be doing maintenance under
 * Part 1910 one week and construction under 1926 the next. Omitting it
 * returns everything with its caveats attached, which is what the review
 * email does; passing it is for callers that genuinely know.
 */
export function resolveCitations({
  requirement,
  industry,
}: {
  requirement: string;
  industry?: WorkContext;
}): { citations: VerifiedCitation[]; gap: CitationGap | null } {
  const gap =
    CITATION_GAPS.find(
      (entry) =>
        entry.requirement === requirement && entry.industry === industry,
    ) ?? null;

  // A declared gap wins outright. Returning "the one we happen to have" is
  // the exact over-mapping the declaration exists to prevent.
  if (gap) return { citations: [], gap };

  const all = citationsFor(requirement);

  const citations =
    industry === "construction"
      ? all.filter((citation) => !citation.excludesConstruction)
      : all;

  return { citations, gap: null };
}

/**
 * Whether a section is a verified universal counterpart for a requirement in
 * an industry. False for anything not actually verified as such — including
 * real, relevant sections that only cover part of the ground.
 */
export function isUniversalCounterpart(
  section: string,
  requirement: string,
  industry: WorkContext,
): boolean {
  const { citations, gap } = resolveCitations({ requirement, industry });
  if (gap) return false;
  return citations.some((citation) => citation.cfr.endsWith(` ${section}`));
}
