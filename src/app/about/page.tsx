import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/metadata";
import { PageIntro, PageSection } from "@/components/page-intro";
import { SITE_NAME } from "@/lib/constants";
import { GAP_CHECK_HREF } from "@/lib/nav";

const PAGE_TITLE = "About";

const PAGE_DESCRIPTION =
  `What ${SITE_NAME} does for small industrial subcontractors trying to get ` +
  "through ISNetworld or Avetta prequalification, how the review is " +
  "produced, and what it deliberately doesn't do.";

export const metadata: Metadata = pageMetadata({
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  path: "/about",
});

export default function AboutPage() {
  return (
    <main className="flex-1">
      <PageIntro
        tag="About"
        tickId="tick-about"
        title="What this is"
      >
        <p>
          {SITE_NAME} is a guided contractor-document workspace for small
          industrial companies preparing for ISNetworld or Avetta.
        </p>
      </PageIntro>

      <PageSection
        heading="The situation this is built around"
        headingId="origin"
      >
        <p className="type-body">
          A refinery, mill, or plant tells a crew of eight or twenty that they
          have to be registered and approved in ISNetworld or Avetta before they
          can come through the gate. The deadline belongs to somebody else. It
          is usually tied to a shutdown already on the calendar, and the work
          does not start until the file is accepted.
        </p>
        <p className="type-body">
          Almost none of these companies have a safety manager. It is the owner,
          or the office manager who also runs payroll, reading a portal at nine
          at night trying to work out what a written program is supposed to
          contain and whether the one they have counts.
        </p>
        <p className="type-body">
          That is a bad position to be in, and the existing ways out of it are
          expensive, slow, or generic. This site is aimed at exactly that moment
          and nothing else.
        </p>
      </PageSection>

      <PageSection heading="What you get" headingId="today">
        <p className="type-body">
          You tell us your trade, who is asking you to register, and which
          platform. You can attach the documents you already have. Within a
          minute or two you get an email listing what looks present, what looks
          missing, and what needs confirming with your hiring client — ordered
          so the things most likely to hold up approval come first.
        </p>
        <p className="type-body">
          The review stays in your dashboard afterwards, with the documents you
          uploaded, so you are not going back through your inbox to find it.
        </p>
      </PageSection>

      <PageSection heading="How the review is produced" headingId="how">
        <p className="type-body">
          Software reads the text of the documents you attach and compares it
          against a reference list of what your trade is normally asked to hold
          for that platform. Gap checks use deterministic extraction and matching
          rather than a language model. Generated programs are a separate workflow
          built only from the company details and questionnaire answers you provide.
          Every gap-check item points at the file and phrase behind it.
        </p>
        <p className="type-body">
          The limits of that are stated in the review itself rather than left
          for you to discover. A file we could not open is listed as unread, not
          skipped quietly. Anything the reference list is silent on comes back
          as a question rather than a claim. Where we cite an OSHA standard, the
          citation was retrieved from the eCFR and checked against its subject —
          if it does not check out, it is dropped rather than shown with a
          caveat.
        </p>
      </PageSection>

      <PageSection heading="What we are not" headingId="not">
        <ul className="space-y-4">
          <li className="type-body flex gap-3">
            <span
              aria-hidden="true"
              className="mt-[0.7em] h-px w-4 shrink-0 bg-verdigris"
            />
            <span>
              <strong className="font-semibold text-millscale">
                Not affiliated with ISNetworld or Avetta.
              </strong>{" "}
              No partnership, no endorsement, no relationship of any kind. Those
              names appear here because they are what your hiring client is
              telling you to register in, and they belong to their owners.
            </span>
          </li>
          <li className="type-body flex gap-3">
            <span
              aria-hidden="true"
              className="mt-[0.7em] h-px w-4 shrink-0 bg-verdigris"
            />
            <span>
              <strong className="font-semibold text-millscale">
                Not your portal operator.
              </strong>{" "}
              We do not enter your private platform account or submit on your
              behalf. CertLoop can automatically generate the four supported
              program types; other preparation may be offered as separately
              scoped human assistance. You still review and file the work.
            </span>
          </li>
          <li className="type-body flex gap-3">
            <span
              aria-hidden="true"
              className="mt-[0.7em] h-px w-4 shrink-0 bg-verdigris"
            />
            <span>
              <strong className="font-semibold text-millscale">
                Not a compliance determination.
              </strong>{" "}
              A gap check helps you prepare your own submission. It is not legal
              advice and it is not a ruling on whether you meet a particular
              regulation.
            </span>
          </li>
        </ul>
      </PageSection>

      <PageSection heading="What it costs" headingId="free">
        <p className="type-body">
          The gap check is free. There is no card, no account to create, and
          nothing that turns into a subscription. Paid help assembling the
          documents is a separate thing you would ask for on purpose.
        </p>
        <p className="type-body">
          <Link
            href={GAP_CHECK_HREF}
            className="text-verdigris underline decoration-zinc-dust underline-offset-4 transition-colors hover:decoration-verdigris"
          >
            Start a gap check
          </Link>{" "}
          to see what comes back.
        </p>
      </PageSection>
    </main>
  );
}
