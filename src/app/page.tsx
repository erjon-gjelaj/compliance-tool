import type { Metadata } from "next";
import { GapCheck } from "@/components/gap-check";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { OrganizationSchema } from "@/components/organization-schema";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
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
    card: "summary",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
};

export default function Home() {
  return (
    <>
      <OrganizationSchema />
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <GapCheck />
      </main>
      <SiteFooter />
    </>
  );
}
