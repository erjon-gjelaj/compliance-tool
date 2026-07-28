import type { Metadata } from "next";
import { EntryPointsSection } from "@/components/entry-points-section";
import { GapCheck } from "@/components/gap-check";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { OrganizationSchema } from "@/components/organization-schema";
import { SITE_NAME } from "@/lib/constants";

const PAGE_TITLE = `${SITE_NAME} — ISNetworld and Avetta prequalification gap check`;

const PAGE_DESCRIPTION =
  "Small industrial subcontractors: find out which safety programs, " +
  "training records, and insurance documents your ISNetworld or Avetta " +
  "file is still missing. Tell us your trade and hiring client, get a " +
  "free list back.";

/**
 * The gap-check server action runs here, and the analysis runs inside it via
 * after() — which counts towards this function's wall clock, not a separate
 * one.
 *
 * Extraction is fast now that there is no OCR: reading a text layer is
 * milliseconds, and the slowest step left is the SMTP round trip. This is
 * headroom rather than a requirement, and 60 is the ceiling on Vercel's Hobby
 * plan anyway. It matters because an invocation killed mid-flight loses the
 * email as well as the review, which is the one outcome worth paying for
 * margin to avoid.
 */
export const maxDuration = 60;

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
        <GapCheck />
      </main>
    </>
  );
}
