export type TrainingRecord = {
  programKey: string | null;
  date: string | null;
  instructorName: string | null;
  instructorSignature: boolean | null;
  attendees: string[];
  source: "toolbox_talk" | "formal" | "vendor" | null;
  page: number;
  confidence: number;
};

export function parseTrainingRoster(
  pages: Array<{ page: number; text: string; confidence: number }>,
): TrainingRecord[] {
  return pages.flatMap((page) => {
    const text = page.text.replace(/\s+/g, " ").trim();
    if (!/training roster|sign-in sheet|toolbox talk/i.test(text)) return [];
    const date =
      text.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1] ??
      text.match(/\b(\d{1,2}\/\d{1,2}\/20\d{2})\b/)?.[1] ??
      null;
    const instructor =
      text.match(/instructor(?: name)?\s*:?\s*([a-z][a-z .'-]{2,60})/i)?.[1]
        ?.trim() ?? null;
    return [
      {
        programKey: null,
        date,
        instructorName: instructor,
        instructorSignature: /instructor signature\s*:?\s*\S+/i.test(text)
          ? true
          : null,
        attendees: [],
        source: /toolbox talk/i.test(text) ? ("toolbox_talk" as const) : null,
        page: page.page,
        confidence: page.confidence,
      },
    ];
  });
}
