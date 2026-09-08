/**
 * What things cost, and what is promised with them.
 *
 * ## What changed, and why
 *
 * This module used to hold three one-time tiers and a monthly plan, every
 * figure a range, every range labelled early-access and confirmed by a person
 * on a call before any work began. That was an honest description of a
 * consultancy. It was not a product, and it could not be bought.
 *
 * The prices are now in `lib/billing/catalog`, as a single figure, because a
 * checkout has to charge a number rather than describe one — and there is one
 * product rather than four, because the capability being sold is one bit and
 * every extra tier sold a distinction this software could not enforce.
 *
 * What is left here is the promise that travels with a document after it has
 * been bought, which is a commercial policy rather than a price.
 */

/**
 * What we promise when a generated document is sent back.
 *
 * Configurable rather than written into a page, because the boundary of a
 * free revision is a commercial decision that will move. Deliberately not
 * "unlimited" in the sense of any document for any purpose: a revision of the
 * same program, for the same company, is covered — and since the product is
 * now one payment for every program, there is nothing left for a revision to
 * cost extra.
 */
export const REVISION_PROMISE =
  "If a hiring client sends this back, paste what they said and a revised version is generated straight away — at no extra cost, as many times as you need.";
