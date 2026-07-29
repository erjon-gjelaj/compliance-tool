import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileDown, History } from "lucide-react";

import { pageMetadata } from "@/lib/metadata";
import { currentClient } from "@/lib/auth/session";
import { getDocumentForEmail } from "@/lib/programs/store";
import { programById } from "@/lib/programs/registry";
import { REVISION_PROMISE } from "@/lib/pricing";
import { ReviseForm } from "@/components/revise-form";

export const metadata = pageMetadata({
  title: "Your document",
  description: "A program prepared for your company, and its version history.",
  path: "/dashboard/documents",
  robots: { index: false, follow: false },
});

export const dynamic = "force-dynamic";

// A revision renders two files inside the request.
export const maxDuration = 60;

function when(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function GeneratedDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await currentClient();
  if (!session) redirect("/sign-in");

  const { id } = await params;
  const document = await getDocumentForEmail(session.email, id);

  /*
   * Not yours, not real, and never successfully generated all render
   * identically. The third case is why this 404'd for documents the customer
   * could see listed: a generation that failed after creating its row left a
   * document with no version, the archive linked to it anyway, and this line
   * refused it. The reader now drops those, so the list and this page agree.
   */
  if (!document) notFound();

  const template = programById(document.program_id);
  const title = template?.title ?? document.program_id;
  const current = document.current;
  const older = document.versions.filter((entry) => entry.id !== current.id);

  return (
    <main className="max-w-3xl">
      <Link
        href="/dashboard/documents"
        className="inline-flex items-center gap-2 text-sm text-slate-wash underline-offset-4 hover:underline"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" />
        Documents
      </Link>

      <h1 className="type-h2 mt-4 text-millscale">{title}</h1>
      <p className="type-body mt-2">
        Version {current.version} &middot; effective {when(current.effective_date)}
        {document.platform ? <> &middot; {document.platform}</> : null}
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <a
          href={`/api/generated/${current.id}?format=pdf`}
          className="btn-primary inline-flex items-center gap-2"
        >
          <FileDown aria-hidden className="h-4 w-4" />
          Download PDF
        </a>
        <a
          href={`/api/generated/${current.id}?format=docx`}
          className="inline-flex items-center gap-2 border border-zinc-dust bg-paper px-4 py-2 text-sm font-medium text-millscale transition-colors hover:border-verdigris"
        >
          <FileDown aria-hidden className="h-4 w-4" />
          Download Word
        </a>
      </div>

      <p className="type-body mt-4">
        The PDF is the copy to submit. The Word version is yours to edit if a
        hiring client asks for a change you would rather make yourself.
      </p>

      <section aria-labelledby="revise-heading" className="mt-10">
        <h2 id="revise-heading" className="type-h3 text-millscale">
          Was this sent back?
        </h2>
        <p className="type-body mt-2">{REVISION_PROMISE}</p>
        <div className="mt-4">
          <ReviseForm documentId={document.id} />
        </div>
      </section>

      {older.length > 0 ? (
        <section aria-labelledby="history-heading" className="mt-10">
          <h2
            id="history-heading"
            className="type-h3 flex items-center gap-2 text-millscale"
          >
            <History aria-hidden className="h-4 w-4 text-slate-wash" />
            Earlier versions
          </h2>
          <p className="type-body mt-2">
            Kept because you may already have submitted one of them.
          </p>
          <ul className="mt-4 grid gap-2">
            {older.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-3 border border-zinc-dust bg-paper p-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-millscale">
                    Version {entry.version}
                  </p>
                  <p className="text-xs text-slate-wash">
                    {when(entry.created_at)}
                    {entry.revision_reason ? " · revised on request" : ""}
                  </p>
                </div>
                <div className="flex gap-3 text-sm">
                  <a
                    href={`/api/generated/${entry.id}?format=pdf`}
                    className="text-verdigris underline-offset-4 hover:underline"
                  >
                    PDF
                  </a>
                  <a
                    href={`/api/generated/${entry.id}?format=docx`}
                    className="text-verdigris underline-offset-4 hover:underline"
                  >
                    Word
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
