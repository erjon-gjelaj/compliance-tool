/**
 * Shape, options and validation for the multi-step gap-check intake.
 *
 * This is the Scope B replacement for the single-screen lead form. The
 * shape it produces is a `submissions` row (supabase/migrations/0002),
 * written a step at a time rather than all at once.
 *
 * Why a step at a time. Every step after the first is skippable, and people
 * fill this in on a phone at a job site — they get interrupted. Persisting
 * as they go means an abandoned intake is still a row with a name and an
 * email on it, which is still someone worth calling. Waiting until the end
 * would throw all of those away.
 */

import { MAX_FILES } from "@/lib/uploads";
import {
  DEFAULT_ENTRY_REASON,
  MAX_REJECTION_NOTES,
  isEntryReason,
  type EntryReason,
} from "@/lib/entry-points";

/* Trades taken from the audience described in business-model.md. Carried
 * over unchanged from the Scope A lead form, which this replaces. */
export const TRADES = [
  "Electrical",
  "Scaffolding",
  "Welding / fabrication",
  "Insulation",
  "Industrial cleaning",
  "Other",
] as const;

/** The trade option that asks for a written answer instead. */
export const OTHER_TRADE = "Other";

export const TOTAL_STEPS = 4;

export type StepNumber = 1 | 2 | 3 | 4;

/** The prequalification platform they were told to register in. */
export const PLATFORMS = [
  "ISNetworld",
  "Avetta",
  "Both",
  "Not sure",
] as const;

export const HEADCOUNT_BANDS = ["1-5", "6-10", "11-25", "26-50", "51+"] as const;

/**
 * "Don't know" is a first-class answer everywhere it appears, and is stored
 * rather than left blank. A stored "Don't know" and an empty column mean
 * different things: the first is an answer, the second is a step they never
 * reached. The analysis has to be able to tell those apart.
 */
export const DONT_KNOW = "Don't know";

export const REGISTRATION_HISTORY = [
  "Yes, we're registered now",
  "Yes, but it lapsed",
  "No, this is the first time",
  DONT_KNOW,
] as const;

/** Postal codes, so the control stays usable on a phone. */
export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL",
  "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME",
  "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
  "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
  "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
] as const;

/**
 * The checklist of written programs and records in step 3.
 *
 * TODO-VERIFY. These are the document categories a prequalification file is
 * commonly built from, written in plain language on purpose. This list is
 * NOT a statement that any of them is required of any particular contractor
 * — what a given trade owes a given hiring client is exactly the thing we
 * have not verified yet, and the answers here are only ever used as the
 * client's own account of what they hold. The authoritative version of this
 * list, by trade and platform, belongs in lib/requirements/ (task 030) and
 * needs human domain research before anything here is presented as fact.
 */
export const DOCUMENT_CATEGORIES = [
  "Written safety manual or program",
  "Hazard communication program",
  "Lockout/tagout program",
  "Confined space entry program",
  "Fall protection program",
  "Respiratory protection program",
  "Personal protective equipment program",
  "Emergency action plan",
  "Drug and alcohol policy",
  "Training records for the crew",
  "Certificate of insurance",
  "OSHA 300 / 300A logs",
] as const;

export type IntakeField =
  // Step 1
  | "entry_reason"
  | "rejection_notes"
  | "trade"
  | "trade_other"
  | "hiring_client"
  | "platform"
  | "deadline"
  | "deadline_unknown"
  | "contact_name"
  | "email"
  // Step 2
  | "headcount_band"
  | "states"
  | "emr"
  | "trir"
  | "previously_registered"
  // Step 3
  | "documents_held"
  | "documents_unsure"
  // Step 4
  | "uploads"
  | "upload_consent";

export type IntakeErrors = Partial<Record<IntakeField, string>>;

export type IntakeValues = Partial<Record<IntakeField, string | string[]>>;

/**
 * Columns written by step 1.
 *
 * Everything is required except the two Scope C additions. `entry_reason` is
 * never absent — an unrecognised one falls back to the gap check rather than
 * failing the step, because the door is our routing detail and a contractor
 * who followed a stale link should still get their answer.
 */
export type StepOneValue = {
  entry_reason: EntryReason;
  rejection_notes: string | null;
  trade: string;
  hiring_client: string;
  platform: string;
  deadline: string | null;
  deadline_unknown: boolean;
  contact_name: string;
  email: string;
};

/** Columns written by step 2. Every one of them may be absent. */
export type StepTwoValue = {
  headcount_band: string | null;
  states: string[] | null;
  emr: string | null;
  trir: string | null;
  previously_registered: string | null;
};

/** Columns written by step 3. */
export type StepThreeValue = {
  documents_held: string[];
  documents_unsure: boolean;
};

export type IntakeFormState = {
  status: "editing" | "success" | "error";
  /** Which step the form is showing. */
  step: StepNumber;
  /** Set once step 1 has been persisted; every later step updates this row. */
  submissionId?: string;
  message?: string;
  errors?: IntakeErrors;
  /** Echoed back so a rejected step doesn't wipe what was typed. */
  values?: IntakeValues;
};

