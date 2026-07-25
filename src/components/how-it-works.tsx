import { ClipboardList, FileSearch, ListChecks } from "lucide-react";

const STEPS = [
  {
    icon: ClipboardList,
    title: "You tell us the job",
    body: "Your trade, the hiring client asking you to register, and roughly how many people you run. That's the whole form.",
  },
  {
    icon: FileSearch,
    title: "Someone reads it",
    body: "Right now a person on our side does the comparison by hand rather than a script guessing at it. That's slower, and it's the reason the answer is worth reading.",
  },
  {
    icon: ListChecks,
    title: "You get the list",
    body: "One email: what's missing from your file, in the order worth tackling. No call to book, nothing to install.",
  },
];

export function HowItWorks() {
  return (
    <section
      aria-labelledby="how-it-works-heading"
      className="border-b border-zinc-dust"
    >
      <div className="mx-auto max-w-5xl px-6 py-16 md:py-20">
        <p className="tag">How it works</p>
        <h2
          id="how-it-works-heading"
          className="mt-4 max-w-2xl font-display text-3xl leading-tight font-semibold tracking-tight text-balance md:text-4xl"
        >
          Three steps, and the slow one is on us
        </h2>

        <ol className="mt-12 grid gap-px border border-zinc-dust bg-zinc-dust md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }, index) => (
            <li key={title} className="bg-paper p-6 md:p-7">
              <div className="flex items-center gap-3">
                <Icon
                  aria-hidden="true"
                  strokeWidth={1.5}
                  className="h-5 w-5 text-verdigris"
                />
                <span className="tag">Step {index + 1}</span>
              </div>
              <h3 className="mt-5 font-display text-xl font-semibold tracking-tight">
                {title}
              </h3>
              <p className="mt-2.5 text-[0.95rem] leading-relaxed text-slate-wash">
                {body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
