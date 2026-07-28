import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { SITE_NAME } from "@/lib/constants";
import { pageMetadata } from "@/lib/metadata";
import { currentClient } from "@/lib/auth/session";
import { listRequestsForEmail } from "@/lib/requests/store";
import { SERVICE_LABELS } from "@/lib/service-kinds";
import { StatusChip } from "@/components/status-chip";
import { HelpForm } from "@/components/help-form";

export const metadata = pageMetadata({
  title: "Ask for help",
  description: `Ask ${SITE_NAME} for work that is done by hand — a document prepared, a rejection sorted out, a second opinion.`,
  path: "/dashboard/help",
  robots: { index: false, follow: false },
});

export const dynamic = "force-dynamic";

export default async function HelpPage({
  searchParams,
}: {
  searchParams: Promise<{ submission?: string }>;
}) {
  const session = await currentClient();
  if (!session) redirect("/sign-in");

  const { submission } = await searchParams;
  const existing = await listRequestsForEmail(session.email);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-slate-wash underline-offset-4 hover:underline"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" />
        Your workspace
      </Link>

      <h1 className="type-h2 mt-4 text-millscale">Ask for help</h1>
      <p className="type-lede mt-3">
        Some of this is work a person does rather than software. Say what you
        need and someone will reply with what it involves.
      </p>

      <div className="mt-8">
        <HelpForm submissionId={submission} />
      </div>

      {existing.length > 0 ? (
        <section aria-labelledby="asked-heading" className="mt-12">
          <h2 id="asked-heading" className="type-h3 text-millscale">
            What you&rsquo;ve asked for
          </h2>
          <ul className="mt-4 grid gap-2">
            {existing.map((request) => (
              <li
                key={request.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border border-zinc-dust bg-paper p-4"
              >
                <div>
                  <p className="text-sm font-medium text-millscale">
                    {SERVICE_LABELS[request.kind] ?? request.kind}
                  </p>
                  <p className="text-xs text-slate-wash">
                    {new Date(request.created_at).toLocaleDateString("en-US", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <StatusChip state={request.status.state} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
