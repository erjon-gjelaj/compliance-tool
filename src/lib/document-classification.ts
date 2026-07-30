export const DOCUMENT_TYPES = [
  "program",
  "coi",
  "osha_300",
  "osha_300a",
  "emr_letter",
  "training_roster",
  "cert",
  "license",
  "msq_export",
  "other",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

type Rule = {
  type: Exclude<DocumentType, "other">;
  phrases: string[];
  minimumMatches: number;
};

const RULES: Rule[] = [
  {
    type: "coi",
    phrases: [
      "certificate of liability insurance",
      "acord 25",
      "commercial general liability",
      "workers compensation",
    ],
    minimumMatches: 2,
  },
  {
    type: "osha_300a",
    phrases: [
      "summary of work-related injuries and illnesses",
      "establishment information",
      "total number of cases",
      "annual average number of employees",
    ],
    minimumMatches: 2,
  },
  {
    type: "osha_300",
    phrases: [
      "log of work-related injuries and illnesses",
      "case no.",
      "days away from work",
    ],
    minimumMatches: 2,
  },
  {
    type: "emr_letter",
    phrases: [
      "experience modification",
      "experience rating",
      "policy period",
      "workers compensation",
    ],
    minimumMatches: 2,
  },
  {
    type: "training_roster",
    phrases: [
      "training roster",
      "sign-in sheet",
      "instructor",
      "attendee",
      "employee signature",
    ],
    minimumMatches: 2,
  },
  {
    type: "msq_export",
    phrases: [
      "management system questionnaire",
      "msq",
      "questionnaire response",
    ],
    minimumMatches: 1,
  },
  {
    type: "license",
    phrases: ["license number", "date of expiration", "licensing authority"],
    minimumMatches: 2,
  },
  {
    type: "cert",
    phrases: ["certificate of completion", "certification number", "certifies that"],
    minimumMatches: 2,
  },
  {
    type: "program",
    phrases: [
      "purpose and scope",
      "responsibilities",
      "training",
      "review and revision",
      "safety program",
      "safety programme",
    ],
    minimumMatches: 3,
  },
];

export function classifyDocument(text: string): {
  type: DocumentType;
  confidence: number;
  matchedPhrases: string[];
} {
  const normalized = text.toLowerCase();
  const candidates = RULES.map((rule) => {
    const matchedPhrases = rule.phrases.filter((phrase) =>
      normalized.includes(phrase),
    );
    return { rule, matchedPhrases };
  })
    .filter((candidate) => candidate.matchedPhrases.length >= candidate.rule.minimumMatches)
    .sort((a, b) => b.matchedPhrases.length - a.matchedPhrases.length);

  if (
    candidates.length === 0 ||
    (candidates[1] &&
      candidates[0].matchedPhrases.length === candidates[1].matchedPhrases.length)
  ) {
    return { type: "other", confidence: 0, matchedPhrases: [] };
  }

  const best = candidates[0];
  return {
    type: best.rule.type,
    confidence: Math.min(
      1,
      best.matchedPhrases.length / best.rule.phrases.length + 0.4,
    ),
    matchedPhrases: best.matchedPhrases,
  };
}

const PROGRAM_MARKERS: Record<string, string[]> = {
  hazcom: ["hazard communication", "hazcom"],
  ppe: ["personal protective equipment", "ppe program", "ppe programme"],
  emergency_action: ["emergency action plan"],
  incident_investigation: [
    "incident reporting and investigation",
    "incident reporting & investigation",
  ],
  loto: ["lockout/tagout", "lockout tagout", "energy control program"],
  confined_space: ["confined space entry program", "confined space entry programme"],
  fall_protection: ["fall protection program", "fall protection programme"],
  respiratory: [
    "respiratory protection program",
    "respiratory protection programme",
  ],
};

export function identifyProgramKey(text: string): string | null {
  const normalized = text.toLowerCase();
  const matches = Object.entries(PROGRAM_MARKERS).filter(([, markers]) =>
    markers.some((marker) => normalized.includes(marker)),
  );
  return matches.length === 1 ? matches[0][0] : null;
}
