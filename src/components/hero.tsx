import { FileText, GraduationCap, ShieldCheck } from "lucide-react";
import { TickRule } from "@/components/tick-rule";

/*
 * TODO-VERIFY: the three categories below come from business-model.md's
 * description of what these platforms ask contractors to submit (written
 * safety programs, training records, insurance documentation). They are
 * kept at category level on purpose. Do not add specific program names,
 * certifications, score thresholds, or deadlines here without sourcing
 * them to an actual regulation or platform document first.
 */
const CHECK_AREAS = [
  {
    icon: FileText,
    label: "Written programs",
    note: "The safety programs you're asked to submit in writing.",
  },
  {
    icon: GraduationCap,
    label: "Training records",
    note: "Proof your crew has the training the job calls for.",
  },
  {
    icon: ShieldCheck,
    label: "Insurance documents",
    note: "Certificates and limits the hiring client wants on file.",
  },
];

export function Hero() {
  return (
    <section className="border-b border-zinc-dust">
      <div className="mx-auto max-w-5xl px-6 pt-16 pb-14 md:pt-24 md:pb-20">
        <div className="grid gap-12 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] md:gap-16">
          <div>
            <p className="tag">For industrial subcontractors</p>
            <h1 className="type-h1 mt-5">
              Find out what your ISNetworld or Avetta file is missing
            </h1>
            <p className="type-lede mt-6 max-w-xl">
              A plant told your crew to get prequalified before the next
              shutdown. Tell us your trade and who&apos;s asking, and we&apos;ll
              come back with a plain list of the paperwork you still need to
              put together — no charge for the list.
            </p>

            {/*
             * TODO-VERIFY: consultant cost ($1,500-$4,000) and turnaround
             * (30-45 days) in business-model.md are flagged as unverified
             * early research, so the copy stays qualitative until someone
             * confirms current market rates.
             */}
            <ul className="mt-8 space-y-3">
              <li className="type-body flex gap-3">
                <span
                  aria-hidden="true"
                  className="mt-[0.6em] h-px w-4 shrink-0 bg-verdigris"
                />
                <span>
                  A compliance consultant will sort it out, on a retainer and a
                  timeline that doesn&apos;t fit a shutdown window.
                </span>
              </li>
              <li className="type-body flex gap-3">
                <span
                  aria-hidden="true"
                  className="mt-[0.6em] h-px w-4 shrink-0 bg-verdigris"
                />
                <span>
                  Template packs sold online aren&apos;t written for your trade
                  or for the specific client asking you to register.
                </span>
              </li>
            </ul>

            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
              <a
                href="#gap-check"
                className="btn-primary"
              >
                Get your free gap check
              </a>
              <span className="text-xs text-slate-wash">
                One short screen to start. No account, no card.
              </span>
            </div>
          </div>

          <div className="md:pt-12">
            <div className="border border-zinc-dust bg-paper">
              <div className="border-b border-zinc-dust px-5 py-3">
                <p className="tag">What a gap check covers</p>
              </div>
              <ul className="divide-y divide-zinc-dust">
                {CHECK_AREAS.map(({ icon: Icon, label, note }) => (
                  <li key={label} className="flex gap-3.5 px-5 py-4">
                    <Icon
                      aria-hidden="true"
                      strokeWidth={1.5}
                      className="mt-0.5 h-5 w-5 shrink-0 text-verdigris"
                    />
                    <div>
                      <p className="type-label">
                        {label}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-wash">
                        {note}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <TickRule id="tick-hero" className="text-zinc-dust" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
