"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { currentClient } from "@/lib/auth/session";
import { getCompanyForEmail } from "@/lib/companies";
import { recordServiceRequest } from "@/lib/service-requests";
import { MAX_SERVICE_NOTE, isServiceKind } from "@/lib/service-kinds";
import { notifyServiceRequest } from "@/lib/notify";

export type HelpState = {
  status: "editing" | "sent";
  error?: string;
};

/**
 * Asking for work that a person does by hand.
 *
 * Written against the signed-in address, never one from the form. The reply
 * goes to that address, so accepting a posted one would let somebody direct
 * our answer about a stranger's file to themselves.
 */
export async function requestHelp(
  _previous: HelpState,
  formData: FormData,
): Promise<HelpState> {
  const session = await currentClient();
  if (!session) redirect("/sign-in");

  const kind = formData.get("kind");

  if (!isServiceKind(kind)) {
    return { status: "editing", error: "Pick what you need a hand with." };
  }

  const rawNote = formData.get("note");
  const note = typeof rawNote === "string" ? rawNote.trim() : "";

  if (note.length > MAX_SERVICE_NOTE) {
    return {
      status: "editing",
      error: `Keep this under ${MAX_SERVICE_NOTE.toLocaleString("en-US")} characters.`,
    };
  }

  const submissionId = formData.get("submission_id");

  try {
    const company = await getCompanyForEmail(session.email);

    await recordServiceRequest({
      email: session.email,
      kind,
      note: note || null,
      companyId: company?.id ?? null,
      submissionId: typeof submissionId === "string" && submissionId ? submissionId : null,
    });
  } catch (cause) {
    console.error("Could not record a service request:", cause);
    return {
      status: "editing",
      error: "We couldn't record that. Try again in a moment.",
    };
  }

  /*
   * Notifying is deliberately outside the try above. The request is already
   * stored at this point, and a failed notification is our problem to find in
   * the logs — telling someone their request did not go through, when it is
   * sitting in the table, would be the worse error of the two.
   */
  try {
    await notifyServiceRequest({ email: session.email, kind, note: note || null });
  } catch (cause) {
    console.error("Could not notify about a service request:", cause);
  }

  revalidatePath("/dashboard/help");

  return { status: "sent" };
}
