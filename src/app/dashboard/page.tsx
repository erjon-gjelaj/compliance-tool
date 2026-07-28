import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  ChevronRight,
  FileText,
  FileWarning,
  HelpCircle,
  Paperclip,
} from "lucide-react";

import { CONTACT_EMAIL, SITE_NAME } from "@/lib/constants";
import { pageMetadata } from "@/lib/metadata";
import { formatBytes } from "@/lib/uploads";
import { currentClient } from "@/lib/auth/session";
import {
  getReviewForSubmission,
  listDocumentsForEmail,
  listSubmissionsForEmail,
  type DashboardSubmission,
  type LibraryDocument,
} from "@/lib/dashboard";
import { buildWorkspace, submissionHeadline, type Workspace } from "@/lib/workspace";
import { DocumentDownload } from "@/components/document-download";

export const metadata = pageMetadata({
  title: "Your workspace",
  description: `Where your ${SITE_NAME} requests, documents and reviews live.`,
  path: "/dashboard",
  robots: { index: false, follow: false },
});

export const dynamic = "force-dynamic";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * The one thing worth doing, at the top, at full size.
 *
 * There is exactly one of these on the page on purpose. Two competing primary
 * actions is the same as none — the point of the panel is that someone can
 * open this page, read one sentence and know what to do.
 */
function NextAction({ next }: { next: Workspace["next"] }) {
  return (
    <section
      aria-labelledby="next-heading"
      className="border border-verdigris bg-paper p-6 md:p-7"
    >
      <p className="tag">Do this next</p>
      <h2 id="next-heading" className="type-h3 mt-3 text-millscale">
        {next.title}
      </h2>
      <p className="type-body mt-2 max-w-xl">{next.detail}</p>
      <Link href={next.href} className="btn-primary mt-5 inline-flex items-center gap-2">
        {next.cta}
        <ArrowRight aria-hidden className="h-4 w-4" />
      </Link>
    </section>
  );
}

