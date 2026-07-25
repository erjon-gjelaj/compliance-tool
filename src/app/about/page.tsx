import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro, PageSection } from "@/components/page-intro";
import { SITE_NAME } from "@/lib/constants";
import { GAP_CHECK_HREF } from "@/lib/nav";

const PAGE_TITLE = "About";

const PAGE_DESCRIPTION =
  `What ${SITE_NAME} does for small industrial subcontractors trying to get ` +
  "through ISNetworld or Avetta prequalification, what it deliberately " +
  "doesn't do, and why the gap check is free while the work is still done " +
  "by hand.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/about" },
  openGraph: {
    type: "article",
    siteName: SITE_NAME,
    title: `${PAGE_TITLE} | ${SITE_NAME}`,
    description: PAGE_DESCRIPTION,
    url: "/about",
    locale: "en_US",
  },
};

export default function AboutPage() {
  return (
    <main className="flex-1">
      <PageIntro
        tag="About"
        tickId="tick-about"
        title="What this is, and what it isn't yet"
      >
        <p>
          {SITE_NAME} tells a small industrial subcontractor what their
          ISNetworld or Avetta file is still missing — before they put a
          consultant on retainer to find out.
        </p>
      </PageIntro>

      <PageSection heading="The situation this is built around" headingId="origin">
        <p className="type-body">
          A refinery, mill, or plant tells a crew of eight or twenty that they
          have to be registered and approved in ISNetworld or Avetta before
          they can come through the gate. The deadline belongs to somebody
          else. It is usually tied to a shutdown already on the calendar, and
          the work does not start until the file is accepted.
        </p>
        <p className="type-body">
          Almost none of these companies have a safety manager. It is the
          owner, or the office manager who also runs payroll, reading a portal
          at nine at night trying to work out what a written program is
          supposed to contain and whether the one they have counts.
        </p>
        <p className="type-body">
          That is a bad position to be in, and the existing ways out of it are
          expensive, slow, or generic. This site is aimed at exactly that
          moment and nothing else.
        </p>
      </PageSection>

      <PageSection heading="What you get today" headingId="today">
        <p className="type-body">
          You tell us your trade, who is asking you to register, and roughly
          how many people you run. Someone here reads it and sends back a
          written list of what your file still looks short on, ordered so the
          things most likely to hold up approval come first. No charge, no
          account, nothing to install.
        </p>
        <p className="type-body">
          Being straight about the machinery: there is no dashboard behind this
          page and nothing is scoring your file. The comparison is done by
          hand. That is slower than a form that answers instantly, and it is
          the reason the answer is worth reading — it was written by a person
          who looked at your specific situation rather than matched you to a
          template.
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
              <strong className="font-display font-semibold text-millscale">
                Not affiliated with ISNetworld or Avetta.
              </strong>{" "}
              No partnership, no endorsement, no relationship of any kind.
              Those names appear here because they are what your hiring client
              is telling you to register in, and they belong to their owners.
            </span>
          </li>
          <li className="type-body flex gap-3">
            <span
              aria-hidden="true"
              className="mt-[0.7em] h-px w-4 shrink-0 bg-verdigris"
            />
            <span>
              <strong className="font-display font-semibold text-millscale">
                Not a consultant.
              </strong>{" "}
              We do not write your programs, gather your records, or submit
              anything on your behalf. Your account stays yours and you file
              your own submission.
            </span>
          </li>
          <li className="type-body flex gap-3">
            <span
              aria-hidden="true"
              className="mt-[0.7em] h-px w-4 shrink-0 bg-verdigris"
            />
            <span>
              <strong className="font-display font-semibold text-millscale">
                Not a compliance determination.
              </strong>{" "}
              A gap check helps you prepare your own submission. It is not
              legal advice and it is not a ruling on whether you meet a
              particular regulation.
            </span>
          </li>
        </ul>
      </PageSection>

      <PageSection heading="Why the gap check is free" headingId="free">
        <p className="type-body">
          Because at this stage, knowing what actually trips people up is worth
          more to us than charging for it. Every gap check tells us something
          concrete — which trades get stuck, which hiring clients ask for
          something unusual, which documents come back for revision. That is
          the thing worth having right now.
        </p>
        <p className="type-body">
          If we later offer paid help actually assembling the documents with
          you, it will be a separate decision you make on purpose. Nothing here
          starts a trial that turns into a bill.
        </p>
      </PageSection>

      <PageSection heading="Where this goes next" headingId="next">
        <p className="type-body">
          The comparison should eventually be automatic: pick your trade and
          your hiring client, get the list back in seconds. We are not going to
          fake that step in the meantime by having software guess at safety
          requirements. Getting this wrong does not produce a bad user
          experience — it produces a small business owner who believes they are
          covered when they are not. So the manual version runs until the
          automatic one is genuinely right.
        </p>
        <p className="type-body">
          <Link
            href={GAP_CHECK_HREF}
            className="text-verdigris underline decoration-zinc-dust underline-offset-4 transition-colors hover:decoration-verdigris"
          >
            Ask for a gap check
          </Link>{" "}
          if you want to see what that looks like in practice.
        </p>
      </PageSection>
    </main>
  );
}
