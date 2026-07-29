import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, MessageSquare } from "lucide-react";

import { SITE_NAME } from "@/lib/constants";
import { pageMetadata } from "@/lib/metadata";
import { currentClient } from "@/lib/auth/session";
import { listRequestsForEmailOrThrow } from "@/lib/requests/store";
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

  // Throws rather than returning [] on a failed read, so that a database
  // problem reaches error.tsx instead of rendering as "no requests yet".
  const requests = await listRequestsForEmailOrThrow(session.email);

  return (
    <main className="max-w-3xl">
      {/*
        This header block is repeated verbatim in loading.tsx and error.tsx.
        It is the fixed part of the page: whichever of the four states is on
        screen, the title sits in the same place and does not move as the
        state changes under it.
      */}
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="type-h2 text-millscale">Requests</h1>
        <Link
          href="/dashboard/help"
          className="text-sm font-medium text-verdigris underline-offset-4 transition-opacity duration-150 hover:underline hover:opacity-80"
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
              {/*
                The whole row is the link, and the hover moves the border and
                the surface together with the chevron. Previously only the
                border changed and the chevron stayed the same grey as the
                rule around it, so the one element whose entire job is to say
                "this goes somewhere" was the least responsive thing in the
                row.

                `focus-within` is not needed — the anchor is the focus target
                — but the ring has to be pulled out to the row's edge, or the
                default outline traces the text inside a card that is itself
                the control.
              */}
              <Link
                href={`/dashboard/requests/${request.id}`}
                className="group flex items-start justify-between gap-4 border border-zinc-dust bg-paper p-5 transition-colors duration-200 hover:border-verdigris hover:bg-galvanise focus-visible:border-verdigris focus-visible:outline-offset-0"
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
                  {/*
                    Nudges a couple of pixels on hover. Small enough to read
                    as the row acknowledging the pointer rather than as an
                    animation, and it holds still for anyone who asked it to.
                  */}
                  <ChevronRight
                    aria-hidden
                    className="h-5 w-5 text-zinc-dust transition-[color,transform] duration-200 group-hover:translate-x-0.5 group-hover:text-verdigris group-focus-visible:text-verdigris motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
