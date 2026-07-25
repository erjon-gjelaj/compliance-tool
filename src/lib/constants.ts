/**
 * Single source of truth for brand-level strings.
 *
 * The working name is not final. Everywhere a brand name would appear —
 * page titles, headers, metadata, form copy — reference these constants
 * instead of hardcoding, so renaming stays a one-line change.
 */

export const SITE_NAME = "CertLoop";

/**
 * Descriptive tagline. This one has a job to do in search results, so it
 * stays literal and carries both platform names rather than being clever.
 * Used in <title> templates and structured data.
 */
export const SITE_TAGLINE =
  "Find the safety paperwork missing from your ISNetworld or Avetta file";

/**
 * Short brand line, for places with no room to explain — currently the OG
 * card. Separate from SITE_TAGLINE on purpose: one has to work for a search
 * engine, the other has to work at a glance next to the wordmark.
 *
 * "The gate" is literal here. Prequalification is what buys a crew access
 * through a plant gate, and "gap" is the thing we actually produce.
 *
 * Alternates drafted alongside it, kept here so swapping is a one-line
 * change while the name is still unsettled (see the log for the reasoning
 * on each):
 *   "Know what's missing before the shutdown starts."
 *   "Prequalification paperwork, without the retainer."
 *   "You were told to get prequalified. Start here."
 *   "Four questions. Then a list of what your file still needs."
 *   "Templates don't know your trade."
 */
export const SITE_SLOGAN = "The gap between your file and the gate.";

/**
 * Canonical origin, no trailing slash. certloop.net is the registered
 * domain, so it is the fallback; NEXT_PUBLIC_SITE_URL still overrides it
 * per-environment, and should be set to the *.vercel.app origin until the
 * domain is actually attached and serving, or the canonical URL will point
 * somewhere that doesn't answer yet.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://certloop.net";

/**
 * Where free gap-check requests are followed up from.
 *
 * On certloop.net, which is registered — but the mailbox still has to exist
 * before this address goes anywhere. The Contact page is built around it
 * working.
 */
export const CONTACT_EMAIL = "hello@certloop.net";
