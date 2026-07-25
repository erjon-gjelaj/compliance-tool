import { IntakeForm } from "@/components/intake-form";
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
              className="type-h2 mt-4"
            >
              Tell us the job, we&apos;ll tell you what&apos;s missing
            </h2>
            <p className="type-body mt-5">
              Most of the owners and office managers we hear from are doing
              this between running jobs, with a deadline already on the
              calendar. The first screen is all we need to start — everything
              after it is optional, and your answers are saved as you go.
            </p>
            <TickRule id="tick-gap-check" className="mt-8 hidden md:block" />
          </div>

          <IntakeForm />
        </div>
      </div>
    </section>
  );
}
