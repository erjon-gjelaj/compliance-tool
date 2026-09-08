import "server-only";

import Stripe from "stripe";

/**
 * The Stripe client, and the question of whether payment is switched on.
 *
 * ## Absent keys are a supported state
 *
 * A deployment with no Stripe keys is not broken — it is the state every
 * checkout of this repository starts in, and the state the test suite runs
 * in. So `stripeConfigured()` is checked before anything is offered, and the
 * product falls back to recording a request that a person answers, exactly as
 * it did before payment existed.
 *
 * The alternative, a Buy button that throws on click, is the single worst
 * outcome available here: it takes somebody who had decided to pay and shows
 * them an error.
 *
 * ## Why the secret is read every call
 *
 * Module-level initialisation captures whatever `process.env` held when the
 * bundle first evaluated, which on a serverless platform is not necessarily
 * after the environment is populated. Reading per call costs nothing next to
 * a network round trip to Stripe.
 */

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

/** True only when incoming webhooks can actually be verified. */
export function webhookConfigured(): boolean {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();

  if (!key) {
    throw new Error(
      "Stripe is not configured: set STRIPE_SECRET_KEY in the environment",
    );
  }

  return new Stripe(key, {
    /*
     * Pinned. Stripe changes response shapes between versions, and inheriting
     * whatever the account happens to be set to means a dashboard setting
     * somebody else changes can alter what this code receives.
     */
    apiVersion: "2026-08-26.dahlia",
    typescript: true,
    /*
     * Payment is one request in a flow somebody is waiting on. Two retries at
     * the client level is enough to ride out a blip; more than that and the
     * page has been unresponsive long enough that they will click again.
     */
    maxNetworkRetries: 2,
    timeout: 15000,
  });
}