export const initialIntakeState: IntakeFormState = {
  status: "editing",
  step: 1,
};

export type StepResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: IntakeErrors };

/* Same conservative shape check as the lead form: the only real proof an
 * address works is mail arriving at it. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

const MAX_HIRING_CLIENT = 200;
const MAX_EMAIL = 254;
const MAX_CONTACT_NAME = 120;
const MAX_TRADE_OTHER = 80;

/** ISO date, which is what <input type="date"> posts. */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function combineTrade(detail: string): string {
  return `${OTHER_TRADE}: ${detail}`;
}

function reader(formData: FormData) {
  return (field: IntakeField) => {
    const raw = formData.get(field);
    return typeof raw === "string" ? raw.trim() : "";
  };
}

function readList(formData: FormData, field: IntakeField): string[] {
  return formData
    .getAll(field)
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isChecked(formData: FormData, field: IntakeField): boolean {
  const raw = formData.get(field);
  return typeof raw === "string" && raw !== "" && raw !== "false";
}

/**
 * A ratio typed by hand: EMR is around 1.0, TRIR is a small number. Both are
 * optional and both accept "Don't know", so this only rejects text that
 * could not be either.
 */
function validRatio(value: string): boolean {
  return /^\d{1,3}(\.\d{1,3})?$/.test(value);
}

export function validateStepOne(formData: FormData): StepResult<StepOneValue> {
  const errors: IntakeErrors = {};
  const read = reader(formData);

  const entryReasonRaw = read("entry_reason");
  const rejectionNotes = read("rejection_notes");
  const trade = read("trade");
  const tradeOther = read("trade_other");
  const hiringClient = read("hiring_client");
  const platform = read("platform");
  const deadline = read("deadline");
  const deadlineUnknown = isChecked(formData, "deadline_unknown");
  const contactName = read("contact_name");
  const email = read("email");

  /*
   * An unrecognised door is not an error the person can fix, and it is not
   * theirs. It comes from a stale link or a hand-typed URL, and failing the
   * step over it would cost a real submission to protect a routing hint. It
   * falls back to the gap check, which is what every row before Scope C was.
   */
  const entryReason: EntryReason = isEntryReason(entryReasonRaw)
    ? entryReasonRaw
    : DEFAULT_ENTRY_REASON;

  /*
   * Deliberately optional even on the rejection door. Someone may have only a
   * screenshot or the rejected file itself, and both of those arrive at step
   * 4, long after this runs. Requiring the paste here would turn "I have the
   * document but not the wording" into a dead end. A rejection that arrives
   * with neither notes nor a file is handled where that is knowable — the
   * review says it has nothing to work from rather than inventing a reason.
   */
  if (rejectionNotes.length > MAX_REJECTION_NOTES) {
    errors.rejection_notes = `That's longer than we can take — keep it under ${MAX_REJECTION_NOTES.toLocaleString("en-US")} characters, or attach the notice itself at the last step.`;
  }

  if (!trade) {
    errors.trade = "Pick the trade you work in.";
  } else if (!TRADES.includes(trade as (typeof TRADES)[number])) {
    errors.trade = "Pick one of the listed trades.";
  } else if (trade === OTHER_TRADE) {
    // Only required once "Other" is the choice, and ignored otherwise — a
    // stale value left behind by someone who changed their mind must not
    // end up on a submission that says "Electrical".
    if (!tradeOther) {
      errors.trade_other = "Tell us which trade.";
    } else if (tradeOther.length > MAX_TRADE_OTHER) {
      errors.trade_other = `Keep this under ${MAX_TRADE_OTHER} characters.`;
    }
  }

  if (!hiringClient) {
    errors.hiring_client = "Tell us who asked you to register.";
  } else if (hiringClient.length > MAX_HIRING_CLIENT) {
    errors.hiring_client = `Keep this under ${MAX_HIRING_CLIENT} characters.`;
  }

  if (!platform) {
    errors.platform = "Pick the platform they named, or 'Not sure'.";
  } else if (!PLATFORMS.includes(platform as (typeof PLATFORMS)[number])) {
    errors.platform = "Pick one of the listed platforms.";
  }

  // A date is only required when they haven't said they don't have one.
  if (!deadlineUnknown) {
    if (!deadline) {
      errors.deadline = "Give the date, or tick that you don't know it.";
    } else if (!DATE_PATTERN.test(deadline)) {
      errors.deadline = "Use a real date, or tick that you don't know it.";
    }
  }

  if (!contactName) {
    errors.contact_name = "Tell us who you are.";
  } else if (contactName.length > MAX_CONTACT_NAME) {
    errors.contact_name = `Keep this under ${MAX_CONTACT_NAME} characters.`;
  }

  if (!email) {
    errors.email = "We need an email to send the review to.";
  } else if (email.length > MAX_EMAIL || !EMAIL_PATTERN.test(email)) {
    errors.email = "That doesn't look like a working email address.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      entry_reason: entryReason,
      /*
       * Dropped unless this actually came in through the rejection door, for
       * the same reason a stale "Other" trade detail is dropped: a paste left
       * behind by someone who changed doors must not end up attached to a
       * submission that is not about a rejection, where the review would treat
       * it as a reviewer's words.
       */
      rejection_notes:
        entryReason === "rejection" && rejectionNotes ? rejectionNotes : null,
      trade: trade === OTHER_TRADE ? combineTrade(tradeOther) : trade,
      hiring_client: hiringClient,
      platform,
      // Cleared rather than kept when they tick "don't know", so the two
      // answers can't contradict each other in the row.
      deadline: deadlineUnknown ? null : deadline,
      deadline_unknown: deadlineUnknown,
      contact_name: contactName,
      email,
    },
  };
}

