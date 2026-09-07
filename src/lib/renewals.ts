import type { DocumentWithVersions, VersionRow } from "@/lib/programs/store";

/**
 * When a program is due to be looked at again.
 *
 * ## Only dates we were given
 *
 * That rule is the whole design of this module, and it is narrower than it
 * sounds. This product does not know when a contractor's insurance lapses,
 * when a welder's ticket runs out, or when a hiring client will next ask for
 * something — and a renewal date invented for any of those would be worse
 * than no date at all, because a contractor would plan around it.
 *
 * There is exactly one date here that is not a guess. Every program this
 * product issues says, in its own closing section, that it is reviewed at
 * least annually. That is not our claim about the law or about their
 * obligations; it is the commitment the company adopted when it issued the
 * document, printed on the page with an effective date beside it. So the
 * review date is the document's own promise plus the date it was issued,
 * which is a fact we hold rather than a rule we are asserting.
 *
 * Everything else a maintenance service covers — certificates, training,
 * client-specific demands — stays out until somebody tells us the date. When
 * that arrives it belongs in storage next to the thing it describes, not in
 * a calculation here.
 *
 * ## Superseded versions have no due date
 *
 * A revision restarts the year. Version 2 issued in March supersedes version
 * 1 from the previous June, and the June date is no longer anybody's
 * business: the contractor is working to version 2, and showing them a
 * review overdue on a document they replaced is how a renewal list teaches
 * people to ignore it.
 */

/** How long the programs themselves say they run before another look. */
export const REVIEW_INTERVAL_MONTHS = 12;

/**
 * How close counts as due soon.
 *
 * Six weeks, because a review is a conversation and a document reissue rather
 * than a form to sign, and a week's notice is not notice. Short enough that
 * the list stays worth reading — half the library showing amber says nothing.
 */
export const DUE_SOON_DAYS = 42;

export type RenewalStatus = "current" | "due_soon" | "overdue";

export type Renewal = {
  documentId: string;
  programId: string;
  /** The version the date was computed from. Always the live one. */
  version: number;
  /** The date printed on that version. */
  effectiveDate: string;
  /** One year later, which is what the document commits to. */
  reviewDue: string;
  daysUntilDue: number;
  status: RenewalStatus;
};

/**
 * Adds months without the end-of-month bug.
 *
 * `setMonth` on the 31st of a 31-day month lands in the following month —
 * 31 January plus one month is 3 March. Anniversaries are always the same day
 * a year later here, so this only bites on a leap day, and clamping is still
 * the right answer for it: 29 February 2024 reviews on 28 February 2025
 * rather than drifting into March.
 */
function addMonths(date: Date, months: number): Date {
  const day = date.getUTCDate();
  const shifted = new Date(date);

  shifted.setUTCDate(1);
  shifted.setUTCMonth(shifted.getUTCMonth() + months);

  const lastDay = new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0),
  ).getUTCDate();

  shifted.setUTCDate(Math.min(day, lastDay));
  return shifted;
}

const DAY = 24 * 60 * 60 * 1000;

/** Midnight UTC on the day a date falls, so a comparison is whole days. */
function startOfDay(value: Date): number {
  return Date.UTC(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate(),
  );
}

/**
 * The renewal for one live version, or null when there is nothing to say.
 *
 * Null rather than a guessed date in every case where the input does not
 * carry one: no live version, no effective date, or a date that does not
 * parse. A renewal list that quietly invents entries is worse than an empty
 * one, because an empty one is obviously empty.
 */
export function renewalFor(
  document: Pick<DocumentWithVersions, "id" | "program_id" | "current">,
  today: Date = new Date(),
): Renewal | null {
  const version: VersionRow | null = document.current;

  // A superseded version is not the one they are working to. See the note at
  // the top: a revision restarts the year.
  if (!version || version.superseded_at) return null;
  if (!version.effective_date) return null;

  const effective = new Date(`${version.effective_date}T00:00:00Z`);
  if (Number.isNaN(effective.getTime())) return null;

  const due = addMonths(effective, REVIEW_INTERVAL_MONTHS);
  const daysUntilDue = Math.round((startOfDay(due) - startOfDay(today)) / DAY);

  const status: RenewalStatus =
    daysUntilDue < 0
      ? "overdue"
      : daysUntilDue <= DUE_SOON_DAYS
        ? "due_soon"
        : "current";

  return {
    documentId: document.id,
    programId: document.program_id,
    version: version.version,
    effectiveDate: version.effective_date,
    reviewDue: due.toISOString().slice(0, 10),
    daysUntilDue,
    status,
  };
}

/** Every renewal that can be derived, soonest first. */
export function renewalsFor(
  documents: DocumentWithVersions[],
  today: Date = new Date(),
): Renewal[] {
  return documents
    .map((document) => renewalFor(document, today))
    .filter((entry): entry is Renewal => entry !== null)
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

/** The ones worth saying something about. Current documents are not news. */
export function needingAttention(renewals: Renewal[]): Renewal[] {
  return renewals.filter((entry) => entry.status !== "current");
}

/**
 * How to say it, in the customer's terms rather than in days.
 *
 * "Due in 41 days" is arithmetic somebody has to do something with. "Due next
 * month" is a decision they can make while reading it.
 */
export function describeDue(renewal: Renewal): string {
  const { daysUntilDue } = renewal;

  if (daysUntilDue < 0) {
    const overdue = Math.abs(daysUntilDue);
    if (overdue === 1) return "Review was due yesterday";
    if (overdue < 31) return `Review was due ${overdue} days ago`;
    const months = Math.round(overdue / 30);
    return `Review was due about ${months} ${months === 1 ? "month" : "months"} ago`;
  }

  if (daysUntilDue === 0) return "Review is due today";
  if (daysUntilDue === 1) return "Review is due tomorrow";
  if (daysUntilDue <= DUE_SOON_DAYS) return `Review is due in ${daysUntilDue} days`;

  return `Reviewed again by ${renewal.reviewDue}`;
}
