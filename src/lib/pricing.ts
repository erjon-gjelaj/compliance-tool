/**
 * Pricing, as configuration.
 *
 * Every number here is a preliminary assumption, not a commercial decision.
 * They will move after customer interviews, real review times, revision
 * volume and support burden are known — which is exactly why they live in one
 * file as data rather than being written into logic, copy, or a template
 * somewhere.
 *
 * Two rules that follow from that:
 *
 *  - Nothing outside this module hardcodes an amount. Screens read from here.
 *  - Everything is presented as a RANGE and labelled early-access, because a
 *    single figure reads as a quote and these are not quotes. `PRICING_NOTE`
 *    travels with them wherever they are shown.
 *
 * There is no payment provider connected. `Plan` and `Capability` in
 * lib/entitlements decide what someone may do; this file only decides what is
 * said about cost.
 */

export type Money = { low: number; high: number };

export type ServiceOffer = {
  id: string;
  name: string;
  /** What they get, in one line. */
  summary: string;
  price: Money;
  /** Which capability this grants, if it maps to one. */
  unlocks?: string;
};

/**
 * One-time work, which is how most of this audience will arrive.
 *
 * A contractor with one urgent rejection is not a subscriber, and forcing a
 * monthly plan on them to solve a problem they will not have again for six
 * months would lose the sale and deserve to.
 */
export const ONE_TIME_SERVICES: ServiceOffer[] = [
  {
    id: "rejection_fix",
    name: "Rejection fix",
    summary:
      "We work out what the reviewer is asking for and prepare what you need to resubmit.",
    price: { low: 149, high: 299 },
    unlocks: "document_preparation",
  },
  {
    id: "single_program",
    name: "One safety program",
    summary:
      "A single written program, prepared for your company and your trade.",
    price: { low: 79, high: 149 },
    unlocks: "document_preparation",
  },
  {
    id: "starter_package",
    name: "Starter package",
    summary:
      "The written programs a prequalification file is normally built from, together.",
    price: { low: 299, high: 499 },
    unlocks: "document_preparation",
  },
];

/** Ongoing work, for someone who has to stay current rather than get current. */
export const MAINTENANCE_PLAN = {
  id: "maintenance",
  name: "Maintenance",
  summary:
    "Document updates, renewal reminders, reviews when a new client asks, and revisions.",
  price: { low: 79, high: 129 } as Money,
  per: "month" as const,
};

/** What the free plan actually includes. Genuinely useful, and stays so. */
export const FREE_INCLUDES = [
  "Your company profile",
  "Gap checks against what you upload",
  "Rejection and document analysis",
  "What your file looks short on, and why",
  "Everything you've sent us, kept and searchable",
] as const;

/**
 * Shown wherever a price is.
 *
 * Not a disclaimer for its own sake — it is true, and a contractor who is
 * quoted a range and then charged something else has been misled. Saying the
 * number is confirmed before any work starts is the part that makes a range
 * honest rather than evasive.
 */
export const PRICING_NOTE =
  "Early-access pricing, and a range rather than a quote. We confirm the actual number with you before any work starts, and nothing is charged automatically.";

export function formatMoney({ low, high }: Money): string {
  return `$${low}–$${high}`;
}

/** The range for an offer id, for recording what somebody was told. */
export function offerById(id: string): ServiceOffer | undefined {
  return ONE_TIME_SERVICES.find((offer) => offer.id === id);
}
