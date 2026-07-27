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
      // The same reasoning covers the client pages. /dashboard is behind a
      // cookie a crawler will never hold, and /sign-in renders nothing worth
      // indexing — but a sign-in URL sitting in a search result is one more
      // place a person can be sent from by a phishing mail, so ask.
      disallow: ["/internal", "/dashboard", "/sign-in", "/api"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
