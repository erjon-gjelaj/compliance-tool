import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, FileText, Paperclip } from "lucide-react";

import { SITE_NAME } from "@/lib/constants";
import { GAP_CHECK_HREF } from "@/lib/nav";
import { pageMetadata } from "@/lib/metadata";
import { currentClient } from "@/lib/auth/session";
import { listSubmissionsForEmail, type DashboardSubmission } from "@/lib/dashboard";

export const metadata = pageMetadata({
  title: "Your file",
  description: `The gap checks you have sent ${SITE_NAME}, the documents attached to each, and the preliminary review produced from them.`,
  path: "/dashboard",
  robots: { index: false, follow: false },
});

export const dynamic = "force-dynamic";

/** How far a submission got, said plainly rather than as a status code. */
function stateOf(row: DashboardSubmission): { label: string; tone: string } {
  if (row.status === "partial") {
    return {
      label: `Unfinished — you stopped at step ${row.last_step} of 4`,
      tone: "text-rust-flag",
    };
  }

  switch (row.analysis_status) {
    case "ok":
      return { label: "Review ready", tone: "text-verdigris" };
    case "pending":
      return { label: "Review running", tone: "text-slate-wash" };
    case "fallback":
      return {
        label: "Review not available — we emailed you instead",
        tone: "text-slate-wash",
      };
    default:
      return { label: "Received", tone: "text-slate-wash" };
  }
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function Card({ row }: { row: DashboardSubmission }) {
  const state = stateOf(row);

  return (
    <li>
      <Link
        href={`/dashboard/${row.id}`}
        className="flex items-start justify-between gap-4 border border-zinc-dust bg-paper p-5 transition-colors hover:border-verdigris"
      >
        <div>
          <p className="type-label text-millscale">
            {row.trade} &middot; {row.platform}
          </p>
          <p className="mt-1 text-sm text-slate-wash">
            For {row.hiring_client} &middot; sent {formatDate(row.created_at)}
          </p>

          <p className={`mt-3 text-sm font-medium ${state.tone}`}>
            {state.label}
          </p>

          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-wash">
            <Paperclip aria-hidden className="h-3.5 w-3.5 shrink-0" />
            {row.documentCount === 0
              ? "No documents attached"
              : `${row.documentCount} document${row.documentCount === 1 ? "" : "s"}`}
          </p>
        </div>

        <ChevronRight
          aria-hidden
          className="mt-1 h-5 w-5 shrink-0 text-zinc-dust"
        />
      </Link>
    </li>
  );
}

/**
 * The empty state.
 *
 * Reachable in one real way: a submission was deleted after the session
 * cookie was issued — a deletion request being honoured, which is a path this
 * project deliberately has. So it reads as a normal state rather than an
 * error.
 */
function Empty() {
  return (
    <div className="border border-zinc-dust bg-paper p-8">
      <FileText aria-hidden className="mb-4 h-5 w-5 text-slate-wash" />
      <h2 className="type-h3 text-millscale">Nothing here yet</h2>
      <p className="type-body mt-3">
        There are no gap checks against this address. If you asked us to delete
        your file, it is gone, documents included.
      </p>
      <Link
        href={GAP_CHECK_HREF}
        className="btn-primary mt-6"
      >
        Start a gap check
      </Link>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await currentClient();
  if (!session) redirect("/sign-in");

  const submissions = await listSubmissionsForEmail(session.email);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="type-h2 text-millscale">Your file</h1>
      <p className="type-lede mt-3">
        Everything sent to {SITE_NAME} from{" "}
        <span className="text-millscale">{session.email}</span>: the documents
        you uploaded, and the preliminary review we produced from them.
      </p>

      <div className="mt-8">
        {submissions.length === 0 ? (
          <Empty />
        ) : (
          <ul className="grid gap-3">
            {submissions.map((row) => (
              <Card key={row.id} row={row} />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
