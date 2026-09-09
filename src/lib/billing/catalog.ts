import { offerablePrograms } from "@/lib/programs/registry";

/**
 * What can be bought, and for how much.
 *
 * ## One product, deliberately
 *
 * The earlier pricing carried three one-time tiers and a monthly plan, all as
 * ranges, all confirmed by a person before anything started. That is a
 * consultancy price list, not a product — and every extra tier bought
 * something this software could not actually enforce differently, because the
 * capability being sold (`document_preparation`) is one bit.
 *
 * Selling "one program" separately would have meant tracking which programs a
 * given payment covered, a per-program paywall inside the library, and a
 * customer discovering after paying that the second thing their hiring client
 * asked for costs again. For a subcontractor who needs three or four programs
 * anyway, that is worse for them and worse for us.
 *
 * So: one price, everything, forever, including every revision. It is
 * explainable in a sentence, impossible to get wrong, and there is no state
 * anywhere that has to remember which half of the product somebody owns.
 *
 * ## A single figure, not a range
 *
 * A range existed because a person was going to confirm the real number on a
 * call. Nobody is calling. A checkout has to show what the card will be
 * charged, so the number here is the number Stripe charges, taken from the
 * same constant.
 */

export type Product = {
  id: string;
  name: string;
  /** What it is, in one line, in the buyer's terms. */
  summary: string;
  /** Smallest currency unit, which is what Stripe wants and what we store. */
  amountCents: number;
  currency: "usd";
  /** Bullet points on the checkout card. Each one has to be true today. */
  includes: readonly string[];
};

export const PROGRAMS_PRODUCT: Product = {
  id: "programs",
  name: "Safety programs",
  summary:
    "Every written program we prepare, in your company's name, in Word and PDF.",
  amountCents: 19900,
  currency: "usd",
  includes: [
    /*
     * No count here on purpose. This line said "all four" for exactly as long
     * as it took to add a fifth program, and a price list that undersells what
     * it covers is a worse failure than a vague one. The live number is shown
     * next to it by `programCount()`, which reads the registry.
     */
    "Every written program in the library, prepared in your company's name",
    "Word and PDF of each, kept in your library",
    "Unlimited revisions, including after a hiring client sends one back",
    "Every future program we add, at no extra cost",
    "One payment. No subscription, nothing recurring",
  ],
};

export const PRODUCTS: Product[] = [PROGRAMS_PRODUCT];

export function productById(id: string): Product | undefined {
  return PRODUCTS.find((product) => product.id === id);
}

/** `$199`, or `$199.50` when a price ever stops being round. */
export function formatPrice(product: Product): string {
  const dollars = product.amountCents / 100;
  return Number.isInteger(dollars)
    ? `$${dollars}`
    : `$${dollars.toFixed(2)}`;
}

/** What the free side genuinely includes. Every line has to stay true. */
export const FREE_INCLUDES = [
  "A gap check against everything you upload",
  "What your file looks short on, and why",
  "Rejection and document analysis",
  "Your company profile",
  "Everything you've sent us, kept and searchable",
] as const;

/**
 * How many programs a purchase actually covers, read from the registry.
 *
 * Copy that carries a hand-written count goes stale the day somebody adds a
 * program, and it goes stale quietly: nobody reports a page that undersells
 * what they are buying. Reading it means the pricing page and the paywall are
 * correct by construction.
 */
export function programCount(): number {
  return offerablePrograms().length;
}