/** A section that only renders when it has something real in it. */
function Panel({
  heading,
  id,
  note,
  children,
}: {
  heading: string;
  id: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="mt-10">
      <h2 id={id} className="type-h3 text-millscale">
        {heading}
      </h2>
      {note ? <p className="type-body mt-2 max-w-xl">{note}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function DocumentRow({ document }: { document: LibraryDocument }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border border-zinc-dust bg-paper p-4">
      <div className="flex min-w-0 gap-3">
        {document.readable ? (
          <FileText aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-slate-wash" />
        ) : (
          <FileWarning aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-rust-flag" />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-millscale">
            {document.file_name}
          </p>
          <p className="text-xs text-slate-wash">
            {formatBytes(document.size_bytes)} &middot; sent{" "}
            {formatDate(document.created_at)}
            {document.readable ? null : (
              <span className="text-rust-flag"> &middot; we could not read this</span>
            )}
          </p>
        </div>
      </div>

      <DocumentDownload documentId={document.id} fileName={document.file_name} />
    </li>
  );
}

function SubmissionRow({ row }: { row: DashboardSubmission }) {
  const state =
    row.status === "partial"
      ? { label: `Unfinished — stopped at step ${row.last_step} of 4`, tone: "text-rust-flag" }
      : row.analysis_status === "ok"
        ? { label: "Review ready", tone: "text-verdigris" }
        : row.analysis_status === "pending"
          ? { label: "Review running", tone: "text-slate-wash" }
          : row.analysis_status === "fallback"
            ? { label: "No review — we emailed you instead", tone: "text-slate-wash" }
            : { label: "Received", tone: "text-slate-wash" };

  return (
    <li>
      <Link
        href={`/dashboard/${row.id}`}
        className="flex items-start justify-between gap-4 border border-zinc-dust bg-paper p-5 transition-colors hover:border-verdigris"
      >
        <div>
          <p className="tag">{submissionHeadline(row)}</p>
          <p className="type-label mt-1.5 text-millscale">
            {row.trade} &middot; {row.platform}
          </p>
          <p className="mt-1 text-sm text-slate-wash">
            For {row.hiring_client} &middot; sent {formatDate(row.created_at)}
          </p>
          <p className={`mt-3 text-sm font-medium ${state.tone}`}>{state.label}</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-wash">
            <Paperclip aria-hidden className="h-3.5 w-3.5 shrink-0" />
            {row.documentCount === 0
              ? "No documents attached"
              : `${row.documentCount} document${row.documentCount === 1 ? "" : "s"}`}
          </p>
        </div>
        <ChevronRight aria-hidden className="mt-1 h-5 w-5 shrink-0 text-zinc-dust" />
      </Link>
    </li>
  );
}

/**
 * The empty state.
 *
 * Reachable two ways: a first-time visit from someone who signed in before
 * sending anything, and a deletion request that was honoured. It reads as a
 * normal state either way and points at the doors rather than at one form.
 */
function Empty() {
  return (
    <div className="border border-zinc-dust bg-paper p-8">
      <FileText aria-hidden className="mb-4 h-5 w-5 text-slate-wash" />
      <h2 className="type-h3 text-millscale">Nothing here yet</h2>
      <p className="type-body mt-3 max-w-xl">
        There are no requests against this address. If you asked us to delete
        your file, it is gone, documents included.
      </p>
      <Link href="/" className="btn-primary mt-6">
        Start a request
      </Link>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await currentClient();
  if (!session) redirect("/sign-in");

  const [submissions, documents] = await Promise.all([
    listSubmissionsForEmail(session.email),
    listDocumentsForEmail(session.email),
  ]);

  /*
   * The workspace leads on the most recent finished request. Blockers and
   * questions come from that one review rather than from all of them merged:
   * a gap closed in June should not still be listed because an older review
   * found it, and merging reviews across dates would do exactly that.
   */
  const activeSubmission =
    submissions.find((row) => row.status === "complete") ?? null;

  const activeReview = activeSubmission
    ? await getReviewForSubmission(activeSubmission.id)
    : null;

  const workspace = buildWorkspace({
    submissions,
    documents,
    activeReview,
    activeSubmission,
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="type-h2 text-millscale">Your workspace</h1>
      <p className="type-body mt-2">
        Signed in as <span className="text-millscale">{session.email}</span>
        {workspace.platforms.length > 0 ? (
          <> &middot; {workspace.platforms.join(", ")}</>
        ) : null}
        {workspace.nextDeadline ? (
          <>
            {" "}
            &middot; {workspace.nextDeadline.hiringClient} wants you approved by{" "}
            <span className="text-millscale">
              {formatDate(workspace.nextDeadline.date)}
            </span>
          </>
        ) : null}
      </p>

      {submissions.length === 0 ? (
        <div className="mt-8">
          <Empty />
        </div>
      ) : (
        <>
          <div className="mt-8">
            <NextAction next={workspace.next} />
          </div>

          {workspace.blockers.length > 0 ? (
            <Panel
              heading="What's holding you up"
              id="blockers-heading"
              note="Not mentioned anywhere in the documents you sent. That is a text search rather than a judgement — if one of these is covered in a file you haven't sent us, it will say the same thing."
            >
              <ul className="grid gap-2">
                {workspace.blockers.map((item) => (
                  <li
                    key={item.requirement}
                    className="border border-zinc-dust bg-paper p-4"
                  >
                    <p className="type-label text-millscale">{item.requirement}</p>
                    <p className="mt-1.5 text-sm text-slate-wash">{item.action}</p>
                  </li>
                ))}
              </ul>
              {workspace.activeSubmission ? (
                <Link
                  href={`/dashboard/${workspace.activeSubmission.id}`}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-verdigris underline-offset-4 hover:underline"
                >
                  See the reasoning and the standards behind each one
                  <ArrowRight aria-hidden className="h-4 w-4" />
                </Link>
              ) : null}
            </Panel>
          ) : null}

          {workspace.unreadable.length > 0 ? (
            <Panel
              heading="Files we couldn't read"
              id="unreadable-heading"
              note="These were not assessed. Sending a version we can read the text of is the only way to get them included."
            >
              <ul className="grid gap-2">
                {workspace.unreadable.map((name) => (
                  <li
                    key={name}
                    className="flex items-center gap-3 border border-zinc-dust bg-paper p-4 text-sm text-millscale"
                  >
                    <FileWarning aria-hidden className="h-4 w-4 shrink-0 text-rust-flag" />
                    {name}
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          {workspace.questions.length > 0 ? (
            <Panel
              heading="Still to confirm"
              id="questions-heading"
              note="Things we can't settle from here. Your hiring client's own list is the one that decides your file."
            >
              <ul className="grid gap-2">
                {workspace.questions.map((question) => (
                  <li
                    key={question}
                    className="flex gap-3 border border-zinc-dust bg-paper p-4"
                  >
                    <HelpCircle
                      aria-hidden
                      className="mt-0.5 h-4 w-4 shrink-0 text-slate-wash"
                    />
                    <p className="text-sm text-millscale">{question}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel
            heading="Your documents"
            id="documents-heading"
            note={
              documents.length === 0
                ? undefined
                : "Everything you've sent us, whichever request it came in on."
            }
          >
            {documents.length === 0 ? (
              <div className="border border-zinc-dust bg-paper p-6">
                <p className="type-body">
                  You haven&rsquo;t sent any documents yet. Reading a real one is
                  the difference between a list of questions and an answer about
                  your file &mdash; even an old or half-finished program is worth
                  attaching.
                </p>
              </div>
            ) : (
              <ul className="grid gap-2">
                {documents.map((document) => (
                  <DocumentRow key={document.id} document={document} />
                ))}
              </ul>
            )}
          </Panel>

          <Panel heading="Your requests" id="requests-heading">
            <ul className="grid gap-3">
              {submissions.map((row) => (
                <SubmissionRow key={row.id} row={row} />
              ))}
            </ul>
          </Panel>

          <p className="type-body mt-10 border-t border-zinc-dust pt-6">
            Need something that isn&rsquo;t here &mdash; a program prepared, a
            second opinion, a hand with a resubmission? Email{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-verdigris underline underline-offset-4"
            >
              {CONTACT_EMAIL}
            </a>{" "}
            and say what you need.
          </p>
        </>
      )}
    </main>
  );
}
