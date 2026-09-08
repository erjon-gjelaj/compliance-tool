import "server-only";

import type Stripe from "stripe";

import { PROGRAMS_PRODUCT } from "@/lib/billing/catalog";
import { getStripe } from "@/lib/billing/stripe";
import { recordPurchase, syncPlanFromPurchases } from "@/lib/billing/purchases";
import { notifyPlanGranted } from "@/lib/notify";

/**
 * Turning a paid Stripe session into an entitlement.
 *
 * Shared by the webhook and by the page somebody lands on after paying,
 * because both of them have to work and neither can be relied on alone.
 *
 * The webhook is the authority: it is signed, it retries, and it is the only
 * evidence that money actually moved. But it is asynchronous, and Stripe
 * makes no promise about arriving before the buyer's browser does. Left to
 * the webhook alone, a customer who pays and is redirected back within the
 * second sees the paywall they just paid to remove — and they have no way to
 * know it will fix itself, so they email, or they pay again.
 *
 * The return page therefore does the same work, having first *retrieved the
 * session from Stripe* rather than believing the query string. A URL is not
 * evidence: `?paid=1` is something anybody can type. What makes the return
 * path safe is that it asks Stripe about a specific session id and grants
 * nothing unless Stripe says that session is paid.
 *
 * Both routes converge here, and this function is idempotent, so whichever
 * arrives second does nothing.
 */

export type Fulfilment =
  | { status: "granted"; email: string; firstTime: boolean }
  | { status: "unpaid" }
  | { status: "unknown" };

export async function fulfilSession(
  session: Stripe.Checkout.Session,
): Promise<Fulfilment> {
  /*
   * The address that started the checkout, never the one typed into Stripe.
   * Somebody paying on a company card enters the address on the card, and
   * granting the product to that would lock the buyer out of the account they
   * bought it from.
   */
  const email = session.metadata?.email ?? session.client_reference_id ?? null;

  if (!email) {
    // Nothing to grant, and a retry carries the same missing field. Logged
    // loudly because it means checkout.ts and this file disagree — our bug,
    // and one somebody has already paid for.
    console.error(
      `Stripe session ${session.id} completed with no email in metadata; nothing granted.`,
    );
    return { status: "unknown" };
  }

  if (session.payment_status !== "paid") {
    // An asynchronous method that has not cleared. Stripe sends another event
    // when it does; granting now would hand over the product on the strength
    // of an intention to pay.
    return { status: "unpaid" };
  }

  const { created } = await recordPurchase({
    email,
    productId: session.metadata?.product_id ?? PROGRAMS_PRODUCT.id,
    sessionId: session.id,
    paymentIntent:
      typeof session.payment_intent === "string" ? session.payment_intent : null,
    customerId: typeof session.customer === "string" ? session.customer : null,
    amountCents: session.amount_total ?? 0,
    currency: session.currency ?? "usd",
  });

  /*
   * Run every time, not only on the first. It is a computed assignment, so
   * repeating it costs nothing — and it is the repair path for the case where
   * an earlier attempt recorded the purchase and then died before the plan
   * was written.
   */
  await syncPlanFromPurchases(email);

  /*
   * The email only on the call that created the row, so the webhook and the
   * return page cannot both send it. Telling somebody twice that their
   * programs are ready is how a product teaches people its mail is noise.
   *
   * Outside the failure path deliberately: the entitlement is already
   * granted, and throwing here would make Stripe retry a fulfilment that
   * worked.
   */
  if (created) {
    try {
      await notifyPlanGranted({ email, programName: null });
    } catch (cause) {
      console.error("Purchase granted, but the confirmation email failed:", cause);
    }
  }

  return { status: "granted", email, firstTime: created };
}

/**
 * Fulfils by session id, checking with Stripe first.
 *
 * This is what the return page calls. The id arrives in a query string, which
 * is worth nothing on its own — so it is looked up, and the entitlement comes
 * from what Stripe says about that session rather than from the fact that
 * somebody typed a plausible id into the address bar.
 *
 * A session belonging to a different account is still safe: the grant lands
 * on the email in *that session's* metadata, so replaying somebody else's id
 * grants them their own product a second time, which does nothing, rather
 * than granting anything to the replayer.
 */
export async function fulfilSessionId(sessionId: string): Promise<Fulfilment> {
  if (!sessionId || sessionId.length > 200) return { status: "unknown" };

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    return await fulfilSession(session);
  } catch (cause) {
    console.error(`Could not confirm Stripe session ${sessionId}:`, cause);
    return { status: "unknown" };
  }
}
