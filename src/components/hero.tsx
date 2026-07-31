import Link from "next/link";
import { ArrowRight, Check, CircleAlert, CircleHelp, FileText } from "lucide-react";
import { GAP_CHECK_HREF } from "@/lib/nav";

/*
 * TODO-VERIFY: the three categories below come from business-model.md's
 * description of what these platforms ask contractors to submit (written
 * safety programs, training records, insurance documentation). They are
 * kept at category level on purpose. Do not add specific program names,
 * certifications, score thresholds, or deadlines here without sourcing
 * them to an actual regulation or platform document first.
 */
export function Hero() {
  return (
    <section className="border-b border-zinc-dust">
      <div className="mx-auto max-w-6xl px-6 pt-14 pb-14 md:pt-24 md:pb-20">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.03fr)_minmax(26rem,0.97fr)] lg:items-center lg:gap-16">
          <div>
            <p className="tag">For industrial subcontractors</p>
            <h1 className="type-h1 mt-5">
              Get your contractor file ready for ISNetworld or Avetta
            </h1>
            <p className="type-lede mt-6 max-w-xl">
              Check the paperwork you already have, understand a rejection,
              and generate supported company-specific safety programs—all in
              one workspace built for small industrial contractors.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link href={GAP_CHECK_HREF} className="btn-primary">
                Check my file free
              </Link>
              <Link href="/rejection" className="inline-flex items-center gap-2 text-sm font-semibold text-verdigris underline-offset-4 hover:underline">Review a rejected document <ArrowRight className="h-4 w-4" aria-hidden /></Link>
            </div>
            <p className="mt-5 text-sm leading-relaxed text-slate-wash">Free to start · No card · Your results and documents stay in your dashboard</p>
          </div>

          <div className="product-window" aria-label="Example gap check result">
              <div className="flex items-center justify-between border-b border-zinc-dust px-5 py-4">
                <div><p className="tag">Example result</p><p className="mt-1 font-semibold">Northline Industrial · ISNetworld</p></div>
                <span className="rounded-full bg-verdigris/10 px-3 py-1 text-xs font-semibold text-verdigris">Preliminary</span>
              </div>
              <div className="grid grid-cols-3 border-b border-zinc-dust text-center">
                <div className="p-4"><strong className="block text-2xl text-verdigris">3</strong><span className="text-xs text-slate-wash">present</span></div>
                <div className="border-x border-zinc-dust p-4"><strong className="block text-2xl text-rust-flag">2</strong><span className="text-xs text-slate-wash">missing</span></div>
                <div className="p-4"><strong className="block text-2xl">1</strong><span className="text-xs text-slate-wash">confirm</span></div>
              </div>
              <ul className="divide-y divide-zinc-dust px-5">
                <li className="flex gap-3 py-4"><Check className="mt-0.5 h-5 w-5 text-verdigris" aria-hidden/><div><p className="type-label">Certificate of insurance</p><p className="mt-1 text-sm text-slate-wash">Found in ACORD-25.pdf</p></div></li>
                <li className="flex gap-3 py-4"><CircleAlert className="mt-0.5 h-5 w-5 text-rust-flag" aria-hidden/><div className="flex-1"><p className="type-label">Emergency Action Plan</p><p className="mt-1 text-sm text-slate-wash">Not found in the uploaded file</p><Link href="/documents" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-verdigris">Generate this program <ArrowRight className="h-3.5 w-3.5"/></Link></div></li>
                <li className="flex gap-3 py-4"><CircleHelp className="mt-0.5 h-5 w-5 text-slate-wash" aria-hidden/><div><p className="type-label">Training evidence</p><p className="mt-1 text-sm text-slate-wash">Confirm the required records with your hiring client</p></div></li>
              </ul>
              <div className="flex items-center gap-2 bg-millscale px-5 py-3 text-xs text-zinc-dust"><FileText className="h-4 w-4 text-verdigris-pale" aria-hidden/>Example data—your result is based on the files and details you provide.</div>
          </div>
        </div>
      </div>
    </section>
  );
}
