import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { SITE_NAME } from "@/lib/constants";
import { pageMetadata } from "@/lib/metadata";
import { currentClient } from "@/lib/auth/session";
import { getRequestForEmail } from "@/lib/requests/store";
import { SERVICE_LABELS } from "@/lib/service-kinds";
import { StatusChip } from "@/components/status-chip";
import { RequestThread } from "@/components/request-thread";

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
  const session = await currentClient();
  if (!session) redirect("/sign-in");

  const { id } = await params;

  const request = await getRequestForEmail(session.email, id);
  if (!request) notFound();

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

      <div className="mt-8">
        <RequestThread requestId={request.id} events={request.events} />
      </div>
    </main>
  );
}
