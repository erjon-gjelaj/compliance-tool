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

export type LeadFields = "trade" | "hiring_client" | "employee_count" | "email";

export type LeadInput = Record<LeadFields, string>;

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
  /** Echoed back so a failed submission doesn't wipe what was typed. */
  values?: Partial<LeadInput>;
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
  const hiring_client = read("hiring_client");
  const employee_count = read("employee_count");
  const email = read("email");

  // Both dropdowns are checked against the allow-list rather than just
  // tested for emptiness, so the stored values stay consistent.
  if (!trade) {
    errors.trade = "Pick the trade you work in.";
  } else if (!TRADES.includes(trade as (typeof TRADES)[number])) {
    errors.trade = "Pick one of the listed trades.";
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

  return { ok: true, value: { trade, hiring_client, employee_count, email } };
}
