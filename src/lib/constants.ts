/**
 * Single source of truth for brand-level strings.
 *
 * The working name is not final. Everywhere a brand name would appear —
 * page titles, headers, metadata, form copy — reference these constants
 * instead of hardcoding, so renaming stays a one-line change.
 */

export const SITE_NAME = "CertLoop";

/** Used in <title> templates and structured data. */
export const SITE_TAGLINE =
  "Find the safety paperwork missing from your ISNetworld or Avetta file";

/**
 * Canonical origin, no trailing slash. Overridden per-environment via
 * NEXT_PUBLIC_SITE_URL once the production domain is chosen (task 005).
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://certloop.vercel.app";

/** Where free gap-check requests are followed up from. */
export const CONTACT_EMAIL = "hello@certloop.com";
