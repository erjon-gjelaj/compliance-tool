/**
 * What each plan may do.
 *
 * One module, so that connecting Stripe later means writing to
 * `companies.plan` and nothing else. Every check in the product goes through
 * `can()`; no page tests a plan string directly, because the day a fifth plan
 * appears, scattered string comparisons are how a feature ends up silently
 * available to the wrong people.
 *
 * ## What the free plan is
 *
 * The gap check, and everything around it: the intake, the review, the
 * dashboard, the documents somebody uploads and everything we say about them.
 * That is deliberately not a stub. It is the reason anybody arrives, it is
 * genuinely useful on its own, and it stays free.
 *
 * What it does not include is having a written program prepared in the
 * company's name, which is the work this business sells. `lib/pricing` maps
 * every one-time offer to `document_preparation` and `FREE_INCLUDES` lists
 * the free half; this module is the half that enforces it.
 *
 * That enforcement is newer than this file. Until the entitlement check was
 * wired into the generate action, `can()` was not called anywhere in the
 * application: the plan granted at the end of the money path decided nothing,
 * and the four generated programs were free to anyone with an email address.
 *
 * ## It is still not a billing system
 *
 * No payment path exists, `plan` is set by hand from the operator console,
 * and the UI never shows a checkout or claims one is coming on a date. Where
 * money changes hands, the product records what somebody asked for and says a
 * person will reply — see lib/service-requests.
 */

export const PLANS = ["free", "contractor", "consultant", "admin"] as const;

export type Plan = (typeof PLANS)[number];

export const DEFAULT_PLAN: Plan = "free";

/**
 * The things a plan can hold.
 *
 * Named for outcomes rather than for screens, because the screens will change
 * and the outcome is what someone is actually paying for.
 */
export const CAPABILITIES = [
  /** Everything shipped today: intake, review, dashboard, documents. */
  "gap_review",
  /** Have a written program prepared in the company's name. */
  "document_preparation",
  /** Word and PDF of a prepared document, and every later version. */
  "document_export",
  /** Hold and switch between several contractors' workspaces. Not built. */
  "multiple_companies",
  /** Remove CertLoop branding from deliverables. Not built. */
  "white_label",
  /** Read anyone's submissions. Ours. */
  "internal_admin",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const GRANTS: Record<Plan, readonly Capability[]> = {
  free: ["gap_review"],
  contractor: ["gap_review", "document_preparation", "document_export"],
  consultant: [
    "gap_review",
    "document_preparation",
    "document_export",
    "multiple_companies",
    "white_label",
  ],
  // Admin is listed out rather than given a wildcard. A wildcard grants every
  // capability added in future automatically, including ones that should never
  // have been ours to exercise on someone else's account.
  admin: [
    "gap_review",
    "document_preparation",
    "document_export",
    "multiple_companies",
    "white_label",
    "internal_admin",
  ],
};

export function isPlan(value: unknown): value is Plan {
  return typeof value === "string" && (PLANS as readonly string[]).includes(value);
}

/**
 * The plan on a profile, falling back to free.
 *
 * Unrecognised values fall back rather than throw. This column is edited by
 * hand, and a typo in it should cost someone a capability they were not using
 * yet rather than take their dashboard down.
 */
export function planOf(company: { plan?: string | null } | null): Plan {
  return isPlan(company?.plan) ? company.plan : DEFAULT_PLAN;
}

export function can(plan: Plan, capability: Capability): boolean {
  return GRANTS[plan].includes(capability);
}

/**
 * What to say where a capability is missing.
 *
 * Deliberately never "upgrade now" and never a price. There is nothing to
 * upgrade to yet, and a button that implies otherwise is the exact dishonesty
 * this product avoids everywhere else. Each of these leads to recording a
 * request that a person answers.
 */
export const LOCKED_COPY: Record<Capability, string> = {
  gap_review: "",
  document_preparation:
    "Having a program written and prepared in your company's name isn't part of the free plan. Tell us what you need and we'll reply with the price before anything starts.",
  document_export:
    "Word and PDF of a prepared program come with having one prepared. Ask us and we'll come back with what's involved.",
  multiple_companies:
    "Managing several companies isn't available yet. Tell us about your setup and we'll talk it through.",
  white_label:
    "Unbranded deliverables aren't available yet. Tell us what you need.",
  internal_admin: "",
};
