import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/metadata";
import { PageIntro } from "@/components/page-intro";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/constants";
import { GAP_CHECK_HREF } from "@/lib/nav";

const PAGE_TITLE = "FAQ";

const PAGE_DESCRIPTION =
  "What a free gap check gives you, how long it takes, what it costs, and " +
  "the things we deliberately don't do — including submitting to " +
  "ISNetworld or Avetta on your behalf.";

export const metadata: Metadata = pageMetadata({
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  path: "/faq",
});

/*
 * Answers are plain paragraphs so the same array feeds both the rendered
 * page and the structured data below — no chance of the two drifting.
 *
 * TODO-VERIFY: nothing here states what any platform or regulation
 * specifically requires, and it should stay that way. Answers describe our
 * own process and limits only. Adding a concrete requirement (a program
 * name, a certification, a score threshold, a deadline) needs a real source
 * against it first — see the regulatory content rules in business-model.md.
 */
const FAQS: { question: string; answer: string[] }[] = [
  {
    question: "What do I actually get back?",
    answer: [
      "An email written by a person, listing what your prequalification file still looks short on. It is grouped the way these platforms ask for things — written programs, training records, insurance documents — and ordered so whatever is most likely to hold up approval sits at the top.",
      "It is plain writing, not a generated PDF with a score on it. If part of your file already looks fine, we say that too, because knowing what you can leave alone saves you as much time as knowing what is missing.",
    ],
  },
  {
    question: "How long does it take?",
    answer: [
      "Longer than something instant, because a person reads every one. We aim to come back within a few business days, and if yours is going to take longer than that we would rather tell you than leave you refreshing your inbox.",
      "If you are working towards a fixed date, email us and say what it is. We will tell you honestly whether we can be useful in time, including when the answer is no.",
    ],
  },
  {
    question: "What does it cost?",
    answer: [
      "The gap check is free. There is no card, no account, and nothing that turns into a subscription later.",
      "We may eventually charge for the heavier job of actually assembling the documents with you. That would be a separate thing you choose on purpose, not a trial quietly converting.",
    ],
  },
  {
    question: "Do you submit to ISNetworld or Avetta for me?",
    answer: [
      "No. Your account stays yours and you file your own submission. We tell you what to gather; we do not log in as you or upload anything on your behalf.",
      "That is deliberate. Handing your portal credentials to a third party is a bad habit for a contractor to get into, and we are not going to be the ones to start you on it.",
    ],
  },
  {
    question: `Are you connected to ISNetworld or Avetta?`,
    answer: [
      `No. ${SITE_NAME} is independent — not a partner, not a reseller, not endorsed by either. Their names appear on this site because they are what your hiring client is telling you to register in.`,
    ],
  },
  {
    question: "Is a gap check a compliance determination?",
    answer: [
      "No, and this is the one worth reading twice. A gap check is guidance to help you prepare your own submission. It is not legal advice, and it is not a ruling on whether you meet any particular regulation.",
      "If you need something authoritative — because a client, an insurer, or a regulator is asking — that is a qualified safety professional, or the platform's own requirements documentation. We will say so when that is the honest answer.",
    ],
  },
  {
    question: "Why not just hire a consultant?",
    answer: [
      "Sometimes you should, and we will tell you when we think that is the right call. A good compliance consultant will do the whole job and do it properly.",
      "The catch for a small crew is that it means a retainer and a turnaround, and neither tends to fit a shutdown date already on the calendar. A gap check is the cheaper first move: find out how big the job actually is before deciding who does it.",
    ],
  },
  {
    question: "Why not just buy a template pack?",
    answer: [
      "Because the requirement is not generic. What gets asked of a scaffolding crew is not what gets asked of an industrial cleaning crew, and two hiring clients on the same platform can want different things from the same trade.",
      "A written program that does not describe how your crew actually works is the kind of thing that comes back for revision — which costs you the weeks you were trying to save.",
    ],
  },
  {
    question: "My trade isn't in your list.",
    answer: [
      "Pick Other. The field for who is asking you to register is free text, so put the actual plant or client name in there and we will work from that.",
      "The trades in the dropdown are the ones we see most, not a limit on who we will help.",
    ],
  },
  {
    question: "What happens to what I put in the form?",
    answer: [
      "Four things are stored: your trade, who asked you to register, roughly how many people you run, and your email address. They go into our own database and are used to answer you.",
      "We do not sell them, and we do not pass them to a hiring client or to a prequalification platform.",
    ],
  },
  {
    question: "Who is behind this?",
    answer: [
      "A small and genuinely early operation — early enough that a person still reads every submission by hand. There is no team page here because inventing one would be the first dishonest thing on the site.",
      "If it matters to you who you are dealing with before you send anything over, email and ask. That is a fair question and you will get a straight answer.",
    ],
  },
];

/*
 * FAQPage structured data. Google has narrowed FAQ rich results to a small
 * set of authoritative sites, so this is unlikely to change how the page
 * looks in search — it is here because it is an accurate machine-readable
 * description of the page, and it costs one script tag.
 */
function FaqSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: {
        "@type": "Answer",
        text: answer.join(" "),
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export default function FaqPage() {
  return (
    <main className="flex-1">
      <FaqSchema />

      <PageIntro
        tag="FAQ"
        tickId="tick-faq"
        title="Before you fill anything in"
      >
        <p>
          The questions worth answering up front — including the ones where the
          honest answer is that we are not the right people to ask.
        </p>
      </PageIntro>

      <section aria-labelledby="faq-list-heading">
        <h2 id="faq-list-heading" className="sr-only">
          Frequently asked questions
        </h2>
        <div className="mx-auto max-w-5xl px-6 py-14 md:py-16">
          <dl className="grid gap-px border border-zinc-dust bg-zinc-dust">
            {FAQS.map(({ question, answer }) => (
              <div key={question} className="bg-paper p-6 md:p-8">
                <dt className="type-h3 max-w-2xl">{question}</dt>
                <dd className="mt-3 max-w-2xl space-y-3">
                  {answer.map((paragraph) => (
                    <p key={paragraph} className="type-body">
                      {paragraph}
                    </p>
                  ))}
                </dd>
              </div>
            ))}
          </dl>

          <p className="type-body mt-10 max-w-2xl">
            Something not covered here?{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-verdigris underline decoration-zinc-dust underline-offset-4 transition-colors hover:decoration-verdigris"
            >
              {CONTACT_EMAIL}
            </a>
            , or{" "}
            <Link
              href={GAP_CHECK_HREF}
              className="text-verdigris underline decoration-zinc-dust underline-offset-4 transition-colors hover:decoration-verdigris"
            >
              go straight to the gap check
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
