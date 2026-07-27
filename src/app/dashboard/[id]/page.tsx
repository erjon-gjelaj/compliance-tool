import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileText, FileWarning } from "lucide-react";

import { CONTACT_EMAIL, SITE_NAME } from "@/lib/constants";
import { pageMetadata } from "@/lib/metadata";
import { formatBytes } from "@/lib/uploads";
import { currentClient } from "@/lib/auth/session";
import {
  getReviewForSubmission,
  getSubmissionForEmail,
  listDocumentsForSubmission,
  type DocumentView,
} from "@/lib/dashboard";
import { ReviewPanel } from "@/components/review-panel";
import { DocumentDownload } from "@/components/document-download";

export const metadata = pageMetadata({
  title: "Your gap check",
  description: `The documents you sent ${SITE_NAME} and the preliminary review produced from them.`,
  path: "/dashboard",
  robots: { index: false, follow: false },
});

export const dynamic = "force-dynamic";

/**
 * Why a file has no review text against it, in the client's terms.
 *
 * "unreadable" is never softened. A file we could not open must look
 * different from one we read, or the list quietly implies the whole set was
 * assessed.
 */
const DOCUMENT_STATE: Record<string, string> = {
  ok: "Read",
  ocr: "Read by text recognition — treat with caution",
  unreadable: "Could not be read — not assessed",
  unsupported: "Format we can't read — not assessed",
  error: "Failed to read — not assessed",
};

function DocumentRow({ document }: { document: DocumentView }) {
  const state = document.text_status
    ? (DOCUMENT_STATE[document.text_status] ?? "Not assessed")
    : "Waiting to be read";

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border border-zinc-dust bg-paper p-4">
      <div className="flex min-w-0 gap-3">
        {document.readable ? (
          <FileText
            aria-hidden
            className="mt-0.5 h-4 w-4 shrink-0 text-slate-wash"
          />
        ) : (
          <FileWarning
            aria-hidden
            className="mt-0.5 h-4 w-4 shrink-0 text-rust-flag"
          />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-millscale">
            {document.file_name}
          </p>
          <p className="text-xs text-slate-wash">
            {formatBytes(document.size_bytes)} &middot;{" "}
            <span className={document.readable ? "" : "text-rust-flag"}>
              {state}
            </span>
          </p>
        </div>
      </div>

      {/*
        A link to a route handler, not to storage. The bucket is private and
        the URL that reaches it is minted per click and expires in minutes, so
        there is no address here that could be copied out of the page and used
        later, or by anyone else. Minting it is also why the link has a pending
        state — see the component.
      */}
      <DocumentDownload
        documentId={document.id}
        fileName={document.file_name}
      />
    </li>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs tracking-wide text-slate-wash uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-millscale">{value}</dd>
    </div>
  );
}

export default async function SubmissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await currentClient();
  if (!session) redirect("/sign-in");

  const { id } = await params;

  // Filtered by address in the query. A submission belonging to someone else
  // is indistinguishable from one that does not exist, so a guessed uuid
  // reveals nothing about whether it is real.
  const submission = await getSubmissionForEmail(session.email, id);
  if (!submission) notFound();

  const [documents, review] = await Promise.all([
    listDocumentsForSubmission(submission.id),
    getReviewForSubmission(submission.id),
  ]);

  const unreadable = documents
    .filter((document) => !document.readable && document.text_status !== null)
    .map((document) => document.file_name);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-slate-wash underline-offset-4 hover:underline"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" />
        All submissions
      </Link>

      <h1 className="type-h2 mt-4 text-millscale">
        {submission.trade} &middot; {submission.platform}
      </h1>

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border border-zinc-dust bg-paper p-5 sm:grid-cols-4">
        <Field label="Hiring client" value={submission.hiring_client} />
        <Field
          label="Deadline"
          value={submission.deadline ?? "Not known"}
        />
        <Field
          label="Sent"
          value={new Date(submission.created_at).toLocaleDateString("en-US", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        />
        <Field label="Contact" value={submission.contact_name} />
      </dl>

      <section className="mt-10">
        <h2 className="type-h3 text-millscale">Documents you sent</h2>

        {documents.length === 0 ? (
          <p className="type-body mt-3">
            You didn&rsquo;t attach any documents to this gap check. The review
            below is based only on the answers you gave &mdash; sending the
            actual files is what turns it into something specific.
          </p>
        ) : (
          <ul className="mt-4 grid gap-2">
            {documents.map((document) => (
              <DocumentRow key={document.id} document={document} />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="type-h3 text-millscale">Your review</h2>

        <div className="mt-4">
          {review ? (
            <ReviewPanel review={review} unreadableFiles={unreadable} />
          ) : (
            <NoReview status={submission.analysis_status} />
          )}
        </div>
      </section>
    </main>
  );
}

/**
 * Every state where there is no review to show, said plainly.
 *
 * None of these pretend a review is coming when it is not. "fallback" in
 * particular means the automated review failed its own checks and a generic
 * explainer was emailed instead — which is a real outcome this pipeline is
 * designed to reach, and hiding it behind a spinner would be a lie.
 */
function NoReview({ status }: { status: string | null }) {
  const copy =
    status === "pending"
      ? "Your review is being produced now. It usually takes under a minute — refresh this page shortly, and it will arrive by email either way."
      : status === "fallback"
        ? "We couldn't produce a review we were confident enough to show for this submission, so we emailed you a general explainer instead. This is us declining to guess rather than something you did wrong."
        : "There's no review against this submission yet. If you stopped partway through the form, finishing it is what starts one.";

  return (
    <div className="border border-zinc-dust bg-paper p-5">
      <p className="type-body">{copy}</p>
      <p className="type-body mt-3">
        Questions about it?{" "}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="text-verdigris underline underline-offset-4"
        >
          {CONTACT_EMAIL}
        </a>{" "}
        &mdash; one person reads these.
      </p>
    </div>
  );
}
