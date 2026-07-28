import type { Metadata } from "next";
import { EntryPage } from "@/components/entry-page";
import { pageMetadata } from "@/lib/metadata";
import { SITE_NAME } from "@/lib/constants";

/*
 * The analysis runs inside the submit action via after(), so this route needs
 * the same wall clock as the home page. See the note on src/app/page.tsx.
 */
export const maxDuration = 60;

export const metadata: Metadata = pageMetadata({
  title: "A document came back rejected",
  description:
    "Send the reviewer's comments and the document ISNetworld or Avetta " +
    "turned down. Get back what the notes point at, what your file actually " +
    "contains, and what to confirm before you resubmit.",
  path: "/rejection",
});

export default function RejectionPage() {
  return (
    <EntryPage
      entryReason="rejection"
      tag="Rejected document"
      tickId="tick-rejection"
      title="Your document came back rejected"
      lede="Send us the reviewer's wording and the document they turned down. You'll get a read of what the notes point at and what your file actually contains — so you resubmit once rather than three times."
      /*
       * Every line here is something the pipeline genuinely produces. The one
       * we cannot write is "what the reviewer requires": we never see their
       * message, only the contractor's copy of it, so the third line says what
       * we do instead and the fourth is the honest limit rather than a
       * footnote about it.
       */
      expect={[
        "Which document type the notes you paste are about, quoting the words we matched.",
        "What that document of yours actually contains, and what it doesn't mention.",
        "What to confirm with the reviewer before you resubmit — their wording decides it, not ours.",
        "The OSHA standard on the subject, where one exists and we could verify it.",
      ]}
      formHeading="What came back, and what you sent them"
      formNote={`Paste the reviewer's comments in the first step and attach the rejected document at the last one. Either on its own is useful; both together is what ${SITE_NAME} can say the most about. Everything after the first screen is optional.`}
    />
  );
}
