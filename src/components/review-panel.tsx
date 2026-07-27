import { AlertTriangle, HelpCircle, Info, ShieldCheck } from "lucide-react";

import { SITE_NAME } from "@/lib/constants";
import type { Analysis, AnalysisItem } from "@/lib/analysis/schema";

/**
 * The review, on screen.
 *
 * This is the same content as the review email and it is bound by the same
 * rules — the medium does not soften them. Specifically:
 *
 *  - Low-confidence items render as questions, never as assertions. That is
 *    enforced structurally here: the low group goes through a different
 *    component that cannot print a status, so a future edit cannot
 *    accidentally give it one.
 *  - Where a requirement comes from is always visible, and the three sources
 *    are never merged. An OSHA standard is law; an ISN/Avetta requirement is
 *    contractual and is ours to be wrong about; a hiring client's own
 *    requirement is something we cannot see and do not guess.
 *  - Citations are printed as references to a standard on the subject, not as
 *    proof that this contractor must do something, and only when the stored
 *    citation says it supports the claim.
 *  - Files that could not be read are listed in the open. Silence must never
 *    imply "reviewed and fine".
 *
 * Nothing here recomputes or reinterprets the review — it was validated
 * against the schema when it was produced and again when it was read back.
 * This component only decides how it looks.
 */

const SOURCE_LABEL: Record<AnalysisItem["source"], string> = {
  osha: "Required by OSHA",
  platform:
    "Commonly requested by ISNetworld/Avetta — our understanding, not law",
  hiring_client: "Specific to your hiring client — please confirm",
};

const STATUS_LABEL: Record<AnalysisItem["status"], string> = {
  present: "Looks present",
  likely_missing: "Looks missing",
  unknown: "Not established",
};

const STATUS_TONE: Record<AnalysisItem["status"], string> = {
  present: "text-verdigris",
  likely_missing: "text-rust-flag",
  unknown: "text-slate-wash",
};

const PRICE_BAND_COPY: Record<Analysis["priceBand"], string> = {
  low: "Toward the lower end — there doesn't look like a great deal to assemble.",
  medium: "Somewhere in the middle — a normal amount of work.",
  high: "Toward the higher end — there looks like a lot to put together.",
  unknown: "We don't have enough to estimate this yet.",
};

