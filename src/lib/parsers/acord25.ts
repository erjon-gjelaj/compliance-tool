export type CoverageType =
  | "GL"
  | "WC"
  | "AUTO"
  | "UMBRELLA"
  | "POLLUTION"
  | "PROFESSIONAL";

export type Coverage = {
  type: CoverageType;
  carrier: string | null;
  policyNumber: string | null;
  effDate: string | null;
  expDate: string | null;
  eachOccurrence: number | null;
  generalAggregate: number | null;
  productsCompOp: number | null;
  additionalInsured: boolean | null;
  waiverOfSubrogation: boolean | null;
  primaryNoncontributory: boolean | null;
  noticeOfCancellationDays: number | null;
  page: number;
  snippet: string;
};

const TYPE_MARKERS: Array<[CoverageType, RegExp]> = [
  ["GL", /commercial general liability|general liability/i],
  ["WC", /workers'? compensation/i],
  ["AUTO", /automobile liability|auto liability/i],
  ["UMBRELLA", /umbrella liab|excess liab/i],
  ["POLLUTION", /pollution liability/i],
  ["PROFESSIONAL", /professional liability/i],
];

function money(text: string, label: RegExp): number | null {
  const match = text.match(
    new RegExp(`${label.source}[^$\\d]{0,30}\\$?\\s*([\\d,]+)`, "i"),
  );
  return match ? Number(match[1].replace(/,/g, "")) : null;
}

export function parseAcord25(
  pages: Array<{ page: number; text: string }>,
): Coverage[] {
  return pages.flatMap((page) => {
    const normalized = page.text.replace(/\s+/g, " ");
    return TYPE_MARKERS.flatMap(([type, marker]) => {
      if (!marker.test(normalized)) return [];
      const policy =
        normalized.match(/policy number[^a-z0-9]*([a-z0-9-]+)/i)?.[1] ?? null;
      return [
        {
          type,
          carrier: null,
          policyNumber: policy,
          effDate: null,
          expDate: null,
          eachOccurrence: money(normalized, /each occurrence/),
          generalAggregate: money(normalized, /general aggregate/),
          productsCompOp: money(normalized, /products[- ]comp\/op agg/),
          additionalInsured: /addl insr|additional insured/i.test(normalized)
            ? true
            : null,
          waiverOfSubrogation: /subr wvd|waiver of subrogation/i.test(normalized)
            ? true
            : null,
          primaryNoncontributory: /primary and noncontributory/i.test(normalized)
            ? true
            : null,
          noticeOfCancellationDays:
            numberNear(normalized, /(\d+)\s+days[^.]{0,80}cancellation/i),
          page: page.page,
          snippet: normalized.slice(0, 500),
        },
      ];
    });
  });
}

function numberNear(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern);
  return match ? Number(match[1]) : null;
}

export function insuranceAgentSentence({
  clientName,
  gaps,
}: {
  clientName: string;
  gaps: string[];
}): string {
  return gaps.length === 0
    ? `Please confirm in writing that the attached certificate meets the requirements supplied by ${clientName}.`
    : `Please revise the certificate for ${clientName} to address: ${gaps.join("; ")}.`;
}
