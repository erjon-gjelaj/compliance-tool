import { IntakeForm } from "@/components/intake-form";
import { TickRule } from "@/components/tick-rule";
import type { EntryReason } from "@/lib/entry-points";

/**
 * The shared body of the three named entry points.
 *
 * They are the same page with different framing on purpose. A rejection and a
 * new registration produce the same kind of record and go through the same
 * intake — what differs is which problem the person believes they have, and
 * that is worth meeting them on. Three routes that render one component keeps
 * the framing distinct without three forms drifting apart.
 *
 * `expect` is what they get back, listed rather than described, because the
 * question underneath all three doors is "is this going to be worth ten
 * minutes". Each line has to be something the review actually produces.
 */
export function EntryPage({
  tag,
  title,
  lede,
  tickId,
  expect,
  formHeading,
  formNote,
  entryReason,
}: {
  tag: string;
  title: string;
  lede: string;
  tickId: string;
  expect: string[];
  formHeading: string;
  formNote: string;
  entryReason: EntryReason;
}) {
  return (
    <main className="flex-1">
      <section className="border-b border-zinc-dust">
        <div className="mx-auto max-w-5xl px-6 pt-14 pb-12 md:pt-20 md:pb-16">
          <div className="grid gap-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:gap-16">
            <div>
              <p className="tag">{tag}</p>
              <h1 className="type-h1 mt-5">{title}</h1>
              <p className="type-lede mt-6">{lede}</p>
              <TickRule id={tickId} className="mt-10 max-w-[18rem]" />
            </div>

            <div className="border border-zinc-dust bg-paper md:mt-14">
              <div className="border-b border-zinc-dust px-5 py-3">
                <p className="tag">What you get back</p>
              </div>
              <ul className="divide-y divide-zinc-dust">
                {expect.map((line) => (
                  <li key={line} className="px-5 py-3.5">
                    <p className="text-sm leading-relaxed text-slate-wash">
                      {line}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section
        id="start"
        aria-labelledby="entry-form-heading"
        className="scroll-mt-8 border-b border-zinc-dust"
      >
        <div className="mx-auto max-w-5xl px-6 py-14 md:py-16">
          <div className="grid gap-10 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-14">
            <div>
              <h2 id="entry-form-heading" className="type-h2">
                {formHeading}
              </h2>
              <p className="type-body mt-5">{formNote}</p>
            </div>

            <IntakeForm entryReason={entryReason} />
          </div>
        </div>
      </section>
    </main>
  );
}
