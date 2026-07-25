"use server";

import {
  validateLead,
  type LeadFields,
  type LeadFormState,
  type LeadInput,
} from "@/lib/leads";
import {
  HONEYPOT_FIELD,
  validateMessage,
  type MessageFields,
  type MessageFormState,
  type MessageInput,
} from "@/lib/messages";
import { sendContactMessage, sendLeadEmails } from "@/lib/notify";
import { getSupabaseClient } from "@/lib/supabase";
import { CONTACT_EMAIL } from "@/lib/constants";

const GENERIC_FAILURE =
  "Something went wrong on our end and your request wasn't saved. " +
  "Try again in a moment, or email us and we'll pick it up by hand.";

function submittedValues(formData: FormData): Partial<LeadInput> {
  const fields: LeadFields[] = [
    "trade",
    "hiring_client",
    "employee_count",
    "email",
  ];

  return Object.fromEntries(
    fields.map((field) => {
      const raw = formData.get(field);
      return [field, typeof raw === "string" ? raw : ""];
    }),
  );
}

export async function submitLead(
  _prevState: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  const values = submittedValues(formData);
  const result = validateLead(formData);

  if (!result.ok) {
    return {
      status: "error",
      message: "Check the highlighted fields and send it again.",
      errors: result.errors,
      values,
    };
  }

  try {
    const supabase = getSupabaseClient();

    // No .select() here: the anon role has INSERT but not SELECT on this
    // table, so asking for the row back would fail the whole request.
    const { error } = await supabase.from("leads").insert(result.value);

    if (error) {
      // Logged server-side only. The visitor gets a generic message —
      // database errors can leak schema details.
      console.error("Failed to insert lead:", error.message);
      return { status: "error", message: GENERIC_FAILURE, values };
    }

    // Only after the row is safely stored, and deliberately awaited so the
    // sends aren't cut short when the serverless invocation ends. This
    // cannot throw and cannot fail the submission: a saved lead whose email
    // bounced is still a saved lead, and showing an error would only invite
    // a retry that duplicates the row.
    await sendLeadEmails(result.value);
  } catch (cause) {
    console.error("Lead submission failed:", cause);
    return { status: "error", message: GENERIC_FAILURE, values };
  }

  return { status: "success" };
}

const MESSAGE_FAILURE =
  "We couldn't get that message out to our inbox, and it hasn't been saved " +
  `anywhere — so it would be lost if we said otherwise. Email ` +
  `${CONTACT_EMAIL} directly and it'll reach the same person.`;

function submittedMessageValues(formData: FormData): Partial<MessageInput> {
  const fields: MessageFields[] = ["name", "email", "message"];

  return Object.fromEntries(
    fields.map((field) => {
      const raw = formData.get(field);
      return [field, typeof raw === "string" ? raw : ""];
    }),
  );
}

/**
 * Contact-form submission. Emails our own inbox and nothing else — there is
 * no table behind this, by design (see sendContactMessage).
 *
 * The consequence is that this action, unlike submitLead, must not report
 * success unless the mail actually left. A message shown as sent but never
 * delivered is worse than an error: the person stops waiting for a reply
 * they were owed and we never knew they wrote.
 */
export async function submitMessage(
  _prevState: MessageFormState,
  formData: FormData,
): Promise<MessageFormState> {
  const values = submittedMessageValues(formData);

  // Honeypot: hidden from people, irresistible to form-filling bots. Answered
  // with a plain success so whatever is on the other end has nothing to tune
  // against, and nothing is sent.
  const honeypot = formData.get(HONEYPOT_FIELD);
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    console.warn("Contact form honeypot tripped; message discarded.");
    return { status: "success" };
  }

  const result = validateMessage(formData);

  if (!result.ok) {
    return {
      status: "error",
      message: "Check the highlighted fields and send it again.",
      errors: result.errors,
      values,
    };
  }

  let sent = false;
  try {
    sent = await sendContactMessage(result.value);
  } catch (cause) {
    // sendContactMessage handles its own failures, so this is belt and
    // braces — but it must not throw past here and take the page down.
    console.error("Contact submission failed:", cause);
  }

  if (!sent) {
    return { status: "error", message: MESSAGE_FAILURE, values };
  }

  return { status: "success" };
}
