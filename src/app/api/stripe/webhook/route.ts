import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { getStripe, webhookConfigured } from "@/lib/billing/stripe";
import { markRefunded, syncPlanFromPurchases } from "@/lib/billing/purchases";
import { fulfilSession } from "@/lib/billing/fulfil";

/**
 * Where a payment becomes an entitlement.
 *
 * This is the only place in the product that grants paid access without a
 * person, and it is the only place that ever should — the browser is told
 * nothing it can act on, because a success page is just a redirect and
 * anybody can visit one. Stripe telling us server to server, with a
 * signature, is the only evidence that money moved.
 *
 * ## Everything here is idempotent
 *
 * Stripe delivers at least once, retries every non-2xx for up to three days,
 * and will happily send the same event twice for no reason. So fulfilment is
 * written to be safe to run repeatedly: the unique constraint on the session
 * id absorbs the duplicate, the plan is set to a computed value rather than
 * incremented, and the email only goes out on the delivery that actually
 * created the row.
 *
 * ## Why failures still return 200
 *
 * Only for events we do not handle. A genuine fulfilment failure returns 500
 * *on purpose*, so Stripe retries it — somebody has paid, and the alternative
 * to a retry is a customer with a charge and no product. Anything we simply
 * do not care about is acknowledged, because leaving it to retry for three
 * days buries the events that matter.
 */

export const dynamic = "force-dynamic";

/*
 * The raw body is required: the signature is computed over the exact bytes
 * Stripe sent, and anything that reserialises the JSON — including reading it
 * as an object and stringifying it again — invalidates it.
 */
async function readEvent(request: Request): Promise<Stripe.Event> {
  const signature = request.headers.get("stripe-signature");
  if (!signature) throw new Error("no stripe-signature header");

  const secret = process.env.STRIPE_WEBHOOK_SECRET!.trim();
  const body = await request.text();

  return getStripe().webhooks.constructEvent(body, signature, secret);
}

export async function POST(request: Request) {
  // An unconfigured deployment does not advertise the endpoint, as with
  // ADMIN_SECRET elsewhere in this project.
  if (!webhookConfigured()) {
    return new NextResponse("Not found", { status: 404 });
  }

  let event: Stripe.Event;

  try {
    event = await readEvent(request);
  } catch (cause) {
    /*
     * A bad signature is the one case that must never be retried and must
     * never be treated as real. It means either a misconfigured secret or
     * somebody posting fabricated payment events at the endpoint to grant
     * themselves the product.
     */
    console.error("Rejected a Stripe webhook:", cause);
    return new NextResponse("Bad signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await fulfilSession(event.data.object as Stripe.Checkout.Session);
        break;

      case "charge.refunded": {
        /*
         * Refunds arrive against the charge, which knows its payment intent
         * but not the checkout session. Looked up rather than guessed, so a
         * refund on an unrelated charge cannot revoke somebody's access.
         */
        const charge = event.data.object as Stripe.Charge;
        const intent =
          typeof charge.payment_intent === "string" ? charge.payment_intent : null;

        if (!intent) break;

        const sessions = await getStripe().checkout.sessions.list({
          payment_intent: intent,
          limit: 1,
        });
        const session = sessions.data[0];
        if (!session) break;

        await markRefunded(session.id);

        const email = session.metadata?.email ?? session.client_reference_id;
        if (email) await syncPlanFromPurchases(email);
        break;
      }

      default:
        // Acknowledged. Stripe sends a great many event types and retrying
        // the ones we ignore for three days would bury the ones we do not.
        break;
    }
  } catch (cause) {
    /*
     * 500 on purpose. Somebody has paid, this delivery did not complete, and
     * a retry is the only thing standing between them and a charge with no
     * product. Everything above is idempotent precisely so this is safe.
     */
    console.error(`Stripe webhook ${event.type} failed:`, cause);
    return new NextResponse("Fulfilment failed", { status: 500 });
  }

  return NextResponse.json({ received: true });
}
