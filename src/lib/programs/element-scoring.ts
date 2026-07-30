import {
  CONFIG_RELEASE,
  ELEMENT_SETS,
  programConfigByKey,
} from "@/lib/config";
import type { PageExtraction } from "@/lib/extract";

export type ElementState = "present" | "weak" | "missing";

export type ElementResult = {
  elementKey: string;
  title: string;
  state: ElementState;
  page: number | null;
  confidence: number;
  snippet: string | null;
  basis: string;
};

const STOP_WORDS = new Set([
  "and",
  "are",
  "for",
  "from",
  "included",
  "is",
  "the",
  "this",
  "with",
]);

function words(value: string): string[] {
  return value
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((word) => word.length > 2 && !STOP_WORDS.has(word)) ?? [];
}

function snippet(text: string, at: number, length: number): string {
  const start = Math.max(0, at - 90);
  const end = Math.min(text.length, at + length + 150);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

export function scoreProgramElements({
  programKey,
  pageMap,
  generatedEvidence = {},
}: {
  programKey: string;
  pageMap: PageExtraction[];
  generatedEvidence?: Record<string, { page: number; snippet?: string }>;
}): {
  configRelease: string;
  evaluatorVersion: string;
  programKey: string;
  results: ElementResult[];
} {
  const program = programConfigByKey(programKey);
  if (!program) throw new Error(`Unknown program ${programKey}`);

  const sets = program.required_element_set_keys.map((setKey) => {
    const set = ELEMENT_SETS.find((entry) => entry.element_set_key === setKey);
    if (!set) throw new Error(`Unknown element set ${setKey}`);
    return set;
  });

  const results = sets.flatMap((set) =>
    set.elements.map((element): ElementResult => {
      const generated = generatedEvidence[element.element_key];
      if (generated) {
        return {
          elementKey: element.element_key,
          title: element.title,
          state: "present",
          page: generated.page,
          confidence: 1,
          snippet: generated.snippet ?? null,
          basis: "Emitted by the renderer for this exact generated draft.",
        };
      }

      const exact = element.title.toLowerCase();
      for (const page of pageMap) {
        const normalized = page.text.toLowerCase();
        const at = normalized.indexOf(exact);
        if (at !== -1) {
          return {
            elementKey: element.element_key,
            title: element.title,
            state: page.reviewRequired ? "weak" : "present",
            page: page.page,
            confidence: page.confidence,
            snippet: snippet(page.text, at, exact.length),
            basis: page.reviewRequired
              ? "The heading was found on a low-confidence OCR page."
              : "The configured element heading was found on this page.",
          };
        }
      }

      const expectedWords = [
        ...new Set(
          words(`${element.title} ${element.evidence_description}`),
        ),
      ];
      let best:
        | { page: PageExtraction; matched: number; firstAt: number }
        | undefined;

      for (const page of pageMap) {
        const normalized = page.text.toLowerCase();
        const positions = expectedWords
          .map((word) => normalized.indexOf(word))
          .filter((at) => at !== -1);
        if (!best || positions.length > best.matched) {
          best = {
            page,
            matched: positions.length,
            firstAt: positions[0] ?? 0,
          };
        }
      }

      if (best && best.matched >= Math.min(3, expectedWords.length)) {
        return {
          elementKey: element.element_key,
          title: element.title,
          state: "weak",
          page: best.page.page,
          confidence: Math.min(best.page.confidence, 0.65),
          snippet: snippet(best.page.text, best.firstAt, 1),
          basis:
            "Related configured terms were found, but not enough evidence for present.",
        };
      }

      const reliable = pageMap.every(
        (page) => page.method === "text" && !page.reviewRequired,
      );
      return {
        elementKey: element.element_key,
        title: element.title,
        state: reliable ? "missing" : "weak",
        page: null,
        confidence: reliable ? 0.75 : 0.25,
        snippet: null,
        basis: reliable
          ? "No configured evidence was found in reliably extracted text."
          : "OCR evidence is not reliable enough to support an absence finding.",
      };
    }),
  );

  return {
    configRelease: CONFIG_RELEASE,
    evaluatorVersion: "1.0.0",
    programKey: program.program_key,
    results,
  };
}
