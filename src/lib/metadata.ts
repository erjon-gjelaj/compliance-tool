import type { Metadata } from "next";
import { SITE_NAME, SITE_SLOGAN } from "@/lib/constants";

/**
 * The generated share card, as a route path.
 *
 * A page that declares its own `openGraph` object replaces whatever the
 * app/opengraph-image.tsx file convention would have contributed, rather
 * than merging with it — so every page that sets openGraph has to name the
 * image itself or it silently ships without one. That is what this helper
 * is for.
 */
const OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: `${SITE_NAME} — ${SITE_SLOGAN}`,
};

/** Standard metadata for a supporting page, so the three stay in step. */
export function pageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      siteName: SITE_NAME,
      title: `${title} | ${SITE_NAME}`,
      description,
      url: path,
      locale: "en_US",
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${SITE_NAME}`,
      description,
      images: [OG_IMAGE.url],
    },
  };
}
