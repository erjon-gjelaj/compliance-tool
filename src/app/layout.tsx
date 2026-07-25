import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/constants";

/*
 * One family for the whole site: Bricolage Grotesque, headings and body
 * alike. It replaced a three-family setup (Bricolage over IBM Plex Sans and
 * Plex Mono) — the mix is gone, so nothing on the page is set in a face
 * other than this one.
 *
 * Bricolage is a variable font, so loading it unweighted covers everything
 * from the 400 used for body copy to the 600 used for headings in a single
 * file. Dropping Plex removed two families and their preloads outright.
 *
 * Swapping the whole site to a different face is a one-line change here plus
 * the matching --font-sans in globals.css.
 */
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    `${SITE_NAME} helps small industrial subcontractors see which safety ` +
    "programs, training records, and insurance documents their ISNetworld or " +
    "Avetta prequalification file still needs. Free gap check, no consultant " +
    "retainer.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* Header and footer live here so all four pages share the same
            chrome and nothing drifts as pages are added. */}
        <SiteHeader />
        {children}
        <SiteFooter />
        {/* Vercel Speed Insights. Reports Core Web Vitals to the Vercel
            dashboard; it only collects anything once the site is deployed
            there, so locally this renders nothing. */}
        <SpeedInsights />
        {/* Vercel Web Analytics — page views and visitors. Same deal: it
            only reports once the site is deployed to Vercel. */}
        <Analytics />
      </body>
    </html>
  );
}
