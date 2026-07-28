import type { Metadata } from "next";
import { EntryPage } from "@/components/entry-page";
import { pageMetadata } from "@/lib/metadata";
import { CONTACT_EMAIL } from "@/lib/constants";

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
 * Document preparation is task 040, and it is blocked on a content decision:
 * there is no reviewed safety-programme prose in this repo to assemble from,
 * and CLAUDE.md rules out generating it with a language model. So this door
 * does two real things — it runs the ordinary review to find out which
 * programmes are actually missing, and it records that someone wants them
 * prepared so a person can pick it up.
 *
 * What it must not do is imply the documents come back automatically. A
 * contractor who thinks a manual is arriving and gets a gap list instead has
 * been misled about the one thing they came for.
 */
export default function DocumentsPage() {
  return (
    <EntryPage
      entryReason="documents"
      tag="Written programs"
      tickId="tick-documents"
      title="You've been asked for a program you don't have"
      lede="Start by finding out which written programs your file is actually short on — including any you already have and didn't know counted. Preparing them is a separate job, and one you'd ask for on purpose."
      expect={[
        "Which written programs your file already covers, quoting where we found them.",
        "Which ones aren't mentioned anywhere in what you sent.",
        "What each missing one is for, in plain terms, and the OSHA standard behind it where one exists.",
        `A reply you can answer to ask about having them prepared — that part is handled by a person, not by the form.`,
      ]}
      formHeading="Start with what you already have"
      formNote={`Attach whatever documents exist, even old or half-finished ones. A program you already hold is the cheapest one to fix. If you'd rather just ask about having documents prepared, email ${CONTACT_EMAIL} and say so.`}
    />
  );
}