function Citations({ item }: { item: AnalysisItem }) {
  // supportsClaim is checked here as well as when the citation was retrieved.
  // A reference that does not support what it sits under is worse than no
  // reference at all — it lends borrowed authority to a line we are unsure of.
  const usable = item.citations.filter((citation) => citation.supportsClaim);
  if (usable.length === 0) return null;

  return (
    <div className="mt-3 border-l-2 border-zinc-dust pl-3">
      <p className="text-xs font-semibold tracking-wide text-slate-wash uppercase">
        OSHA standards on this subject
      </p>
      <ul className="mt-1.5 space-y-1.5">
        {usable.map((citation) => (
          <li key={citation.cfr} className="text-sm text-slate-wash">
            <span className="text-millscale">{citation.cfr}</span> &mdash;{" "}
            {citation.title}
            {citation.note ? (
              <span className="mt-0.5 block text-xs">{citation.note}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Basis({ item }: { item: AnalysisItem }) {
  return (
    <p className="mt-2 text-sm text-slate-wash">
      <span className="text-millscale">Based on:</span> {item.basis}
    </p>
  );
}

/** A finding we are willing to state. Statuses only ever appear here. */
function Finding({ item }: { item: AnalysisItem }) {
  return (
    <li className="border border-zinc-dust bg-paper p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h4 className="type-label text-millscale">{item.requirement}</h4>
        <span className={`text-sm font-medium ${STATUS_TONE[item.status]}`}>
          {STATUS_LABEL[item.status]}
        </span>
      </div>

      <p className="mt-1 text-xs tracking-wide text-slate-wash uppercase">
        {SOURCE_LABEL[item.source]}
      </p>

      <Basis item={item} />
      {item.action ? (
        <p className="mt-2 text-sm text-slate-wash">
          <span className="text-millscale">Next:</span> {item.action}
        </p>
      ) : null}

      <Citations item={item} />
    </li>
  );
}

/**
 * A thing we could not establish, rendered as a question.
 *
 * Deliberately a separate component with no access to STATUS_LABEL. The rule
 * is that a low-confidence item is never stated as a fact, and the cheapest
 * way to keep that true is to make it impossible to express here.
 */
function Question({ item }: { item: AnalysisItem }) {
  return (
    <li className="border border-zinc-dust bg-paper p-5">
      <h4 className="type-label text-millscale">
        {item.requirement} &mdash; does this apply to you?
      </h4>
      <p className="mt-1 text-xs tracking-wide text-slate-wash uppercase">
        {SOURCE_LABEL[item.source]}
      </p>
      <Basis item={item} />
      {item.action ? (
        <p className="mt-2 text-sm text-slate-wash">
          <span className="text-millscale">Next:</span> {item.action}
        </p>
      ) : null}
      <Citations item={item} />
    </li>
  );
}

function Section({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h3 className="type-h3 text-millscale">{title}</h3>
      {blurb ? <p className="type-body mt-1">{blurb}</p> : null}
      <ul className="mt-4 grid gap-3">{children}</ul>
    </section>
  );
}

export function ReviewPanel({
  review,
  unreadableFiles,
}: {
  review: Analysis;
  /**
   * Passed in from the document rows rather than taken from the review, so
   * the list reflects the files as they stand now.
   */
  unreadableFiles: string[];
}) {
  const confident = review.items.filter((item) => item.confidence === "high");
  const probable = review.items.filter((item) => item.confidence === "medium");
  const uncertain = review.items.filter((item) => item.confidence === "low");

  // Nothing readable came back, so every item is an unknown and expanding all
  // of them is the whole catalogue printed at someone — it reads as though the
  // tool did nothing. Same collapse the email makes, for the same reason.
  const collapsed =
    review.items.length > 0 &&
    review.items.every((item) => item.status === "unknown");

  return (
    <div>
      <div className="flex gap-3 border border-zinc-dust bg-paper p-5">
        <Info aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-slate-wash" />
        <div>
          <p className="type-label text-millscale">
            Preliminary automated review — not a certified audit
          </p>
          <p className="type-body mt-2">
            Software read what you sent and compared it against the documents
            these platforms commonly ask for. No person has checked it, it is
            not a compliance determination, and it is not legal advice. Confirm
            anything here with your hiring client before acting on it &mdash;
            they set the requirements and they decide.
          </p>
        </div>
      </div>

      <p className="type-body mt-6 text-millscale">{review.summary}</p>

      {unreadableFiles.length > 0 ? (
        <div className="mt-6 flex gap-3 border border-rust-flag bg-paper p-5">
          <AlertTriangle
            aria-hidden
            className="mt-0.5 h-5 w-5 shrink-0 text-rust-flag"
          />
          <div>
            <p className="type-label text-millscale">
              {unreadableFiles.length} file
              {unreadableFiles.length === 1 ? " was" : "s were"} not read
            </p>
            <p className="type-body mt-2">
              Nothing above takes{" "}
              {unreadableFiles.length === 1 ? "it" : "them"} into account:
            </p>
            <ul className="mt-2 space-y-1">
              {unreadableFiles.map((name) => (
                <li key={name} className="font-mono text-xs text-millscale">
                  {name}
                </li>
              ))}
            </ul>
            <p className="type-body mt-3">
              These are almost always scans or photographs of paper &mdash;
              there is no text inside them to search, only a picture of text.
              Send the original the document was written in, re-export the PDF
              from that original, or re-save the scan with text recognition
              turned on, and reply to your review email so we can run it again.
            </p>
          </div>
        </div>
      ) : null}

      {collapsed ? (
        <Section
          title="What we'd normally look for"
          blurb="The document types most often asked for at prequalification. We couldn't check any of these against your file yet."
        >
          {review.items.map((item) => (
            <li
              key={item.requirement}
              className="border border-zinc-dust bg-paper px-5 py-3"
            >
              <span className="type-label text-millscale">
                {item.requirement}
              </span>
              <span className="mt-0.5 block text-xs tracking-wide text-slate-wash uppercase">
                {SOURCE_LABEL[item.source]}
              </span>
            </li>
          ))}
        </Section>
      ) : (
        <>
          {confident.length > 0 ? (
            <Section title="What we're reasonably sure of">
              {confident.map((item) => (
                <Finding key={item.requirement} item={item} />
              ))}
            </Section>
          ) : null}

          {probable.length > 0 ? (
            <Section title="What looks likely, but worth checking">
              {probable.map((item) => (
                <Finding key={item.requirement} item={item} />
              ))}
            </Section>
          ) : null}

          {uncertain.length > 0 ? (
            <Section
              title="Things we couldn't establish"
              blurb="Check these yourself — we don't have enough to say either way."
            >
              {uncertain.map((item) => (
                <Question key={item.requirement} item={item} />
              ))}
            </Section>
          ) : null}
        </>
      )}

      {review.questionsForClient.length > 0 ? (
        <section className="mt-8">
          <h3 className="type-h3 text-millscale">
            {collapsed ? "Start here" : "Questions for you"}
          </h3>
          <p className="type-body mt-1">
            {collapsed
              ? "These are the things that would let us give you a real answer."
              : "We couldn't answer these from what we had."}
          </p>
          <ul className="mt-4 grid gap-2">
            {review.questionsForClient.map((question) => (
              <li
                key={question}
                className="flex gap-2.5 border border-zinc-dust bg-paper p-4"
              >
                <HelpCircle
                  aria-hidden
                  className="mt-0.5 h-4 w-4 shrink-0 text-slate-wash"
                />
                <span className="text-sm text-millscale">{question}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {review.warnings.length > 0 ? (
        <section className="mt-8">
          <h3 className="type-h3 text-millscale">Where we stop short</h3>
          <ul className="mt-4 grid gap-2">
            {review.warnings.map((warning) => (
              <li
                key={warning.code}
                className="flex gap-2.5 border border-zinc-dust bg-paper p-4"
              >
                <ShieldCheck
                  aria-hidden
                  className="mt-0.5 h-4 w-4 shrink-0 text-slate-wash"
                />
                <span className="text-sm text-slate-wash">
                  {warning.message}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8 border border-zinc-dust bg-paper p-5">
        <h3 className="type-h3 text-millscale">
          {review.priceBand === "unknown" ? "About pricing" : "What this would cost"}
        </h3>
        <p className="type-body mt-2">{PRICE_BAND_COPY[review.priceBand]}</p>
        <p className="type-body mt-2">
          This is an indicative band and not a quote. It is not binding, and
          we&rsquo;d confirm a real number on a short call once we understand
          your file.
        </p>
      </section>

      <p className="mt-8 border-t border-zinc-dust pt-5 text-xs text-slate-wash">
        Reference data version {review.referenceVersion}. {SITE_NAME} is an
        independent service and is not affiliated with, endorsed by, or acting
        on behalf of ISNetworld, Avetta, or any hiring client.
      </p>
    </div>
  );
}
