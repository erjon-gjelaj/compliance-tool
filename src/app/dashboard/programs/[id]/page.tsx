import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { pageMetadata } from "@/lib/metadata";
import { currentClient } from "@/lib/auth/session";
import { programById } from "@/lib/programs/registry";
import { isOfferable } from "@/lib/programs/types";
import { companyContextFor } from "@/lib/programs/store";
import { ProgramForm } from "@/components/program-form";

export const metadata = pageMetadata({
  title: "Prepare a program",
  description: "Answer a few questions and get a finished safety program.",
  path: "/dashboard/programs",
  robots: { index: false, follow: false },
});

export const dynamic = "force-dynamic";

// Rendering two files is the slow part of this request. Well inside the
// budget, but the default would not be.
export const maxDuration = 60;

export default async function ProgramPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await currentClient();
  if (!session) redirect("/sign-in");

  const { id } = await params;
  const template = programById(id);

  // A programme that exists but is not released is a 404 rather than a
  // "coming soon" page. Advertising something nobody can have is the kind of
  // thing this product avoids everywhere else.
  if (!template || !isOfferable(template.release)) notFound();

  const context = await companyContextFor(session.email);

  // The document is prepared in the company's name, so there is nothing
  // sensible to generate without one. Sent to the profile rather than shown a
  // blocked form.
  if (!context) {
    return (
      <main className="max-w-2xl">
        <h1 className="type-h2 text-millscale">{template.title}</h1>
        <div className="mt-6 border border-zinc-dust bg-paper p-6">
          <p className="type-body">
            This document is prepared in your company&rsquo;s name, so we need
            that first. It takes a moment and every later document reuses it.
          </p>
          <Link href="/dashboard/company" className="btn-primary mt-5 inline-block">
            Add your company
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-2xl">
      <Link
        href="/dashboard/documents"
        className="inline-flex items-center gap-2 text-sm text-slate-wash underline-offset-4 hover:underline"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" />
        Documents
      </Link>

      <h1 className="type-h2 mt-4 text-millscale">{template.title}</h1>
      <p className="type-lede mt-3">
        A few questions about how you actually work, then we prepare the
        program for {context.companyName}. Takes about two minutes.
      </p>

      <div className="mt-8">
        <ProgramForm programId={template.id} context={context} />
      </div>
    </main>
  );
}
