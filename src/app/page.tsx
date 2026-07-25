import type { Metadata } from "next";
import { GapCheck } from "@/components/gap-check";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `${SITE_NAME} — ISNetworld and Avetta prequalification gap check`,
  description:
    "Small industrial subcontractors: find out which safety programs, " +
    "training records, and insurance documents your ISNetworld or Avetta " +
    "file is still missing. Tell us your trade and hiring client, get a " +
    "free list back.",
};

export default function Home() {
  return (
    <>
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
