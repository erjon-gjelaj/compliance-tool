"use server";

import {
  validateLead,
  type LeadFields,
  type LeadFormState,
  type LeadInput,
} from "@/lib/leads";
import { sendLeadEmails } from "@/lib/notify";
import { getSupabaseClient } from "@/lib/supabase";

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
