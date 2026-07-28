import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Info,
  ShieldCheck,
} from "lucide-react";

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

/**
 * The reasoning behind an item, folded away until asked for.
 *
 * Everything traceable stays in the page and in the DOM — the basis, the
 * source, the standards — but a contractor should not have to read a CFR
 * heading to find out whether they are missing a document. Native <details>,
 * so it costs no JavaScript, works with a keyboard, and stays selectable and
 * searchable in the page while closed.
 *
 * What is deliberately NOT in here: the requirement, the status and the
 * action. Those are the answer, and folding the answer away would be a
 * different product.
 */
function Reasoning({ item }: { item: AnalysisItem }) {
  return (
    <details className="mt-3 border-t border-zinc-dust pt-3">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm text-slate-wash select-none hover:text-verdigris [&::-webkit-details-marker]:hidden">
        {/* Two icons swapped by display, not one rotated: a transform on a
            descendant of <summary> does not apply. See globals.css. */}
        <ChevronRight
          aria-hidden
          className="disclosure-icon-closed h-3.5 w-3.5 shrink-0"
        />
        <ChevronDown
          aria-hidden
          className="disclosure-icon-open h-3.5 w-3.5 shrink-0"
        />
        Why we say this
      </summary>

      <div className="mt-2.5">
        <p className="text-xs tracking-wide text-slate-wash uppercase">
          {SOURCE_LABEL[item.source]}
        </p>
        <Basis item={item} />
        <Citations item={item} />
      </div>
    </details>
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

      {item.action ? (
        <p className="mt-2 text-sm text-slate-wash">
          <span className="text-millscale">Next:</span> {item.action}
        </p>
      ) : null}

      <Reasoning item={item} />
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
      {item.action ? (
        <p className="mt-2 text-sm text-slate-wash">
          <span className="text-millscale">Next:</span> {item.action}
        </p>
      ) : null}
      <Reasoning item={item} />
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
  /*
   * Grouped by what the reader needs, not by how sure we are.
   *
   * The old grouping was three confidence bands — reasonably sure, likely,
   * couldn't establish — which is how the review is produced rather than how
   * it is read. Someone opening this wants "what am I missing" first and
   * "what's fine" second, and had to work that out by reading every card in
   * all three bands.
   *
   * The one rule that could not be dropped in the reshuffle: a low-confidence
   * item is never stated as a fact. It is preserved structurally rather than
   * by convention — anything low goes to `Question`, whatever its status, and
   * that component has no access to STATUS_LABEL, so a status cannot be
   * printed there even by mistake. This filter is therefore ordered with the
   * confidence test FIRST, so a low-confidence "present" cannot slip into the
   * covered group by matching on status alone.
   */
  const stated = review.items.filter((item) => item.confidence !== "low");

  const missing = stated.filter((item) => item.status === "likely_missing");
  const covered = stated.filter((item) => item.status === "present");

  // Everything we are not willing to assert: low confidence at any status,
  // plus the unknowns, which have nothing behind them by definition.
  const unresolved = review.items.filter(
    (item) => item.confidence === "low" || item.status === "unknown",
  );

  // Nothing readable came back, so every item is an unknown and expanding all
  // of them is the whole catalogue printed at someone — it reads as though the
  // tool did nothing. Same collapse the email makes, for the same reason.
  const collapsed =
    review.items.length > 0 &&
    review.items.every((item) => item.status === "unknown");

  /*
   * The conclusion, in one line, before anything else.
   *
   * A count is the fastest true thing that can be said here. It states what
   * was searched for and not found — it does not say the contractor is
   * non-compliant or that these are required of them, which are claims this
   * product does not make anywhere.
   */
  const headline =
    missing.length > 0
      ? `${missing.length} of the ${stated.length} document types we checked ${missing.length === 1 ? "wasn't" : "weren't"} mentioned in what you sent.`
      : covered.length > 0
        ? "Everything we could check was mentioned somewhere in what you sent."
        : "We couldn't check anything against your file yet.";

  return (
    <div>
      <div className="border border-verdigris bg-paper p-5 md:p-6">
        <p className="tag">The short version</p>
        <p className="type-h3 mt-3 text-millscale">{headline}</p>
        <p className="type-body mt-3">{review.summary}</p>
      </div>

      {/*
       * The standing limitation, once, under the conclusion rather than above
       * it. It has to be on the page and it has to be unmissable, but leading
       * with it meant the first thing a contractor read was a disclaimer
       * rather than their answer.
       */}
      <div className="mt-4 flex gap-3 border border-zinc-dust bg-paper p-5">
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
          {missing.length > 0 ? (
            <Section
              title="What looks missing"
              blurb="Not mentioned anywhere in what you sent. Start here."
            >
              {missing.map((item) => (
                <Finding key={item.requirement} item={item} />
              ))}
            </Section>
          ) : null}

          {covered.length > 0 ? (
            <Section
              title="What looks covered"
              blurb="Found in your documents. That the subject is covered doesn't mean the document is good enough — a programme can mention something and still come back for revision."
            >
              {covered.map((item) => (
                <Finding key={item.requirement} item={item} />
              ))}
            </Section>
          ) : null}

          {unresolved.length > 0 ? (
            <Section
              title="Worth checking yourself"
              blurb="We don't have enough to say either way on these."
            >
              {unresolved.map((item) => (
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
