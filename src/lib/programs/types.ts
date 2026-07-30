/**
 * The document generation model.
 *
 * How this stays inside the project's rules, stated once here because it is
 * the thing a reader will reasonably ask about:
 *
 * **No language model runs.** The programme prose is written into this repo
 * by hand and assembled deterministically from the customer's answers. The
 * same answers produce a byte-identical document twice. Nothing is generated
 * at request time; sections are selected and fields substituted, which is a
 * different act from writing.
 *
 * **The prose is company policy, not a claim about law.** A safety programme
 * is a statement of what a company does — the company adopts it and is bound
 * by it. So the text says "the Company maintains…", never "OSHA requires you
 * to…". Where a section exists because a regulation calls for that element,
 * the mapping is recorded in `sourceRef` for our own maintenance and is not
 * printed as an assertion about the customer's legal position.
 *
 * **Company facts come only from confirmed answers.** Any field that would
 * assert something about the customer — who is responsible, where the sheets
 * are kept, whether they work at multi-employer sites — is answered by them
 * before the document is produced. There is no default that invents one, and
 * the validator refuses to emit a file containing an unresolved placeholder.
 */

/**
 * How far a programme has got. Internal only — a customer never sees these.
 *
 * The point of the ladder is that "we have written the template" and "a
 * customer may download this" are separate decisions. A programme sitting in
 * `internal_testing` is fully built and simply not offered yet.
 */
export const RELEASE_STATES = [
  "development",
  "internal_testing",
  "release_candidate",
  "customer_available",
  "paused",
] as const;

export type ReleaseState = (typeof RELEASE_STATES)[number];

/** Whether an ordinary signed-in customer may generate this. */
export function isOfferable(state: ReleaseState): boolean {
  return state === "customer_available";
}

/**
 * Whether it can be exercised by an operator for testing.
 *
 * `paused` is excluded deliberately: pausing is what you do when something is
 * wrong with a programme, and the person pausing it should not have to
 * remember that internal routes bypass their decision.
 */
export function isTestable(state: ReleaseState): boolean {
  return state !== "paused";
}

/* ------------------------------------------------------------------ */
/* Questions                                                           */
/* ------------------------------------------------------------------ */

export type QuestionKind = "choice" | "boolean" | "text";

export type Question = {
  id: string;
  /** Asked in operational language. No regulatory terminology. */
  prompt: string;
  /** One line under the prompt, only where the question is not self-evident. */
  help?: string;
  kind: QuestionKind;
  /** For `choice`. The stored value is the id; the label is what they read. */
  options?: { id: string; label: string }[];
  /**
   * Whether an answer is needed before a final document can be produced.
   *
   * Almost everything is required, because the alternative to an answer is a
   * placeholder in a finished document, which this product does not ship.
   * Optional questions are ones whose absence removes a section rather than
   * leaving a hole in one.
   */
  required: boolean;
  /**
   * Only asked when this returns true. Keeps the visible question count down:
   * nobody who says they do not work at multi-employer sites is asked how they
   * exchange information at them.
   */
  showWhen?: (answers: Answers) => boolean;
  /** Skipped entirely when the profile already answers it. */
  prefill?: (context: CompanyContext) => string | undefined;
};

export type Answers = Record<string, string>;

/** What we already know, so the questionnaire does not ask it again. */
export type CompanyContext = {
  companyName: string;
  trade: string | null;
  headcountBand: string | null;
  operatingStates: string[] | null;
  platforms: string | null;
  hiringClients: string[] | null;
  operations: string | null;
  logoUrl: string | null;
  /** Consultancy name printed on exports for managed workspaces. */
  preparedBy?: string | null;
};

/* ------------------------------------------------------------------ */
/* Document structure                                                  */
/* ------------------------------------------------------------------ */

/**
 * A block inside a section. Kept structural rather than as a markup string so
 * the DOCX and PDF writers render from the same tree and cannot drift.
 */
export type Block =
  | { type: "paragraph"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "numbered"; items: string[] }
  | { type: "table"; head: string[]; rows: string[][] };

export type Section = {
  /** Printed as "1.", "2." … Numbering is applied at render time. */
  heading: string;
  blocks: Block[];
  /**
   * Which requirement this section exists to satisfy, for our maintenance
   * only. Never rendered — see the note at the top of this file.
   */
  sourceRef?: string;
  /** Omitted entirely when this returns false. */
  appliesWhen?: (answers: Answers, context: CompanyContext) => boolean;
};

export type ProgramTemplate = {
  id: string;
  /** The document's own title, as it appears on the cover. */
  title: string;
  /** Short name for lists and buttons. */
  shortName: string;
  /** Which requirement id in lib/requirements this satisfies, if any. */
  requirementId?: string;
  release: ReleaseState;
  /**
   * Bumped whenever the prose or structure changes. Stored on every document
   * produced, so it is always possible to say which edition a customer holds
   * and which of them need regenerating after a correction.
   */
  templateVersion: string;
  /**
   * Whether a review finding refers to this programme.
   *
   * Matched on the requirement's label because that is what a stored review
   * carries. Exact rather than fuzzy, since offering to prepare the wrong
   * programme is worse than offering nothing.
   */
  matchesLabel?: (label: string) => boolean;
  questions: Question[];
  build: (answers: Answers, context: CompanyContext) => Section[];
};
