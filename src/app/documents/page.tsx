import type { Metadata } from "next";
import { EntryPage } from "@/components/entry-page";
import { pageMetadata } from "@/lib/metadata";

export const maxDuration = 60;

export const metadata: Metadata = pageMetadata({
  title: "Safety programs and manuals",
  description:
    "Told to produce a written safety program or a manual you don't have. " +
    "Find out which programs your file is short on, and ask about having " +
    "them prepared.",
  path: "/documents",
});

/*
 * The honest state, and why this page does not have a buy button.
 *
 * This public door still begins with the file review because an anonymous
 * visitor may not know which program is missing. Once signed in, supported
 * programs are prepared automatically from short, company-specific
 * questionnaires. Unsupported or bespoke work remains a human request.
 */
export default function DocumentsPage() {
  return (
    <EntryPage
      entryReason="documents"
      tag="Written programs"
      tickId="tick-documents"
      title="You've been asked for a program you don't have"
      lede="Start by finding out which written programs your file is actually short on — including any you already have and didn't know counted. Supported programs can then be prepared automatically in your workspace."
      expect={[
        "Which written programs your file already covers, quoting where we found them.",
        "Which ones aren't mentioned anywhere in what you sent.",
        "What each missing one is for, in plain terms, and the OSHA standard behind it where one exists.",
        "Automatic Word and PDF preparation for supported programs after a short company-specific questionnaire.",
      ]}
      formHeading="Start with what you already have"
      formNote="Attach whatever documents exist, even old or half-finished ones. A program you already hold may only need revision; a missing supported program can be generated from your workspace."
    />
  );
}
