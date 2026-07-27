import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The gate is what actually protects this; a disallow is only a request
      // and naming a path in robots.txt advertises it. Worth it anyway so a
      // well-behaved crawler never surfaces the login screen in results.
      disallow: "/internal",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
