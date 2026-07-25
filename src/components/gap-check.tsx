import { LeadForm } from "@/components/lead-form";
import { TickRule } from "@/components/tick-rule";

export function GapCheck() {
  return (
    <section
      id="gap-check"
      aria-labelledby="gap-check-heading"
      className="scroll-mt-8 border-b border-zinc-dust"
    >
      <div className="mx-auto max-w-5xl px-6 py-16 md:py-20">
        <div className="grid gap-10 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-14">
          <div>
            <p className="tag">Free gap check</p>
            <h2
              id="gap-check-heading"
              className="mt-4 font-display text-3xl leading-tight font-semibold tracking-tight text-balance md:text-4xl"
            >
              Tell us the job, we&apos;ll tell you what&apos;s missing
            </h2>
            <p className="mt-5 text-[0.95rem] leading-relaxed text-slate-wash">
              Most of the owners and office managers we hear from are doing
              this between running jobs, with a deadline already on the
              calendar. Four questions is all we need to start.
            </p>
            <TickRule id="tick-gap-check" className="mt-8 hidden md:block" />
          </div>

          <LeadForm />
        </div>
      </div>
    </section>
  );
}
