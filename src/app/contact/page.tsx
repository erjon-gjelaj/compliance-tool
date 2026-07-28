import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import { pageMetadata } from "@/lib/metadata";
import { PageIntro, PageSection } from "@/components/page-intro";
import { MessageForm } from "@/components/message-form";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/constants";
import { GAP_CHECK_HREF } from "@/lib/nav";

const PAGE_TITLE = "Contact";

const PAGE_DESCRIPTION =
  `How to reach ${SITE_NAME}: the gap-check form for a prequalification ` +
  "review, a message form for everything else, and the email address itself " +
  "if you would rather use your own client.";

export const metadata: Metadata = pageMetadata({
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  path: "/contact",
});

const INCLUDE_IN_MESSAGE = [
  "Your trade, and what the crew actually does on site",
  "Who is asking you to register, and whether it is ISNetworld, Avetta, or something else",
  "Roughly how many people you run",
  "The date you are working towards, if there is one",
];

export default function ContactPage() {
  return (
    <main className="flex-1">
      <PageIntro tag="Contact" tickId="tick-contact" title="Getting hold of us">
        <p>
          Two forms and one email address, all landing in the same inbox and
          read by the same person. No ticket portal, no phone tree, no queue.
        </p>
      </PageIntro>

      <PageSection heading="For a gap check, use the form" headingId="form">
        <p className="type-body">
          It is the fastest route, and it asks the four things we need before
          anyone can say anything useful: your trade, who is asking, roughly how
          many people you run, and where to send the answer. Emailing instead
          just means we write back asking for the same four things.
        </p>
        <p>
          <Link href={GAP_CHECK_HREF} className="btn-primary mt-2">
            Go to the gap check
            <ArrowRight
              aria-hidden="true"
              strokeWidth={2}
              className="h-4 w-4"
            />
          </Link>
        </p>
      </PageSection>

      <PageSection heading="For anything else, send a message" headingId="message">
        <p className="type-body">
          Questions about the process, a deadline that is tighter than usual, a
          hiring client asking for something you have not seen before, or a
          straight complaint — all fine, all read by a person.
        </p>
        <p className="type-body">
          Four things make the first reply worth more than an acknowledgement:
        </p>
        <ul className="space-y-3">
          {INCLUDE_IN_MESSAGE.map((item) => (
            <li key={item} className="type-body flex gap-3">
              <span
                aria-hidden="true"
                className="mt-[0.7em] h-px w-4 shrink-0 bg-verdigris"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <div className="pt-4">
          <MessageForm />
        </div>

        <p className="type-body">
          Or write to us from your own email client, if that is easier or you
          need to attach something —{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="inline-flex items-baseline gap-1.5 text-verdigris underline decoration-zinc-dust underline-offset-4 transition-colors hover:decoration-verdigris"
          >
            <Mail
              aria-hidden="true"
              strokeWidth={1.5}
              className="h-4 w-4 self-center"
            />
            {CONTACT_EMAIL}
          </a>
          . The form does not take attachments.
        </p>
      </PageSection>

      <PageSection heading="What we can't help with" headingId="limits">
        <p className="type-body">
          We cannot tell you whether you comply with a given regulation. That is
          a qualified safety professional&apos;s call, not ours, and treating
          our answer as that would be a mistake with real consequences.
        </p>
        <p className="type-body">
          We cannot act on your ISNetworld or Avetta account, and we will not
          ask you for the login. If anyone offering this kind of help does ask,
          that is worth a second thought.
        </p>
        <p className="type-body">
          And if something is happening on a job site right now, this is the
          wrong channel entirely — an inbox checked during business hours is no
          use to anyone in that situation.
        </p>
      </PageSection>

      <PageSection heading="What to expect" headingId="expect">
        <p className="type-body">
          A message here reaches a person, usually within a few business days.
          There is no phone line yet; when there is, it will be listed on this
          page.
        </p>
      </PageSection>
    </main>
  );
}
