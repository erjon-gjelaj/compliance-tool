import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { SITE_NAME } from "@/lib/constants";
import { pageMetadata } from "@/lib/metadata";
import { currentWorkspace } from "@/lib/workspaces";
import { getRequestForEmail } from "@/lib/requests/store";
import { SERVICE_LABELS } from "@/lib/service-kinds";
import { StatusChip } from "@/components/status-chip";
import { RequestThread } from "@/components/request-thread";
import { latestQuote } from "@/lib/quotes";
import { acceptRequestQuote } from "../actions";
import { clockLabel, clockState, todayIso } from "@/lib/clock";

export const metadata = pageMetadata({
  title: "Your request",
  description: `A request you asked ${SITE_NAME} for, and everything said about it.`,
  path: "/dashboard/requests",
  robots: { index: false, follow: false },
});

export const dynamic = "force-dynamic";

/**
 * Says whose move it is in a sentence, above the conversation.
 *
 * The chip alone is not enough. "With CertLoop" tells someone the state; it
 * does not tell them whether they can put it down and get on with their day,
 * which is the thing they actually came to find out.
 */
const NEXT_COPY: Record<string, string> = {
  customer: "This is waiting on you.",
  certloop: `This is with ${SITE_NAME}. You don't need to do anything.`,
};

export default async function RequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const workspace = await currentWorkspace();
  if (!workspace) redirect("/sign-in");

  const { id } = await params;

  const request = await getRequestForEmail(workspace.email, id);
  if (!request) notFound();
  const quote = await latestQuote(request.id);
  const quoteClock = quote
    ? clockState(quote.expires_at.slice(0, 10), todayIso())
    : null;

  return (
    <main className="max-w-3xl">
      <Link
        href="/dashboard/requests"
        className="inline-flex items-center gap-2 text-sm text-slate-wash underline-offset-4 hover:underline"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" />
        All requests
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <h1 className="type-h2 text-millscale">
          {SERVICE_LABELS[request.kind] ?? request.kind}
        </h1>
        <StatusChip state={request.status.state} />
      </div>

      <p className="type-body mt-2">
        {request.status.nextParty
          ? NEXT_COPY[request.status.nextParty]
          : "Nothing further is needed on this."}
      </p>

      {quote ? (
        <section className="mt-8 border border-zinc-dust bg-paper p-5">
          <p className="tag">Quote version {quote.version}</p>
          <h2 className="type-h3 mt-2 text-millscale">
            {(quote.total_minor / 100).toLocaleString("en-US", {
              style: "currency",
              currency: quote.currency,
            })}
          </h2>
          <ul className="mt-4 grid gap-2 text-sm text-millscale">
            {quote.line_items.map((line, index) => (
              <li key={`${line.description}-${index}`}>
                {line.quantity} × {line.description}
              </li>
            ))}
          </ul>
          <p className="mt-4 whitespace-pre-wrap text-sm text-slate-wash">
            {quote.terms}
          </p>
          <p className="mt-3 text-sm text-slate-wash">
            Expires {new Date(quote.expires_at).toLocaleDateString("en-US")}.{" "}
            {quoteClock ? (
              <span
                className={
                  quoteClock.state === "overdue"
                    ? "font-medium text-rust-flag"
                    : "text-slate-wash"
                }
              >
                {clockLabel(quoteClock)}
              </span>
            ) : null}
          </p>
          {quote.accepted_at ? (
            <p className="mt-4 font-medium text-verdigris">
              Accepted and stored on{" "}
              {new Date(quote.accepted_at).toLocaleDateString("en-US")}.
            </p>
          ) : quoteClock?.state === "overdue" ? (
            <p className="mt-4 font-medium text-rust-flag">
              This quote has expired. Ask CertLoop for a current version.
            </p>
          ) : (
            <form action={acceptRequestQuote} className="mt-5">
              <input type="hidden" name="request_id" value={request.id} />
              <input type="hidden" name="quote_id" value={quote.id} />
              <button type="submit" className="btn-primary">
                Accept this quote
              </button>
            </form>
          )}
        </section>
      ) : null}

      <div className="mt-8">
        <RequestThread requestId={request.id} events={request.events} />
      </div>
    </main>
  );
}
