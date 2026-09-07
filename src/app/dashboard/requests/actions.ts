"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { currentClient } from "@/lib/auth/session";
import { getRequestForEmail, recordEvent } from "@/lib/requests/store";
import { notifyCustomerReply, notifyQuoteDecision } from "@/lib/notify";
import { formatQuote, liveQuote } from "@/lib/requests/state";

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
  const session = await currentClient();
  if (!session) redirect("/sign-in");

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
  const request = await getRequestForEmail(session.email, requestId);

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
    await notifyCustomerReply({ email: session.email, requestId: request.id, body });
  } catch (cause) {
    console.error("Could not notify about a customer reply:", cause);
  }

  revalidatePath(`/dashboard/requests/${request.id}`);
  revalidatePath("/dashboard/requests");
  revalidatePath("/dashboard");

  return { status: "sent" };
}

export type QuoteDecisionState = {
  status: "idle" | "done";
  error?: string;
};

/**
 * The customer answering a price.
 *
 * One action for both answers, with the decision carried in the form data,
 * because accept and decline differ only in which event gets recorded and
 * splitting them would duplicate the ownership check — the part that matters.
 *
 * There is no payment here and there is deliberately no card on file. This
 * records a decision; the invoice happens outside the product. That is why
 * accepting is safe to do with one click: it commits somebody to a
 * conversation, not to a charge.
 */
export async function decideOnQuote(
  _previous: QuoteDecisionState,
  formData: FormData,
): Promise<QuoteDecisionState> {
  const session = await currentClient();
  if (!session) redirect("/sign-in");

  const requestId = formData.get("request_id");
  const decision = formData.get("decision");

  if (typeof requestId !== "string" || !requestId) {
    return { status: "idle", error: "We couldn't tell which request that was." };
  }

  if (decision !== "accept" && decision !== "decline") {
    return { status: "idle", error: "We couldn't tell what you decided." };
  }

  const request = await getRequestForEmail(session.email, requestId);

  if (!request) {
    return { status: "idle", error: "We couldn't find that request." };
  }

  /*
   * Re-derived from the log rather than trusted from the form. The button was
   * rendered from a page that may be minutes old, and in between the quote
   * could have been withdrawn, revised, or already answered in another tab.
   * Accepting a price that is no longer on offer is the one mistake here that
   * would cost real money to unpick.
   */
  const quote = liveQuote(request.events);

  if (!quote) {
    return {
      status: "idle",
      error:
        "That price isn't open any more — it may have been answered already " +
        "or replaced. Reload to see where this stands.",
    };
  }

  try {
    await recordEvent({
      requestId: request.id,
      actor: "customer",
      kind: decision === "accept" ? "quote_accepted" : "quote_declined",
    });
  } catch (cause) {
    console.error("Could not record a quote decision:", cause);
    return {
      status: "idle",
      error: "We couldn't save that. Try again in a moment.",
    };
  }

  try {
    await notifyQuoteDecision({
      email: session.email,
      requestId: request.id,
      accepted: decision === "accept",
      quote: formatQuote(quote),
    });
  } catch (cause) {
    console.error("Could not notify about a quote decision:", cause);
  }

  revalidatePath(`/dashboard/requests/${request.id}`);
  revalidatePath("/dashboard/requests");
  revalidatePath("/dashboard");

  return { status: "done" };
}
