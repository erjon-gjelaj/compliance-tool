/**
 * Shared shape and validation for the contact form.
 *
 * Deliberately separate from leads.ts. A gap check is a structured request
 * with four known answers that get stored and worked from; this is an open
 * message that only needs to reach a person. Merging them would mean one
 * validator carrying two sets of rules and one email builder guessing which
 * kind of thing it was handed.
 */

export type MessageFields = "name" | "email" | "message";

export type MessageInput = Record<MessageFields, string>;

/**
 * Result of a submission attempt, rendered by the form. Lives here rather
 * than beside the action because a "use server" module may only export async
 * functions — exporting the initial state object from there is a runtime
 * error.
 */
export type MessageFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Partial<Record<MessageFields, string>>;
  /** Echoed back so a failed submission doesn't wipe what was typed. */
  values?: Partial<MessageInput>;
};

export const initialMessageFormState: MessageFormState = { status: "idle" };

export type MessageValidation =
  | { ok: true; value: MessageInput }
  | { ok: false; errors: Partial<Record<MessageFields, string>> };

/**
 * Same conservative pattern as the gap-check form: only checks the shape of
 * an address, since the only real proof an address works is mail arriving
 * at it.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

const MAX_NAME = 100;
const MAX_EMAIL = 254;
const MIN_MESSAGE = 10;
const MAX_MESSAGE = 4000;

/**
 * The hidden field bots fill in and people never see. Named like something
 * worth completing rather than "honeypot", and checked by the action.
 */
export const HONEYPOT_FIELD = "company_website";

/**
 * Validates a submitted message. Runs on the server — the browser's own
 * required/maxlength checks are a convenience, not a guarantee, since anyone
 * can post to the action directly.
 */
export function validateMessage(formData: FormData): MessageValidation {
  const errors: Partial<Record<MessageFields, string>> = {};

  const read = (field: MessageFields) => {
    const raw = formData.get(field);
    return typeof raw === "string" ? raw.trim() : "";
  };

  const name = read("name");
  const email = read("email");
  const message = read("message");

  if (!name) {
    errors.name = "Tell us who we're replying to.";
  } else if (name.length > MAX_NAME) {
    errors.name = `Keep this under ${MAX_NAME} characters.`;
  }

  if (!email) {
    errors.email = "We need an email to reply to.";
  } else if (email.length > MAX_EMAIL || !EMAIL_PATTERN.test(email)) {
    errors.email = "That doesn't look like a working email address.";
  }

  if (!message) {
    errors.message = "Add a message so we know what you need.";
  } else if (message.length < MIN_MESSAGE) {
    errors.message = "A little more detail would help.";
  } else if (message.length > MAX_MESSAGE) {
    errors.message = `Keep this under ${MAX_MESSAGE} characters — email us directly if you need more room.`;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: { name, email, message } };
}
