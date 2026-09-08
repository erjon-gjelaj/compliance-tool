import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase";
import { getCompanyForEmail, setPlanForEmail } from "@/lib/companies";
import { DEFAULT_PLAN, type Plan } from "@/lib/entitlements";

/**
 * The record of what was actually paid, and the entitlement that follows.
 *
 * `companies.plan` is a cache. This is the ledger. Everything the application
 * reads on a request goes through the plan, because a per-request join
 * against a payments table to render a page would be a bad trade — but the
 * plan is only ever *written* from what is here, so the two cannot drift for
 * any reason other than a bug that this module is the place to fix.
 */

export type PurchaseRow = {
  id: string;
  created_at: string;
  email: string;
  product_id: string;
  payment_reference: string;
  source: "stripe" | "manual";
  amount_cents: number;
  currency: string;
  status: "paid" | "refunded";
};

/**
 * Records a completed payment, once.
 *
 * Returns whether this call was the one that created the row. Stripe delivers
 * webhooks at least once and redelivers on any non-2xx, so a duplicate is the
 * normal case rather than the exceptional one — and the unique constraint on
 * the session id is what makes the second delivery free. `false` is not a
 * failure and must not be reported as one.
 */
export async function recordPurchase({
  email,
  productId,
  reference,
  source = "stripe",
  paymentIntent = null,
  customerId = null,
  amountCents,
  currency,
}: {
  email: string;
  productId: string;
  /**
   * Unique per payment. Stripe's checkout session id, or whatever an operator
   * types for a bank transfer. Uniqueness is the whole safety property here:
   * it makes a replayed webhook free, and it makes an operator recording the
   * same transfer twice free too.
   */
  reference: string;
  source?: "stripe" | "manual";
  paymentIntent?: string | null;
  customerId?: string | null;
  amountCents: number;
  currency: string;
}): Promise<{ created: boolean }> {
  const supabase = getSupabaseAdminClient();
  const company = await getCompanyForEmail(email);

  const { error } = await supabase.from("purchases").insert({
    email,
    company_id: company?.id ?? null,
    product_id: productId,
    payment_reference: reference,
    source,
    stripe_payment_intent: paymentIntent,
    stripe_customer_id: customerId,
    amount_cents: amountCents,
    currency,
  });

  if (error) {
    // 23505 is unique_violation: this payment was already recorded. From
    // Stripe that is a redelivered webhook doing exactly what it promises;
    // from an operator it is the same transfer entered twice. Neither is a
    // problem, and neither should grant a second entitlement.
    if (error.code === "23505") return { created: false };
    throw new Error(`Could not record the purchase: ${error.message}`);
  }

  return { created: true };
}

/** Marks a purchase refunded. The row stays: the ledger must match reality. */
export async function markRefunded(reference: string): Promise<void> {
  const supabase = getSupabaseAdminClient();

  const { error } = await supabase
    .from("purchases")
    .update({ status: "refunded" })
    .eq("payment_reference", reference);

  if (error) throw new Error(`Could not mark a refund: ${error.message}`);
}

export async function purchasesForEmail(email: string): Promise<PurchaseRow[]> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("purchases")
    .select("*")
    .ilike("email", email.replace(/[%_]/g, (character) => `\\${character}`))
    .order("created_at", { ascending: false });

  if (error) {
    console.warn(`Could not read purchases: ${error.message}`);
    return [];
  }

  return (data ?? []) as PurchaseRow[];
}

/**
 * The plan somebody's payments entitle them to.
 *
 * Deliberately does not read the existing plan. A plan set by hand from the
 * operator console — a comped account, a consultant, an admin — is a
 * different kind of fact from a payment, and mixing the two here would mean a
 * refund silently demoting an admin. `syncPlanFromPurchases` is where that
 * distinction is enforced.
 */
export function planFromPurchases(purchases: PurchaseRow[]): Plan {
  const paid = purchases.some((purchase) => purchase.status === "paid");
  return paid ? "contractor" : DEFAULT_PLAN;
}

/**
 * Brings the cached plan back in line with the ledger.
 *
 * Two rules, both about not undoing a person's decision:
 *
 *  - A plan that is *above* what was paid for is left alone. `consultant` and
 *    `admin` are granted by hand and outrank anything a checkout produces;
 *    syncing must never demote them because somebody bought a $199 product.
 *  - A downgrade only happens when the ledger says nothing is owed. A refund
 *    on the only purchase removes access; a refund on one of two does not.
 */
export async function syncPlanFromPurchases(email: string): Promise<Plan> {
  const purchases = await purchasesForEmail(email);
  const earned = planFromPurchases(purchases);

  const company = await getCompanyForEmail(email);
  const currentPlan = company?.plan;

  if (currentPlan === "consultant" || currentPlan === "admin") {
    return currentPlan;
  }

  if (currentPlan === earned) return earned;

  await setPlanForEmail(email, earned);
  return earned;
}

/**
 * Records a payment that arrived outside any card processor.
 *
 * ## Why this exists
 *
 * Every US card processor has to verify who receives the money — the Bank
 * Secrecy Act's customer identification rules, not a Stripe policy — and an
 * operator who cannot complete that verification cannot take cards at all.
 *
 * They can still be paid. A bank transfer between two businesses needs no
 * processor and no verification beyond having an account, and invoicing is
 * how most B2B work is paid for anyway. So this is the same fulfilment as a
 * card, with a human confirming receipt instead of a webhook.
 *
 * ## What makes it safe
 *
 * The reference. An operator types what their bank shows — a transfer id, a
 * check number — and the unique constraint on it means the same payment
 * entered twice grants nothing the second time. That matters more here than
 * it does for Stripe, because a person confirming payments by hand is exactly
 * the sort of thing that gets done twice on a busy morning.
 *
 * It does NOT verify that money arrived. Nothing in software can. The
 * operator looked at their bank and said so, and the row records who claimed
 * it and when.
 */
export async function recordManualPayment({
  email,
  productId,
  reference,
  amountCents,
  currency = "usd",
}: {
  email: string;
  productId: string;
  reference: string;
  amountCents: number;
  currency?: string;
}): Promise<{ created: boolean; plan: Plan }> {
  const trimmed = reference.trim();

  if (!trimmed) {
    throw new Error(
      "A manual payment needs a reference — whatever your bank shows for it.",
    );
  }

  const { created } = await recordPurchase({
    email,
    productId,
    // Namespaced so a manual reference can never collide with a Stripe
    // session id, and so the ledger reads unambiguously later.
    reference: `manual:${trimmed}`,
    source: "manual",
    amountCents,
    currency,
  });

  const plan = await syncPlanFromPurchases(email);

  return { created, plan };
}
