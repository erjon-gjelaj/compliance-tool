/**
 * Getting paid without a card processor.
 *
 * ## The constraint this answers
 *
 * Every US payment processor must verify the identity of whoever receives the
 * money. That is the Bank Secrecy Act's customer identification requirement,
 * it applies to Stripe and PayPal and every alternative equally, and it is
 * why an SSN or an EIN comes up during onboarding. It is not a setting anybody
 * can turn off.
 *
 * What it does not touch is two businesses invoicing each other. A bank
 * transfer needs no processor, no onboarding and no verification beyond an
 * account that already exists — and for a $199 B2B product bought by a
 * contractor who already pays their suppliers this way, it is not even
 * unusual.
 *
 * So this is a first-class payment method rather than a fallback: the
 * customer gets an invoice with instructions, they pay however the
 * instructions say, and an operator confirms receipt. The entitlement that
 * follows is identical to a card's, because it comes from the same ledger.
 *
 * ## Configuration, not code
 *
 * The instructions are an environment variable because they are the one part
 * of this that is specific to whoever is running the deployment, and because
 * bank details do not belong in a git repository. Unset, the product says it
 * cannot take payment yet rather than showing an empty box — a payment page
 * with no way to pay is worse than an honest "not yet".
 */

export type PaymentInstructions = {
  /** Free text: bank details, a payment link, whatever the operator uses. */
  body: string;
  /** Shown as the reference the customer should quote. */
  referenceHint: string;
};

/**
 * How to pay, as configured for this deployment.
 *
 * Null means no method is configured, which every caller has to handle — the
 * paywall falls back to "ask us" rather than presenting a way to pay that
 * goes nowhere.
 */
export function paymentInstructions(): PaymentInstructions | null {
  const body = process.env.PAYMENT_INSTRUCTIONS?.trim();
  if (!body) return null;

  return {
    body,
    referenceHint:
      process.env.PAYMENT_REFERENCE_HINT?.trim() ||
      "your company name",
  };
}

/** Whether the product can be bought at all, by any means. */
export function invoicingConfigured(): boolean {
  return paymentInstructions() !== null;
}
