import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, MessageSquare } from "lucide-react";

import { SITE_NAME } from "@/lib/constants";
import { pageMetadata } from "@/lib/metadata";
import { currentClient } from "@/lib/auth/session";
import { listRequestsForEmail } from "@/lib/requests/store";
import { SERVICE_LABELS } from "@/lib/service-kinds";
import { StatusChip } from "@/components/status-chip";

export const metadata = pageMetadata({
  title: "Your requests",
  description: `Everything you've asked ${SITE_NAME} to do, and where each one stands.`,
  path: "/dashboard/requests",
  robots: { index: false, follow: false },
});

export const dynamic = "force-dynamic";

function when(value: string | null): string {
  if (!value) return "no activity yet";
  return `last activity ${new Date(value).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
}

export default async function RequestsPage() {
  const session = await currentClient();
  if (!session) redirect("/sign-in");

  const requests = await listRequestsForEmail(session.email);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="type-h2 text-millscale">Requests</h1>
        <Link
          href="/dashboard/help"
          className="text-sm font-medium text-verdigris underline-offset-4 hover:underline"
        >
          Ask for something new
        </Link>
      </div>

      {requests.length === 0 ? (
        <div className="mt-8 border border-zinc-dust bg-paper p-8">
          <MessageSquare aria-hidden className="mb-4 h-5 w-5 text-slate-wash" />
          <h2 className="type-h3 text-millscale">No requests yet</h2>
          <p className="type-body mt-3 max-w-xl">
            When you ask us to prepare a document, sort out a rejection, or look
            over something, it lives here &mdash; with everything either side
            has said about it.
          </p>
          <Link href="/dashboard/help" className="btn-primary mt-6">
            Ask for help
          </Link>
        </div>
      ) : (
        <ul className="mt-8 grid gap-3">
          {requests.map((request) => (
            <li key={request.id}>
              <Link
                href={`/dashboard/requests/${request.id}`}
                className="flex items-start justify-between gap-4 border border-zinc-dust bg-paper p-5 transition-colors hover:border-verdigris"
              >
                <div className="min-w-0">
                  <p className="type-label text-millscale">
                    {SERVICE_LABELS[request.kind] ?? request.kind}
                  </p>
                  <p className="mt-1 text-sm text-slate-wash">
                    {when(request.status.lastActivityAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <StatusChip state={request.status.state} />
                  <ChevronRight aria-hidden className="h-5 w-5 text-zinc-dust" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
