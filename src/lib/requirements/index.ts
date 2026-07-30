import {
  CONFIG_RELEASE,
  REQUIREMENT_CONFIG,
} from "@/lib/config";
import verifiedCitations from "./verified-citations.json";
import {
  CITATION_GAPS,
  type CitationGap,
  type WorkContext,
} from "./citations";

export const REQUIREMENTS_VERSION = CONFIG_RELEASE;

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

/** Compatibility export for the existing deterministic gap review. */
export const REQUIREMENTS: readonly Requirement[] = REQUIREMENT_CONFIG;

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
      (requirement.platforms === "all" ||
        platform === "Both" ||
        platform === "Not sure" ||
        wanted(requirement.platforms, platform)),
  );
}

export function anyVerified(): boolean {
  return REQUIREMENTS.some((requirement) => requirement.verified);
}

export type VerifiedCitation = {
  cfr: string;
  title: string;
  part: string;
  subpart: string;
  url: string;
  excludesConstruction: boolean;
};

export const CITATIONS_SOURCE_DATE = verifiedCitations.sourceDate;

export function citationsFor(requirementId: string): VerifiedCitation[] {
  const table = verifiedCitations.citations as Record<
    string,
    VerifiedCitation[] | undefined
  >;
  return table[requirementId] ?? [];
}

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

  if (gap) return { citations: [], gap };

  const all = citationsFor(requirement);
  const citations =
    industry === "construction"
      ? all.filter((citation) => !citation.excludesConstruction)
      : all;

  return { citations, gap: null };
}

export function isUniversalCounterpart(
  section: string,
  requirement: string,
  industry: WorkContext,
): boolean {
  const { citations, gap } = resolveCitations({ requirement, industry });
  if (gap) return false;
  return citations.some((citation) => citation.cfr.endsWith(` ${section}`));
}
