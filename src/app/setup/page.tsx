import type { Metadata } from "next";
import { EntryPage } from "@/components/entry-page";
import { pageMetadata } from "@/lib/metadata";

export const maxDuration = 60;

export const metadata: Metadata = pageMetadata({
  title: "Setting up ISNetworld or Avetta",
  description:
    "A hiring client told you to register in ISNetworld or Avetta. Find " +
    "out what a prequalification file for your trade is normally built " +
    "from, and where yours currently stands.",
  path: "/setup",
});

export default function SetupPage() {
  return (
    <EntryPage
      entryReason="setup"
      tag="New registration"
      tickId="tick-setup"
      title="A client told you to register"
      lede="Start from the platform and the plant asking. You'll get the categories a file for your trade is normally built from, checked against whatever you already have."
      expect={[
        "The document categories a file for your trade usually has to cover.",
        "Which of them your existing documents already mention, and which they don't.",
        "The questions to put to your hiring client — their list is the one that decides your file.",
        "A rough sense of how big the job is, so you can plan around the date.",
      ]}
      formHeading="Tell us who's asking, and by when"
      formNote="The first screen is all we need to start. If you already have documents — even old or partial ones — attaching them at the last step is what turns a generic list into an answer about your file."
    />
  );
}
