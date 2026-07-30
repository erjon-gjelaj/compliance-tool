import { ELEMENT_SETS, programConfigByKey } from "@/lib/config";
import type { ElementResult } from "@/lib/programs/element-scoring";

export type AnswerKeyItem = {
  questionId: string;
  questionText: string;
  answer: "yes" | "no";
  pageRange: string | null;
  confidence: number;
  snippet: string | null;
};

function ranges(pages: number[]): string | null {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const result: string[] = [];
  let start = sorted[0];
  let previous = sorted[0];

  for (const page of sorted.slice(1)) {
    if (page === previous + 1) {
      previous = page;
      continue;
    }
    result.push(start === previous ? `${start}` : `${start}-${previous}`);
    start = page;
    previous = page;
  }
  result.push(start === previous ? `${start}` : `${start}-${previous}`);
  return result.join(", ");
}

export function generateAnswerKey({
  programKey,
  elementResults,
}: {
  programKey: string;
  elementResults: ElementResult[];
}): {
  questionVersion: string;
  verificationState: "unknown";
  items: AnswerKeyItem[];
} {
  const program = programConfigByKey(programKey);
  if (!program) throw new Error(`Unknown program ${programKey}`);

  const configuredElements = program.required_element_set_keys.flatMap(
    (setKey) =>
      ELEMENT_SETS.find((entry) => entry.element_set_key === setKey)?.elements ??
      [],
  );

  const items = configuredElements.map((element) => {
    const matches = elementResults.filter(
      (result) => result.elementKey === element.element_key,
    );
    const present = matches.some((result) => result.state === "present");
    const pages = matches.flatMap((result) =>
      result.page === null ? [] : [result.page],
    );
    const confidence =
      matches.length === 0
        ? 0
        : Math.max(...matches.map((result) => result.confidence));

    return {
      questionId: `${program.program_key}.${element.element_key}`,
      questionText: `Does the program include ${element.title.toLowerCase()}?`,
      answer: present ? ("yes" as const) : ("no" as const),
      pageRange: ranges(pages),
      confidence,
      snippet: matches.find((result) => result.snippet)?.snippet ?? null,
    };
  });

  return {
    questionVersion: "approximate-elements-1.0.0",
    verificationState: "unknown",
    items,
  };
}
