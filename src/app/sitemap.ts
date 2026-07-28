import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";
import { LEGAL_LINKS, NAV_LINKS } from "@/lib/nav";
import { ENTRY_POINTS } from "@/lib/entry-points";

/**
 * Driven off NAV_LINKS so a page added to the nav can't be left out of the
 * sitemap. The home page is listed separately because it isn't in the nav
 * and carries a higher priority than the supporting pages.
 *
 * The entry points are listed above About and FAQ because they are the pages
 * worth ranking: someone searching "ISNetworld document rejected" is describing
 * their problem, and that page answers it. The gap-check door is filtered out
 * — it is a fragment on the home page, already listed above, and submitting a
 * second URL for it would only split the two.
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
    ...ENTRY_POINTS.filter(({ href }) => !href.includes("#")).map(
      ({ href }) => ({
        url: `${SITE_URL}${href}`,
        lastModified,
        changeFrequency: "monthly" as const,
        priority: 0.8,
      }),
    ),
    ...[...NAV_LINKS, ...LEGAL_LINKS].map(({ href }) => ({
      url: `${SITE_URL}${href}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
