import {
  CONFIG_RELEASE,
  EVIDENCE_REQUIREMENTS,
  PROGRAM_CATALOG,
} from "@/lib/config";
import type { Predicate } from "@/lib/config/schema";

export type RequirementStatus =
  | "missing"
  | "draft"
  | "submitted"
  | "under_review"
  | "accepted"
  | "rejected"
  | "expired";

export type RequirementInput = {
  companyId: string;
  profile: Record<string, unknown>;
  tradeCodes: string[];
  scopeOfWork: string[];
  platformKey: string | null;
  hiringClientId: string | null;
};

export type GeneratedRequirement = {
  categoryKey:
    | "written_programs"
    | "statistics"
    | "recordkeeping"
    | "insurance"
    | "questionnaire"
    | "training";
  requirementKey: string;
  title: string;
  status: RequirementStatus;
  applicability: "included" | "unknown";
  applicabilityBasis: {
    configRelease: string;
    predicate: Predicate;
    result: "true" | "unknown";
    reason: string | null;
  };
};

type PredicateResult =
  | { result: true; reason: null }
  | { result: false; reason: null }
  | { result: "unknown"; reason: string };

function fieldValue(
  input: RequirementInput,
  field: string,
): unknown {
  if (field === "trade_codes") return input.tradeCodes;
  if (field === "scope_of_work") return input.scopeOfWork;
  return input.profile[field];
}

export function evaluatePredicate(
  predicate: Predicate,
  input: RequirementInput,
): PredicateResult {
  switch (predicate.op) {
    case "always":
      return { result: true, reason: null };
    case "unknown":
      return { result: "unknown", reason: predicate.reason };
    case "field_present": {
      const value = fieldValue(input, predicate.field);
      if (value === undefined || value === null || value === "") {
        return {
          result: "unknown",
          reason: `${predicate.field} has not been supplied`,
        };
      }
      return { result: true, reason: null };
    }
    case "field_equals": {
      const value = fieldValue(input, predicate.field);
      if (value === undefined || value === null) {
        return {
          result: "unknown",
          reason: `${predicate.field} has not been supplied`,
        };
      }
      return { result: value === predicate.value, reason: null };
    }
    case "field_includes": {
      const value = fieldValue(input, predicate.field);
      if (!Array.isArray(value)) {
        return {
          result: "unknown",
          reason: `${predicate.field} has not been supplied as a list`,
        };
      }
      return {
        result: value.some(
          (entry) =>
            typeof entry === "string" &&
            entry.toLowerCase() === predicate.value.toLowerCase(),
        ),
        reason: null,
      };
    }
    case "number_gte":
    case "number_gt": {
      const value = fieldValue(input, predicate.field);
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return {
          result: "unknown",
          reason: `${predicate.field} has not been supplied as a number`,
        };
      }
      return {
        result:
          predicate.op === "number_gte"
            ? value >= predicate.value
            : value > predicate.value,
        reason: null,
      };
    }
    case "not": {
      const nested = evaluatePredicate(predicate.predicate, input);
      return nested.result === "unknown"
        ? nested
        : { result: !nested.result, reason: null };
    }
    case "all": {
      const results = predicate.predicates.map((entry) =>
        evaluatePredicate(entry, input),
      );
      if (results.some((entry) => entry.result === false)) {
        return { result: false, reason: null };
      }
      const unknown = results.find((entry) => entry.result === "unknown");
      return unknown ?? { result: true, reason: null };
    }
    case "any": {
      const results = predicate.predicates.map((entry) =>
        evaluatePredicate(entry, input),
      );
      if (results.some((entry) => entry.result === true)) {
        return { result: true, reason: null };
      }
      const unknown = results.find((entry) => entry.result === "unknown");
      return unknown ?? { result: false, reason: null };
    }
  }
}

export function generateRequirementSet(
  input: RequirementInput,
): GeneratedRequirement[] {
  const programRequirements = PROGRAM_CATALOG.flatMap((program) => {
    const evaluation = evaluatePredicate(program.triggered_by, input);
    if (evaluation.result === false) return [];

    return [
      {
        categoryKey: "written_programs" as const,
        requirementKey: `program.${program.program_key}`,
        title: program.title,
        status: "missing" as const,
        applicability:
          evaluation.result === "unknown" ? ("unknown" as const) : ("included" as const),
        applicabilityBasis: {
          configRelease: CONFIG_RELEASE,
          predicate: program.triggered_by,
          result: evaluation.result === true ? ("true" as const) : ("unknown" as const),
          reason: evaluation.reason,
        },
      },
    ];
  });

  const evidenceRequirements = EVIDENCE_REQUIREMENTS.map((requirement) => ({
    categoryKey: requirement.category_key,
    requirementKey: requirement.requirement_key,
    title: requirement.title,
    status: "missing" as const,
    applicability: "included" as const,
    applicabilityBasis: {
      configRelease: CONFIG_RELEASE,
      predicate: requirement.triggered_by,
      result: "true" as const,
      reason: null,
    },
  }));

  return [...programRequirements, ...evidenceRequirements];
}

const TRANSITIONS: Record<RequirementStatus, RequirementStatus[]> = {
  missing: ["draft", "submitted"],
  draft: ["submitted", "missing"],
  submitted: ["under_review", "accepted", "rejected"],
  under_review: ["accepted", "rejected"],
  accepted: ["expired"],
  rejected: ["draft", "submitted"],
  expired: ["draft", "submitted"],
};

export function canTransitionRequirement(
  from: RequirementStatus,
  to: RequirementStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export function transitionRequirement(
  from: RequirementStatus,
  to: RequirementStatus,
  at: string,
): {
  status: RequirementStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
} {
  if (!canTransitionRequirement(from, to)) {
    throw new Error(`Invalid requirement transition: ${from} -> ${to}`);
  }
  return {
    status: to,
    submittedAt: to === "submitted" ? at : null,
    reviewedAt:
      to === "accepted" || to === "rejected" || to === "under_review"
        ? at
        : null,
  };
}
