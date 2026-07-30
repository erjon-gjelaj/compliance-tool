import { ClipboardList, FileSearch, ListChecks } from "lucide-react";

const STEPS = [
  {
    icon: ClipboardList,
    title: "You tell us the job",
    body: "Your trade, who is asking, and the platform. The first screen takes about a minute.",
  },
  {
    icon: FileSearch,
    title: "We read your documents",
    body: "Attach what you have. Anything we cannot read is named instead of silently skipped.",
  },
  {
    icon: ListChecks,
    title: "You get the list",
    body: "See what looks present, what appears missing, and what still needs confirming. The result stays in your dashboard.",
  },
];

export function HowItWorks() {
  return (
    <section
      aria-labelledby="how-it-works-heading"
      className="surface-dark border-b border-slate-wash"
    >
      <div className="mx-auto max-w-5xl px-6 py-16 md:py-20">
        <p className="tag">How it works</p>
        <h2
          id="how-it-works-heading"
          className="type-h2 mt-4 max-w-2xl"
        >
          From a pile of files to a clear next step
        </h2>

        <ol className="mt-10 grid border-y border-slate-wash/60 md:grid-cols-3 md:divide-x md:divide-slate-wash/60">
          {STEPS.map(({ icon: Icon, title, body }, index) => (
            <li
              key={title}
              className="border-b border-slate-wash/60 py-6 last:border-b-0 md:border-b-0 md:px-7 md:first:pl-0 md:last:pr-0"
            >
              <div className="flex items-center justify-between gap-3">
                <Icon
                  aria-hidden="true"
                  strokeWidth={1.5}
                  className="h-5 w-5 text-verdigris-pale"
                />
                <span className="tag">0{index + 1}</span>
              </div>
              <h3 className="type-h3 mt-5">
                {title}
              </h3>
              <p className="mt-2.5 text-[0.95rem] leading-7 text-zinc-dust">
                {body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
