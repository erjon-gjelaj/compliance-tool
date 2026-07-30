import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ENTRY_POINTS } from "@/lib/entry-points";

/**
 * The four doors, on the home page.
 *
 * Placed above how-it-works and below the hero, because the question it
 * answers — "is this for my problem?" — comes before "how does it work". The
 * headings are the visitor's sentence rather than a feature name: someone
 * holding a rejection notice scans for the word rejected, not for "gap
 * analysis".
 *
 * All four go to the same intake. The differences are framing and, on the
 * rejection door, one extra field.
 */
export function EntryPointsSection() {
  return (
    <section
      aria-labelledby="entry-points-heading"
      className="border-b border-zinc-dust bg-paper"
    >
      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-16 md:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] md:gap-16 md:py-20">
        <div>
          <p className="tag">Where to start</p>
          <h2 id="entry-points-heading" className="type-h2 mt-4">
            Start with the problem in front of you
          </h2>
          <p className="type-body mt-4">
            You do not need to know which service or document you need.
            Choose the situation that sounds closest. Every route feeds the
            same company file.
          </p>
        </div>

        <ol className="divide-y divide-zinc-dust border-y border-zinc-dust">
          {ENTRY_POINTS.map(({ reason, href, headline, detail, action }, index) => (
            <li key={reason}>
              <Link
                href={href}
                className="group grid gap-4 py-6 transition-colors hover:bg-galvanise sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:items-start sm:px-4"
              >
                <span className="tag text-verdigris">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="type-h3">{headline}</h3>
                  <p className="type-body mt-2">{detail}</p>
                </div>
                <span className="inline-flex items-center gap-2 text-sm font-medium whitespace-nowrap text-verdigris sm:pt-1">
                  {action}
                  <ArrowRight
                    aria-hidden="true"
                    strokeWidth={2}
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  />
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
