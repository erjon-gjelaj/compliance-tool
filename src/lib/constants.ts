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
 * Normalises whatever NEXT_PUBLIC_SITE_URL is set to into a bare origin.
 *
 * This exists because the natural thing to type into a Vercel environment
 * variable is `certloop.net`, and the raw value used to be handed straight
 * to `new URL()` for metadataBase — which throws on a bare hostname and
 * fails the whole build. A trailing slash was the other easy way to end up
 * with `https://certloop.net//about` in the sitemap.
 *
 * So: an absent scheme gets https, and `.origin` drops any trailing slash,
 * path, or query. Anything genuinely unparseable falls back rather than
 * taking the build down.
 */
function toOrigin(value: string | undefined, fallback: string): string {
  const raw = value?.trim();
  if (!raw) return fallback;

  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    return new URL(withScheme).origin;
  } catch {
    return fallback;
  }
}

/**
 * Canonical origin, no trailing slash. certloop.net is the registered
 * domain and the fallback; NEXT_PUBLIC_SITE_URL overrides it per
 * environment.
 */
export const SITE_URL = toOrigin(
  process.env.NEXT_PUBLIC_SITE_URL,
  "https://certloop.net",
);

/**
 * Where free gap-check requests are followed up from. Registered and live.
 *
 * Read by the footer, the Contact page, the FAQ, the form's success panel,
 * and the Organization structured data — so it only ever changes here.
 */
export const CONTACT_EMAIL = "info@certloop.net";
