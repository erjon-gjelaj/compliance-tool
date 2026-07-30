import type { Metadata } from "next";
import { EntryPointsSection } from "@/components/entry-points-section";
import { Hero } from "@/components/hero";
import { HomeCta } from "@/components/home-cta";
import { HowItWorks } from "@/components/how-it-works";
import { OrganizationSchema } from "@/components/organization-schema";
import { SITE_NAME } from "@/lib/constants";

const PAGE_TITLE = `${SITE_NAME} — ISNetworld and Avetta prequalification gap check`;

const PAGE_DESCRIPTION =
  "Small industrial subcontractors: find out which safety programs, " +
  "training records, and insurance documents your ISNetworld or Avetta " +
  "file is still missing. Tell us your trade and hiring client, get a " +
  "free list back.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/",
    locale: "en_US",
  },
  twitter: {
    // Upgraded from "summary" now that opengraph-image.tsx generates a real
    // 1200x630 card — Next fills in twitter:image from the same file.
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
};

export default function Home() {
  return (
    <>
      <OrganizationSchema />
      <main className="flex-1">
        <Hero />
        <EntryPointsSection />
        <HowItWorks />
        <HomeCta />
      </main>
    </>
  );
}
