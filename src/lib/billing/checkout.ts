import "server-only";

import { SITE_URL } from "@/lib/constants";
import { PROGRAMS_PRODUCT, type Product } from "@/lib/billing/catalog";
import { getStripe } from "@/lib/billing/stripe";

/**
 * Starting a checkout.
 *
 * Stripe Checkout rather than card fields on our own page. Card details never
 * touch this application, which removes the entire class of problem that
 * comes with handling them — and Stripe's page already handles wallets, 3-D
 * Secure, and the twenty countries' worth of payment rules nobody here is
 * going to get right.
 *
 * ## The email is ours, not theirs
 *
 * The entitlement lands on `metadata.email`, taken from the signed session
 * that started the checkout. Stripe also collects an email, and it is the
 * wrong one to use: somebody paying with a company card types the address on
 * the card, and granting the product to that address would leave the person
 * who actually bought it locked out of the account they bought it from.
 *
 * It is passed as `customer_email` too, so the receipt goes somewhere they
 * recognise, but nothing is ever granted from it.
 */

export type CheckoutOutcome =
  | { ok: true; url: string }
  | { ok: false; reason: string };

export async function createCheckout({
  email,
  product = PROGRAMS_PRODUCT,
  returnTo = "/dashboard/programs",
}: {
  email: string;
  product?: Product;
  /** Where they land after paying. Kept relative so it cannot be an open redirect. */
  returnTo?: string;
}): Promise<CheckoutOutcome> {
  const stripe = getStripe();

  /*
   * A relative path only. This value reaches Stripe and comes back as a
   * redirect, so accepting an absolute URL here would turn the checkout into
   * an open redirect anybody could point at their own site.
   */
  const safeReturn = returnTo.startsWith("/") && !returnTo.startsWith("//")
    ? returnTo
    : "/dashboard/programs";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      client_reference_id: email,
      metadata: { email, product_id: product.id },
      /*
       * Repeated on the payment intent as well. `session.metadata` is not
       * present on every event type Stripe sends about a payment, and a
       * refund arriving with no idea whose entitlement it concerns is a
       * support ticket that cannot be answered.
       */
      payment_intent_data: {
        metadata: { email, product_id: product.id },
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: product.currency,
            unit_amount: product.amountCents,
            product_data: {
              name: product.name,
              description: product.summary,
            },
          },
        },
      ],
      success_url: `${SITE_URL}${safeReturn}?paid=1&session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}${safeReturn}?checkout=cancelled`,
      /*
       * Long enough to find a card, short enough that a stale link does not
       * charge somebody a week after they forgot about it. Stripe's own
       * minimum is 30 minutes.
       */
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
    });

    if (!session.url) {
      return { ok: false, reason: "Stripe did not return a checkout page." };
    }

    return { ok: true, url: session.url };
  } catch (cause) {
    // The key, the account state, or the network. None of it is the
    // customer's problem and none of it should reach them as a stack trace.
    console.error("Could not create a Stripe checkout session:", cause);
    return {
      ok: false,
      reason: "We couldn't open the payment page just now. Please try again.",
    };
  }
}
