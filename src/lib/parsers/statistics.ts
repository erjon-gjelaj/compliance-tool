export type RateInputs = {
  hoursWorked: number;
  recordableIncidents: number;
  dartCases: number;
  lostTimeCases: number;
};

export type SafetyRates = {
  trir: number;
  dart: number;
  ltir: number;
};

function validNonnegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function calculateSafetyRates(input: RateInputs): SafetyRates {
  if (!Number.isFinite(input.hoursWorked) || input.hoursWorked <= 0) {
    throw new Error("Hours worked must be greater than zero.");
  }
  if (
    !validNonnegative(input.recordableIncidents) ||
    !validNonnegative(input.dartCases) ||
    !validNonnegative(input.lostTimeCases)
  ) {
    throw new Error("Case counts must be nonnegative numbers.");
  }
  const rate = (cases: number) => (cases * 200_000) / input.hoursWorked;
  return {
    trir: rate(input.recordableIncidents),
    dart: rate(input.dartCases),
    ltir: rate(input.lostTimeCases),
  };
}

export type Reconciliation = {
  field: keyof SafetyRates;
  derived: number;
  reported: number | null;
  state: "match" | "mismatch" | "unknown";
};

export function reconcileSafetyRates(
  derived: SafetyRates,
  reported: Partial<SafetyRates>,
  tolerance = 0.005,
): Reconciliation[] {
  return (["trir", "dart", "ltir"] as const).map((field) => {
    const value = reported[field];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return { field, derived: derived[field], reported: null, state: "unknown" };
    }
    return {
      field,
      derived: derived[field],
      reported: value,
      state:
        Math.abs(value - derived[field]) <= tolerance ? "match" : "mismatch",
    };
  });
}

export type Parsed300A = {
  year: number | null;
  hoursWorked: number | null;
  recordableIncidents: number | null;
  dartCases: number | null;
  lostTimeCases: number | null;
  evidence: Record<string, { page: number; snippet: string }>;
};

function numberNear(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = Number(match[1].replace(/,/g, ""));
      if (Number.isFinite(value)) return value;
    }
  }
  return null;
}

export function parse300A(
  pages: Array<{ page: number; text: string }>,
): Parsed300A {
  const output: Parsed300A = {
    year: null,
    hoursWorked: null,
    recordableIncidents: null,
    dartCases: null,
    lostTimeCases: null,
    evidence: {},
  };
  for (const page of pages) {
    const text = page.text.replace(/\s+/g, " ");
    output.year ??= numberNear(text, [/\b(?:year|calendar year)\s*:?\s*(20\d{2})\b/i]);
    output.hoursWorked ??= numberNear(text, [
      /total hours worked by all employees[^0-9]*([\d,]+)/i,
    ]);
    output.recordableIncidents ??= numberNear(text, [
      /total number of cases[^0-9]*([\d,]+)/i,
      /total recordable cases[^0-9]*([\d,]+)/i,
    ]);
    output.dartCases ??= numberNear(text, [
      /days away.*restricted.*transfer[^0-9]*([\d,]+)/i,
      /dart cases[^0-9]*([\d,]+)/i,
    ]);
    output.lostTimeCases ??= numberNear(text, [
      /cases with days away from work[^0-9]*([\d,]+)/i,
      /lost time cases[^0-9]*([\d,]+)/i,
    ]);
  }
  return output;
}
