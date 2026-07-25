import type { Metadata } from "next";
import {
  Bricolage_Grotesque,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
} from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/constants";

/*
 * Display face: Bricolage Grotesque — tight and slightly irregular, more
 * character than the usual grotesk. Body and labels: IBM Plex, drawn as a
 * technical family, which suits paperwork and field documents.
 */
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

// Both Plex families are only ever used at regular weight — everything
// bold on the page is set in the display face. Loading a single weight
// each keeps the font payload down.
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400"],
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
      className={`${bricolage.variable} ${plexSans.variable} ${plexMono.variable} h-full antialiased`}
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
      </body>
    </html>
  );
}
