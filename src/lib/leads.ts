/** Shared shape and validation for free gap-check requests. */

/* Trades taken from the audience described in business-model.md. */
export const TRADES = [
  "Electrical",
  "Scaffolding",
  "Welding / fabrication",
  "Insulation",
  "Industrial cleaning",
  "Other",
] as const;

export const CREW_SIZES = ["1-5", "6-10", "11-25", "26-50", "51+"] as const;

/** The trade option that asks for a written answer instead. */
export const OTHER_TRADE = "Other";

/**
 * Form fields, which are not the same as table columns: trade_other only
 * exists on the form. Picking "Other" and typing "Rigging" is stored as the
 * single trade "Other: Rigging".
 *
 * Folding it into the existing column rather than adding one is deliberate.
 * A new column means a migration somebody has to run in the SQL editor by
 * hand, and until they did, every insert would name a column the table
 * doesn't have — breaking lead capture entirely on deploy. The trade column
 * is plain text with a 1-100 character check and no allow-list, so a
 * combined value is already valid there.
 */
export type LeadFields =
  | "trade"
  | "trade_other"
  | "hiring_client"
  | "employee_count"
  | "email";

/** A row of the leads table. Deliberately narrower than LeadFields. */
export type LeadInput = {
  trade: string;
  hiring_client: string;
  employee_count: string;
  email: string;
};

/**
 * Result of a submission attempt, rendered by the form.
 *
 * This lives here rather than beside the action because a "use server"
 * module may only export async functions — exporting the initial state
 * object from there is a runtime error.
 */
export type LeadFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Partial<Record<LeadFields, string>>;
  /**
   * Echoed back so a failed submission doesn't wipe what was typed. Keyed by
   * form field rather than by column, so the written-in trade survives too.
   */
  values?: Partial<Record<LeadFields, string>>;
};

export const initialLeadFormState: LeadFormState = { status: "idle" };

export type ValidationResult =
  | { ok: true; value: LeadInput }
  | { ok: false; errors: Partial<Record<LeadFields, string>> };

/**
 * Deliberately conservative: only checks the shape of an address, since
 * the only real proof an address works is mail arriving at it.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

const MAX_HIRING_CLIENT = 200;
const MAX_EMAIL = 254;

/*
 * Kept well under the table's 100-character cap on trade, because the stored
 * value is "Other: " plus this. 80 leaves room the database check would
 * otherwise reject as a failed insert rather than a field error.
 */
const MAX_TRADE_OTHER = 80;

/** How a written-in trade is stored, so it stays readable in the table. */
function combineTrade(detail: string): string {
  return `${OTHER_TRADE}: ${detail}`;
}

/**
 * Validates a submitted form. Runs on the server — the browser's own
 * required/type checks are a convenience, not a guarantee, since anyone
 * can post to the action directly.
 */
export function validateLead(formData: FormData): ValidationResult {
  const errors: Partial<Record<LeadFields, string>> = {};

  const read = (field: LeadFields) => {
    const raw = formData.get(field);
    return typeof raw === "string" ? raw.trim() : "";
  };

  const trade = read("trade");
  const trade_other = read("trade_other");
  const hiring_client = read("hiring_client");
  const employee_count = read("employee_count");
  const email = read("email");

  // Both dropdowns are checked against the allow-list rather than just
  // tested for emptiness, so the stored values stay consistent.
  if (!trade) {
    errors.trade = "Pick the trade you work in.";
  } else if (!TRADES.includes(trade as (typeof TRADES)[number])) {
    errors.trade = "Pick one of the listed trades.";
  } else if (trade === OTHER_TRADE) {
    // The written-in trade is only required once "Other" is the choice, and
    // is ignored otherwise — a stale value left in the field by someone who
    // changed their mind must not end up on a lead that says "Electrical".
    if (!trade_other) {
      errors.trade_other = "Tell us which trade.";
    } else if (trade_other.length > MAX_TRADE_OTHER) {
      errors.trade_other = `Keep this under ${MAX_TRADE_OTHER} characters.`;
    }
  }

  if (!employee_count) {
    errors.employee_count = "Pick roughly how many people you run.";
  } else if (
    !CREW_SIZES.includes(employee_count as (typeof CREW_SIZES)[number])
  ) {
    errors.employee_count = "Pick one of the listed crew sizes.";
  }

  if (!hiring_client) {
    errors.hiring_client = "Tell us who asked you to register.";
  } else if (hiring_client.length > MAX_HIRING_CLIENT) {
    errors.hiring_client = `Keep this under ${MAX_HIRING_CLIENT} characters.`;
  }

  if (!email) {
    errors.email = "We need an email to send the list to.";
  } else if (email.length > MAX_EMAIL || !EMAIL_PATTERN.test(email)) {
    errors.email = "That doesn't look like a working email address.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      trade: trade === OTHER_TRADE ? combineTrade(trade_other) : trade,
      hiring_client,
      employee_count,
      email,
    },
  };
}
