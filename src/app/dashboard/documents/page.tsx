import Link from "next/link";
import { redirect } from "next/navigation";
import { FileStack, FileText, FileWarning } from "lucide-react";

import { SITE_NAME } from "@/lib/constants";
import { pageMetadata } from "@/lib/metadata";
import { formatBytes } from "@/lib/uploads";
import { currentWorkspace } from "@/lib/workspaces";
import { listDocumentsForEmail, type LibraryDocument } from "@/lib/dashboard";
import { listDocumentsForEmail as listGenerated } from "@/lib/programs/store";
import { programById } from "@/lib/programs/registry";
import { DocumentDownload } from "@/components/document-download";
import { ProjectUpload } from "@/components/project-upload";
import { listSubmissionsForEmail } from "@/lib/dashboard";

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
            {document.doc_type.replaceAll("_", " ")} &middot; {formatBytes(document.size_bytes)} &middot; uploaded{" "}
            {formatDate(document.created_at)}
            {document.submission_client ? ` · ${document.submission_client}` : ""}
            {document.version_n > 1 ? ` · version ${document.version_n}` : ""}
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
  const workspace = await currentWorkspace();
  if (!workspace) redirect("/sign-in");

  const [documents, generated, projects] = await Promise.all([
    listDocumentsForEmail(workspace.email),
    listGenerated(workspace.email),
    listSubmissionsForEmail(workspace.email),
  ]);

  const unreadable = documents.filter((entry) => !entry.readable);
  const currentUploads = documents.filter((entry) => !documents.some((candidate) => candidate.version_group_id === entry.version_group_id && candidate.version_n > entry.version_n));
  const previousUploads = documents.filter((entry) => !currentUploads.includes(entry));

  return (
    <main className="max-w-3xl">
      <h1 className="type-h2 text-millscale">Documents</h1>

      {projects.length > 0 ? <section id="upload" className="mt-6 border border-zinc-dust bg-paper p-5"><h2 className="type-h3 text-millscale">Add evidence to a project</h2><p className="type-body mt-2 mb-5">Upload an existing program, insurance certificate, OSHA summary, training roster, certificate or clear phone photo. CertLoop will read supported files and keep page evidence.</p><ProjectUpload projects={projects.map((project) => ({ id: project.id, label: `${project.hiring_client || "Client not entered"} · ${project.platform}` }))} /></section> : null}

      {/*
        Programmes first. They are the thing a contractor came to get, and
        putting the library of their own uploads above them would bury the
        action under the archive.
      */}
      {unreadable.length > 0 ? <section className="mt-6 border-l-2 border-rust-flag bg-paper p-5"><h2 className="type-h3 text-millscale">Files needing attention</h2><p className="type-body mt-2">{unreadable.length} uploaded {unreadable.length === 1 ? "file could" : "files could"} not be read. Replace these with a clearer scan or supported file.</p><Link href="#upload" className="btn-primary mt-4 inline-flex">Upload a replacement</Link></section> : null}

      {generated.length > 0 ? (
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
                        Version {entry.current.version} &middot; ready to
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

          </ul>
        </section>
      ) : null}

      <div className="mt-10 flex items-baseline justify-between gap-4"><h2 className="type-label text-millscale">Uploaded evidence</h2><Link href="#upload" className="text-sm text-verdigris underline underline-offset-4">Upload evidence</Link></div>

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
            {currentUploads.map((document) => (
              <Row key={document.id} document={document} />
            ))}
          </ul>
        </>
      )}

      {previousUploads.length > 0 ? <details className="mt-8 border border-zinc-dust bg-paper p-4"><summary className="cursor-pointer font-medium text-millscale">Previous uploaded versions ({previousUploads.length})</summary><ul className="mt-4 grid gap-2">{previousUploads.map((document) => <Row key={document.id} document={document} />)}</ul></details> : null}

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
