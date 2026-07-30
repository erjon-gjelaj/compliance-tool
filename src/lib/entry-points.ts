/**
 * The four ways someone actually arrives here.
 *
 * The product answered one question — "what is my file missing?" — and asked
 * the visitor to already know that this was their question. It is not, for
 * three people out of four. They arrive holding a rejection notice, or an
 * email from a plant telling them to register, or a request for a safety
 * manual they do not have.
 *
 * These are doors onto the same workspace, not four products. Every one of
 * them produces a `submissions` row; the door is recorded on it as
 * `entry_reason`, which is what lets the review, the email and the dashboard
 * lead with the thing that person came for. Nothing downstream branches on
 * anything else.
 *
 * The `slug` values are written into the database, so they are a stable
 * contract — see supabase/migrations/0005. Renaming one means a migration,
 * not an edit here.
 */

export const ENTRY_REASONS = [
  "rejection",
  "setup",
  "gap_check",
  "documents",
] as const;

export type EntryReason = (typeof ENTRY_REASONS)[number];

/** What a submission with no door recorded is treated as. */
export const DEFAULT_ENTRY_REASON: EntryReason = "gap_check";

export type EntryPoint = {
  reason: EntryReason;
  /** The path this door lives at. */
  href: string;
  /** The customer's problem, in their words rather than ours. */
  headline: string;
  /** One line on what happens next. Not a promise about the outcome. */
  detail: string;
  /** Label on the control that opens it. */
  action: string;
};

/**
 * Ordered by urgency rather than by how common they are. A rejection has a
 * client already waiting on an answer, so it goes first; someone browsing to
 * see what they hold can wait.
 */
export const ENTRY_POINTS: EntryPoint[] = [
  {
    reason: "rejection",
    href: "/rejection",
    headline: "A document of mine was rejected",
    detail:
      "Paste what the reviewer sent back and attach the document they turned down. You get an explanation of what appears to be missing from it and what to send instead.",
    action: "Sort out a rejection",
  },
  {
    reason: "setup",
    href: "/setup",
    headline: "A client told me to join ISNetworld or Avetta",
    detail:
      "Start from the platform and the client asking. You get the list of what a file for your trade is normally built from, and where yours currently stands.",
    action: "Start a registration",
  },
  {
    reason: "gap_check",
    href: "/#gap-check",
    headline: "I don't know what I'm missing",
    detail:
      "Attach whatever you already have. You get back what looks present, what looks missing, and what needs confirming with your hiring client.",
    action: "Check what I have",
  },
  {
    reason: "documents",
    href: "/documents",
    headline: "I need a safety manual or a written program",
    detail:
      "Find out which programs are missing, then prepare a supported program automatically from a short company-specific questionnaire.",
    action: "Prepare a program",
  },
];

export function entryPointFor(reason: EntryReason): EntryPoint {
  const found = ENTRY_POINTS.find((point) => point.reason === reason);

  // Unreachable through the type, but ENTRY_POINTS is hand-edited data and a
  // missing door should not render a blank page.
  if (!found) throw new Error(`No entry point defined for "${reason}"`);

  return found;
}

export function isEntryReason(value: unknown): value is EntryReason {
  return (
    typeof value === "string" &&
    (ENTRY_REASONS as readonly string[]).includes(value)
  );
}

/**
 * How long a pasted rejection notice may be.
 *
 * Generous, because the useful case is someone selecting the whole reviewer
 * comment block out of a portal and pasting it without editing. The database
 * enforces the same limit, since this arrives from a public form.
 */
export const MAX_REJECTION_NOTES = 5000;
