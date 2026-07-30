import type { Metadata } from "next";
import { FileCheck2, ShieldCheck, TimerReset } from "lucide-react";

import { IntakeForm } from "@/components/intake-form";
import { TickRule } from "@/components/tick-rule";
import { pageMetadata } from "@/lib/metadata";

export const maxDuration = 60;

export const metadata: Metadata = pageMetadata({
  title: "Free prequalification gap check",
  description:
    "Tell us about the job and attach what you already have. Get a preliminary view of what your ISNetworld or Avetta file may still need.",
  path: "/gap-check",
});

const EXPECTATIONS = [
  {
    icon: TimerReset,
    title: "Start in about a minute",
    detail:
      "The first screen is enough to begin. You can add company details and files as you go.",
  },
  {
    icon: FileCheck2,
    title: "Use what you already have",
    detail:
      "Old or partial documents are useful. Attach them so the result can speak to your actual file.",
  },
  {
    icon: ShieldCheck,
    title: "No account or card",
    detail:
      "We send the preliminary gap check to your email and open your workspace from there.",
  },
] as const;

export default function GapCheckPage() {
  return (
    <main className="flex-1">
      <section className="border-b border-zinc-dust">
        <div className="mx-auto max-w-5xl px-6 pt-14 pb-12 md:pt-20 md:pb-16">
          <div className="grid gap-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:items-end md:gap-16">
            <div>
              <p className="tag">Free gap check</p>
              <h1 className="type-h1 mt-5">
                Find the gaps before the deadline finds you
              </h1>
              <p className="type-lede mt-6 max-w-2xl">
                Tell us who is asking, what work you do, and what paperwork
                you already have. We&apos;ll turn it into a plain preliminary
                list of what looks covered and what may still need attention.
              </p>
              <TickRule
                id="tick-gap-check-page"
                className="mt-10 max-w-[18rem]"
              />
            </div>

            <ul className="divide-y divide-zinc-dust border-y border-zinc-dust">
              {EXPECTATIONS.map(({ icon: Icon, title, detail }) => (
                <li key={title} className="flex gap-4 py-4">
                  <Icon
                    aria-hidden
                    strokeWidth={1.5}
                    className="mt-0.5 h-5 w-5 shrink-0 text-verdigris"
                  />
                  <div>
                    <p className="type-label">{title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-wash">
                      {detail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="gap-check-form-heading"
        className="border-b border-zinc-dust bg-paper"
      >
        <div className="mx-auto max-w-3xl px-6 py-14 md:py-20">
          <div className="mx-auto mb-9 max-w-2xl text-center">
            <p className="tag">Your company and job</p>
            <h2 id="gap-check-form-heading" className="type-h2 mt-4">
              Start with what you know
            </h2>
            <p className="type-body mt-4">
              You do not need to know the name of every requirement. The
              answers below give us enough context to ask the useful questions.
            </p>
          </div>
          <IntakeForm />
        </div>
      </section>
    </main>
  );
}