export function validateStepTwo(formData: FormData): StepResult<StepTwoValue> {
  const errors: IntakeErrors = {};
  const read = reader(formData);

  const headcount = read("headcount_band");
  const states = readList(formData, "states");
  const emr = read("emr");
  const trir = read("trir");
  const history = read("previously_registered");

  // Everything on this step is optional, so an empty value is never an
  // error. Only a value that isn't one of ours, or a number that isn't a
  // number, gets rejected.
  if (
    headcount &&
    !HEADCOUNT_BANDS.includes(headcount as (typeof HEADCOUNT_BANDS)[number])
  ) {
    errors.headcount_band = "Pick one of the listed sizes.";
  }

  const unknownStates = states.filter(
    (state) => !US_STATES.includes(state as (typeof US_STATES)[number]),
  );
  if (unknownStates.length > 0) {
    errors.states = "Pick states from the list.";
  }

  if (emr && emr !== DONT_KNOW && !validRatio(emr)) {
    errors.emr = `Give the number, or leave it and tick "${DONT_KNOW}".`;
  }

  if (trir && trir !== DONT_KNOW && !validRatio(trir)) {
    errors.trir = `Give the number, or leave it and tick "${DONT_KNOW}".`;
  }

  if (
    history &&
    !REGISTRATION_HISTORY.includes(
      history as (typeof REGISTRATION_HISTORY)[number],
    )
  ) {
    errors.previously_registered = "Pick one of the listed answers.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      headcount_band: headcount || null,
      states: states.length > 0 ? states : null,
      emr: emr || null,
      trir: trir || null,
      previously_registered: history || null,
    },
  };
}

export function validateStepThree(
  formData: FormData,
): StepResult<StepThreeValue> {
  const held = readList(formData, "documents_held");
  const unsure = isChecked(formData, "documents_unsure");

  const unknown = held.filter(
    (entry) =>
      !DOCUMENT_CATEGORIES.includes(
        entry as (typeof DOCUMENT_CATEGORIES)[number],
      ),
  );

  if (unknown.length > 0) {
    return { ok: false, errors: { documents_held: "Tick items from the list." } };
  }

  return { ok: true, value: { documents_held: held, documents_unsure: unsure } };
}

/** What step 4 posts: files already in storage, plus the consent tick. */
export type StepFourValue = {
  uploads: { path: string; fileName: string }[];
  consented: boolean;
};

/**
 * Step 4 is unusual: the files are already in storage by the time this runs.
 * The browser gets a signed upload URL per file, sends the bytes straight to
 * Supabase, and posts back the paths — so what arrives here is a claim about
 * what landed, not the files themselves. confirmUploads is what checks it.
 *
 * Consent is required only when there is something to consent to. Reaching
 * this step and sending nothing is a normal, complete submission.
 */
export function validateStepFour(formData: FormData): StepResult<StepFourValue> {
  const raw = formData.get("uploads");
  const consented = isChecked(formData, "upload_consent");

  let uploads: { path: string; fileName: string }[] = [];

  if (typeof raw === "string" && raw.trim() !== "") {
    try {
      const parsed: unknown = JSON.parse(raw);

      if (!Array.isArray(parsed)) throw new Error("not an array");

      uploads = parsed.slice(0, MAX_FILES).map((entry) => {
        const record = entry as { path?: unknown; fileName?: unknown };

        if (
          typeof record.path !== "string" ||
          typeof record.fileName !== "string"
        ) {
          throw new Error("bad entry");
        }

        return {
          path: record.path,
          // Trimmed to what the file_name column accepts, so a long name
          // can't fail the insert after the file is already stored.
          fileName: record.fileName.slice(0, 255),
        };
      });
    } catch {
      return {
        ok: false,
        errors: {
          uploads: "Something went wrong with those files. Try attaching them again.",
        },
      };
    }
  }

  if (uploads.length > 0 && !consented) {
    return {
      ok: false,
      errors: {
        upload_consent:
          "Tick the box to confirm we can use these documents to prepare your review.",
      },
    };
  }

  return { ok: true, value: { uploads, consented } };
}
