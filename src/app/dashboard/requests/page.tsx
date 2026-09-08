import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { SITE_NAME } from "@/lib/constants";
import { pageMetadata } from "@/lib/metadata";
import { currentClient } from "@/lib/auth/session";
import { listRequestsForEmail } from "@/lib/requests/store";
import { SERVICE_LABELS } from "@/lib/service-kinds";
import { StatusChip } from "@/components/status-chip";
import { HelpForm } from "@/components/help-form";
import { formatQuote, liveQuote, needsCustomer } from "@/lib/requests/state";

/**
 * Asking for something, and everything you have asked for.
 *
 * These used to be two pages. /dashboard/help held the form and listed the
 * open requests underneath it; /dashboard/requests listed the same rows
 * again and linked to "Ask for something new", which went to the first page.
 * Two nav slots, two round trips, and the same rows twice — and the help
 * page's copy of the list was not even clickable, so the more natural place
 * to land was the one that could not open a conversation.
 *
 * One page: what needs you, then the form, then the history.
 */

export const metadata = pageMetadata({
  title: "Get help",
  description: `Ask ${SITE_NAME} about anything the programs don't cover, and follow where each request stands.`,
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

function RequestRow({
  request,
}: {
  request: Awaited<ReturnType<typeof listRequestsForEmail>>[number];
}) {
  const quote = liveQuote(request.events);
  const price = quote ? formatQuote(quote) : null;

  return (
    <li>
      <Link
        href={`/dashboard/requests/${request.id}`}
        className="flex items-start justify-between gap-4 border border-zinc-dust bg-paper p-5 transition-colors hover:border-verdigris"
      >
        <div className="min-w-0">
          <p className="type-label text-millscale">
            {SERVICE_LABELS[request.kind] ?? request.kind}
          </p>
          {/*
           * The price is repeated on the row rather than left inside the
           * thread. "What did they quote me" is the question that brings
           * somebody back to this page, and making them open each one to
           * find out is the whole reason a list like this feels slow.
           */}
          <p className="mt-1 text-sm text-slate-wash">
            {price ? (
              <>
                <span className="font-medium text-millscale">{price}</span>
                {" — waiting on your answer"}
              </>
            ) : (
              when(request.status.lastActivityAt)
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <StatusChip state={request.status.state} />
          <ChevronRight aria-hidden className="h-5 w-5 text-zinc-dust" />
        </div>
      </Link>
    </li>
  );
}

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ submission?: string }>;
}) {
  const session = await currentClient();
  if (!session) redirect("/sign-in");

  const { submission } = await searchParams;
  const requests = await listRequestsForEmail(session.email);

  /*
   * Split rather than sorted. Anything waiting on the customer is the reason
   * they opened this page, and a sort would still leave it competing for
   * attention with eleven finished ones under the same heading.
   */
  const needsYou = requests.filter((request) => needsCustomer(request.status));
  const rest = requests.filter((request) => !needsCustomer(request.status));

  return (
    <main className="max-w-3xl">
      <h1 className="type-h2 text-millscale">Get help</h1>
      <p className="type-lede mt-3">
        Some of this is work a person does rather than software. Say what you
        need and someone will reply with what it involves and what it costs.
      </p>

      {needsYou.length > 0 ? (
        <section aria-labelledby="needs-you" className="mt-8">
          <h2 id="needs-you" className="type-h3 text-millscale">
            Waiting on you
          </h2>
          <ul className="mt-4 grid gap-3">
            {needsYou.map((request) => (
              <RequestRow key={request.id} request={request} />
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="ask-heading" className="mt-10">
        <h2 id="ask-heading" className="type-h3 text-millscale">
          Ask for something
        </h2>
        <div className="mt-4">
          <HelpForm submissionId={submission} />
        </div>
      </section>

      {rest.length > 0 ? (
        <section aria-labelledby="history-heading" className="mt-12">
          <h2 id="history-heading" className="type-h3 text-millscale">
            Everything you&rsquo;ve asked for
          </h2>
          <ul className="mt-4 grid gap-3">
            {rest.map((request) => (
              <RequestRow key={request.id} request={request} />
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
