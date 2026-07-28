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
      className="border-b border-zinc-dust"
    >
      <div className="mx-auto max-w-5xl px-6 py-16 md:py-20">
        <p className="tag">Where to start</p>
        <h2 id="entry-points-heading" className="type-h2 mt-4 max-w-2xl">
          What brought you here?
        </h2>
        <p className="type-body mt-4 max-w-2xl">
          Four ways in, one file. Whichever you pick, everything you send stays
          in the same place.
        </p>

        <ul className="mt-12 grid gap-px border border-zinc-dust bg-zinc-dust sm:grid-cols-2">
          {ENTRY_POINTS.map(({ reason, href, headline, detail, action }) => (
            <li key={reason} className="bg-paper">
              <Link
                href={href}
                className="group flex h-full flex-col p-6 transition-colors hover:bg-galvanise md:p-7"
              >
                <h3 className="type-h3">{headline}</h3>
                <p className="type-body mt-3 flex-1">{detail}</p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-verdigris">
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
        </ul>
      </div>
    </section>
  );
}
