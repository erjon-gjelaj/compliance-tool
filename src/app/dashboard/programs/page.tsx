import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";

import { pageMetadata } from "@/lib/metadata";
import { currentClient } from "@/lib/auth/session";
import { offerablePrograms } from "@/lib/programs/registry";
import { preparationAccess } from "@/lib/programs/access";
import { PRICING_NOTE, formatMoney, offerById } from "@/lib/pricing";
import { listDocumentsForEmail } from "@/lib/programs/store";
import { getCompanyForEmail } from "@/lib/companies";

export const metadata = pageMetadata({
  title: "Safety programs",
  description: "Written safety programs prepared in your company's name.",
  path: "/dashboard/programs",
  robots: { index: false, follow: false },
});

export const dynamic = "force-dynamic";

export default async function ProgramsPage() {
  const session = await currentClient();
  if (!session) redirect("/sign-in");

  const [held, company, access] = await Promise.all([
    listDocumentsForEmail(session.email),
    getCompanyForEmail(session.email),
    preparationAccess(session.email),
  ]);

  const programs = offerablePrograms();
  const offer = offerById("single_program");

  return (
    <main className="max-w-3xl">
      <h1 className="type-h2 text-millscale">Safety programs</h1>
      <p className="type-lede mt-3">
        Answer a few questions about how you work and get a finished program in
        Word and PDF, prepared in your company&rsquo;s name.
      </p>

      {/*
        Said here, before anybody spends two minutes on a questionnaire.
        Letting somebody answer every question and only then meeting a price
        would be a bait and switch, and this product does not do that anywhere
        else. What is free stays named as free in the same breath.
      */}
      {!access.allowed && offer ? (
        <div className="mt-6 border-l-2 border-verdigris bg-paper p-4">
          <p className="type-body">
            Your gap checks are free and stay free. Having a program written
            and prepared in your name is{" "}
            <strong className="text-millscale">{formatMoney(offer.price)}</strong>{" "}
            &mdash; describe what you need and we&rsquo;ll come back with the
            number before any work starts.
          </p>
          <p className="mt-2 text-sm text-slate-wash">{PRICING_NOTE}</p>
        </div>
      ) : null}

      {!company?.name ? (
        <div className="mt-6 border-l-2 border-rust-flag bg-paper p-4">
          <p className="type-body">
            Add your company name first &mdash; every program is prepared in it.{" "}
            <Link
              href="/dashboard/company"
              className="text-verdigris underline underline-offset-4"
            >
              Add it now
            </Link>
          </p>
        </div>
      ) : null}

      <ul className="mt-8 grid gap-3">
        {programs.map((program) => {
          const existing = held.find((entry) => entry.program_id === program.id);

          return (
            <li key={program.id}>
              <Link
                href={
                  existing
                    ? `/dashboard/documents/${existing.id}`
                    : `/dashboard/programs/${program.id}`
                }
                className="flex items-center justify-between gap-4 border border-zinc-dust bg-paper p-5 transition-colors hover:border-verdigris"
              >
                <div className="min-w-0">
                  <p className="type-label text-millscale">{program.title}</p>
                  <p className="mt-1 text-sm text-slate-wash">
                    {existing
                      ? `Version ${existing.current?.version ?? 1} — ready to download`
                      : access.allowed || !offer
                        ? "About two minutes"
                        : `About two minutes to describe · ${formatMoney(offer.price)} to have it prepared`}
                  </p>
                </div>
                {existing ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 border border-verdigris bg-verdigris/8 px-2.5 py-1 text-xs font-medium text-verdigris">
                    <Check aria-hidden className="h-3.5 w-3.5" />
                    Ready
                  </span>
                ) : (
                  <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-verdigris" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="type-body mt-8 border-t border-zinc-dust pt-6">
        More programs are being added. If you need one that isn&rsquo;t here
        yet,{" "}
        <Link
          href="/dashboard/help"
          className="text-verdigris underline underline-offset-4"
        >
          tell us which
        </Link>{" "}
        and we&rsquo;ll prioritize it.
      </p>
    </main>
  );
}
