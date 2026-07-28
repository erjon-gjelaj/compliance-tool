import Link from "next/link";
import { redirect } from "next/navigation";
import { FileStack, FileText, FileWarning } from "lucide-react";

import { SITE_NAME } from "@/lib/constants";
import { pageMetadata } from "@/lib/metadata";
import { formatBytes } from "@/lib/uploads";
import { currentClient } from "@/lib/auth/session";
import { listDocumentsForEmail, type LibraryDocument } from "@/lib/dashboard";
import { listDocumentsForEmail as listGenerated } from "@/lib/programs/store";
import { offerablePrograms, programById } from "@/lib/programs/registry";
import { DocumentDownload } from "@/components/document-download";

export const metadata = pageMetadata({
  title: "Your documents",
  description: `Everything you've sent ${SITE_NAME}, in one place.`,
  path: "/dashboard/documents",
  robots: { index: false, follow: false },
});

export const dynamic = "force-dynamic";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * One row per file.
 *
 * A file we could not read is marked in the warning colour and says so in
 * words. That rule runs through the whole product: a document that was never
 * assessed must never sit in a list looking exactly like one that was.
 */
function Row({ document }: { document: LibraryDocument }) {
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

export default async function DocumentsPage() {
  const session = await currentClient();
  if (!session) redirect("/sign-in");

  const [documents, generated] = await Promise.all([
    listDocumentsForEmail(session.email),
    listGenerated(session.email),
  ]);

  // Programmes we can prepare that this company does not already hold.
  const held = new Set(generated.map((entry) => entry.program_id));
  const available = offerablePrograms().filter((program) => !held.has(program.id));

  const unreadable = documents.filter((entry) => !entry.readable);

  return (
    <main className="max-w-3xl">
      <h1 className="type-h2 text-millscale">Documents</h1>

      {/*
        Programmes first. They are the thing a contractor came to get, and
        putting the library of their own uploads above them would bury the
        action under the archive.
      */}
      {generated.length > 0 || available.length > 0 ? (
        <section aria-labelledby="programs-heading" className="mt-8">
          <h2 id="programs-heading" className="type-label text-millscale">
            Safety programs
          </h2>

          <ul className="mt-3 grid gap-2">
            {generated.map((entry) => {
              const template = programById(entry.program_id);
              return (
                <li key={entry.id}>
                  <Link
                    href={`/dashboard/documents/${entry.id}`}
                    className="flex items-center justify-between gap-4 border border-zinc-dust bg-paper p-4 transition-colors hover:border-verdigris"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-millscale">
                        {template?.title ?? entry.program_id}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-wash">
                        Version {entry.current?.version ?? 1} &middot; ready to
                        download
                      </p>
                    </div>
                    <span className="shrink-0 border border-verdigris bg-verdigris/8 px-2.5 py-1 text-xs font-medium text-verdigris">
                      Ready
                    </span>
                  </Link>
                </li>
              );
            })}

            {available.map((program) => (
              <li key={program.id}>
                <Link
                  href={`/dashboard/programs/${program.id}`}
                  className="flex items-center justify-between gap-4 border border-zinc-dust bg-paper p-4 transition-colors hover:border-verdigris"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-millscale">
                      {program.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-wash">
                      A few questions, then Word and PDF
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium text-verdigris">
                    Prepare
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <h2 className="type-label mt-10 text-millscale">Files you sent us</h2>

      {documents.length === 0 ? (
        <div className="mt-3 border border-zinc-dust bg-paper p-8">
          <FileStack aria-hidden className="mb-4 h-5 w-5 text-slate-wash" />
          <h2 className="type-h3 text-millscale">Nothing here yet</h2>
          <p className="type-body mt-3 max-w-xl">
            Everything you send us lands here, whichever request it came in on.
            Reading a real document is the difference between a list of
            questions and an answer about your file &mdash; even an old or
            half-finished program is worth attaching.
          </p>
          <Link href="/" className="btn-primary mt-6">
            Start a request
          </Link>
        </div>
      ) : (
        <>
          <p className="type-body mt-3">
            {documents.length} file{documents.length === 1 ? "" : "s"}, across
            every request you&rsquo;ve sent.
            {unreadable.length > 0 ? (
              <>
                {" "}
                <span className="text-rust-flag">
                  {unreadable.length} could not be read and{" "}
                  {unreadable.length === 1 ? "was" : "were"} not assessed.
                </span>
              </>
            ) : null}
          </p>

          <ul className="mt-6 grid gap-2">
            {documents.map((document) => (
              <Row key={document.id} document={document} />
            ))}
          </ul>
        </>
      )}

      {/*
        Stated once, at the bottom, rather than on every row. The library holds
        what the customer sent; drafts and generated programmes are task 058 and
        do not exist yet, so nothing here pretends there is a second kind.
      */}
      <p className="type-body mt-8 border-t border-zinc-dust pt-6">
        These are the files you uploaded. We keep them to prepare your reviews
        and nothing else, and they go when you ask us to delete your record.
      </p>
    </main>
  );
}
