import { REJECTION_CODES, type RejectionCodeConfig } from "@/lib/config";

export type RejectionClassification = {
  code: RejectionCodeConfig["code"] | "unknown";
  matchedTerm: string | null;
  candidates: RejectionCodeConfig["code"][];
};

function containsTerm(text: string, term: string): boolean {
  const needle = term.toLowerCase();
  const at = text.indexOf(needle);
  if (at === -1) return false;
  const boundary = (character: string) => !/[a-z0-9]/.test(character);
  const before = at === 0 ? " " : text[at - 1];
  const after = text[at + needle.length] ?? " ";
  return boundary(before) && boundary(after);
}

/**
 * Classifies only when exactly one configured rejection cause matches.
 * Ambiguity is retained as unknown instead of being resolved by priority.
 */
export function classifyRejection(text: string): RejectionClassification {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return { code: "unknown", matchedTerm: null, candidates: [] };
  }

  const matches = REJECTION_CODES.flatMap((entry) => {
    const term = entry.recognition_terms.find((candidate) =>
      containsTerm(normalized, candidate),
    );
    return term ? [{ entry, term }] : [];
  });

  if (matches.length !== 1) {
    return {
      code: "unknown",
      matchedTerm: null,
      candidates: matches.map((match) => match.entry.code),
    };
  }

  return {
    code: matches[0].entry.code,
    matchedTerm: matches[0].term,
    candidates: [matches[0].entry.code],
  };
}
