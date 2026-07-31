/**
 * The site's pages, in nav order.
 *
 * Single source for the header, the footer, and the sitemap, so adding a
 * page means touching one list rather than three files that drift apart.
 * The home page is deliberately not listed — the wordmark links there.
 */
export const NAV_LINKS = [
  { href: "/#product", label: "Product" },
  { href: "/documents", label: "Programs" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
] as const;

/**
 * Pages that belong in the footer and the sitemap but not in the header.
 *
 * Kept separate from NAV_LINKS on purpose. The header is a flat row of three
 * that stays visible at every width, and the privacy page is something you go
 * looking for — it is linked from the upload step, where it is actually
 * relevant, rather than competing for space with About and FAQ.
 */
export const LEGAL_LINKS = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy" },
] as const;

/**
 * The generic intake has its own focused page. Named entry pages such as
 * /setup use the same underlying form with problem-specific framing.
 */
export const GAP_CHECK_HREF = "/gap-check";

/**
 * The way back in for someone who has already sent us something.
 *
 * Kept out of NAV_LINKS and LEGAL_LINKS on purpose: those two feed the
 * sitemap, and an account door has no business in a search index. It is
 * placed separately in the header, set apart from the three content pages,
 * because it is the only link up there aimed at existing clients rather than
 * at someone deciding whether to become one.
 */
export const SIGN_IN_LINK = { href: "/sign-in", label: "Sign in" } as const;
