import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";
import { LEGAL_LINKS, NAV_LINKS } from "@/lib/nav";
import { ENTRY_POINTS } from "@/lib/entry-points";
import { REJECTION_CODES } from "@/lib/config";
import glossary from "../../config/glossary.json";

/**
 * Driven off NAV_LINKS so a page added to the nav can't be left out of the
 * sitemap. The home page is listed separately because it isn't in the nav
 * and carries a higher priority than the supporting pages.
 *
 * The entry points are listed above About and FAQ because they are the pages
 * worth ranking: someone searching "ISNetworld document rejected" is describing
 * their problem, and that page answers it. The generic gap check now has its
 * own route and is included with the other entry points.
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
    ...ENTRY_POINTS.map(({ href }) => ({
      url: `${SITE_URL}${href}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...[...NAV_LINKS, ...LEGAL_LINKS].map(({ href }) => ({
      url: `${SITE_URL}${href}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    {
      url: `${SITE_URL}/calculators/incident-rates`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    ...REJECTION_CODES.map((entry) => ({
      url: `${SITE_URL}/rejection/${entry.public_slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...glossary.records.map((entry) => ({
      url: `${SITE_URL}/glossary/${entry.slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
