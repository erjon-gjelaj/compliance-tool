"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { currentWorkspace } from "@/lib/workspaces";
import { getRequestForEmail, recordEvent } from "@/lib/requests/store";
import { notifyCustomerReply } from "@/lib/notify";

export type ReplyState = {
  status: "editing" | "sent";
  error?: string;
};

const MAX_REPLY = 4000;

/**
 * The customer adding something to a request.
 *
 * Recording the message is the whole of the state change — a customer message
 * puts the request back on us by derivation, so there is nothing else to set.
 * That is the point of the events model: replying and "changing the status"
 * are the same act, and cannot come apart.
 */
export async function replyToRequest(
  _previous: ReplyState,
  formData: FormData,
): Promise<ReplyState> {
  const workspace = await currentWorkspace();
  if (!workspace) redirect("/sign-in");

  const requestId = formData.get("request_id");

  if (typeof requestId !== "string" || !requestId) {
    return { status: "editing", error: "We couldn't tell which request that was." };
  }

  const raw = formData.get("body");
  const body = typeof raw === "string" ? raw.trim() : "";

  if (!body) {
    return { status: "editing", error: "Write something first." };
  }

  if (body.length > MAX_REPLY) {
    return {
      status: "editing",
      error: `Keep this under ${MAX_REPLY.toLocaleString("en-US")} characters.`,
    };
  }

  // Ownership is checked by reading it back through the email filter. A
  // request id posted by a browser proves nothing on its own, and appending to
  // a stranger's conversation would put this customer's words in front of them.
  const request = await getRequestForEmail(workspace.email, requestId);

  if (!request) {
    return { status: "editing", error: "We couldn't find that request." };
  }

  try {
    await recordEvent({
      requestId: request.id,
      actor: "customer",
      kind: "customer_message",
      body,
    });
  } catch (cause) {
    console.error("Could not record a customer reply:", cause);
    return {
      status: "editing",
      error: "We couldn't save that. Try again in a moment.",
    };
  }

  // Outside the try above: the message is already recorded, and telling
  // somebody their reply failed while it sits in the table is the worse error.
  try {
    await notifyCustomerReply({ email: workspace.email, requestId: request.id, body });
  } catch (cause) {
    console.error("Could not notify about a customer reply:", cause);
  }

  revalidatePath(`/dashboard/requests/${request.id}`);
  revalidatePath("/dashboard/requests");
  revalidatePath("/dashboard");

  return { status: "sent" };
}
