import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";
import { LEGAL_LINKS, NAV_LINKS } from "@/lib/nav";

/**
 * Driven off NAV_LINKS so a page added to the nav can't be left out of the
 * sitemap. The home page is listed separately because it isn't in the nav
 * and carries a higher priority than the supporting pages.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...[...NAV_LINKS, ...LEGAL_LINKS].map(({ href }) => ({
      url: `${SITE_URL}${href}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
