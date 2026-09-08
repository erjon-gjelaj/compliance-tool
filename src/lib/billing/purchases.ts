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
  stripe_session_id: string;
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
  sessionId,
  paymentIntent,
  customerId,
  amountCents,
  currency,
}: {
  email: string;
  productId: string;
  sessionId: string;
  paymentIntent: string | null;
  customerId: string | null;
  amountCents: number;
  currency: string;
}): Promise<{ created: boolean }> {
  const supabase = getSupabaseAdminClient();
  const company = await getCompanyForEmail(email);

  const { error } = await supabase.from("purchases").insert({
    email,
    company_id: company?.id ?? null,
    product_id: productId,
    stripe_session_id: sessionId,
    stripe_payment_intent: paymentIntent,
    stripe_customer_id: customerId,
    amount_cents: amountCents,
    currency,
  });

  if (error) {
    // 23505 is unique_violation: this session was already fulfilled. That is
    // Stripe doing exactly what it promises, not a problem.
    if (error.code === "23505") return { created: false };
    throw new Error(`Could not record the purchase: ${error.message}`);
  }

  return { created: true };
}

/** Marks a purchase refunded. The row stays: the ledger must match Stripe. */
export async function markRefunded(sessionId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();

  const { error } = await supabase
    .from("purchases")
    .update({ status: "refunded" })
    .eq("stripe_session_id", sessionId);

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
