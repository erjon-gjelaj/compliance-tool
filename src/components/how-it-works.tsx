import { ClipboardList, FileSearch, ListChecks } from "lucide-react";

const STEPS = [
  {
    icon: ClipboardList,
    title: "You tell us the job",
    body: "Your trade, who's asking you to register, which platform, and when they need you approved by. Everything after that screen is optional.",
  },
  {
    icon: FileSearch,
    title: "We read your documents",
    body: "Whatever you attach is read for the programs and records these platforms ask for, and compared against what your trade is normally asked to hold. Anything we couldn't open is listed as unread rather than passed over.",
  },
  {
    icon: ListChecks,
    title: "You get the list",
    body: "An email within a minute or two: what looks present, what looks missing, and what needs confirming with your hiring client. It stays in your dashboard afterwards.",
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
          className="type-h2 mt-4 max-w-2xl"
        >
          Three steps, and none of them need a phone call
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
              <h3 className="type-h3 mt-5">
                {title}
              </h3>
              <p className="type-body mt-2.5">
                {body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
