import Link from "next/link";
import { ArrowRight, FileCheck2, FileOutput, FolderKanban, SearchCheck } from "lucide-react";

const STEPS = [
  { icon: SearchCheck, title: "Find the problem", text: "Upload what you have or paste the reviewer's comments. CertLoop separates present, missing, uncertain, and unreadable evidence." },
  { icon: FileCheck2, title: "Choose the next action", text: "Generate a supported program, upload a clearer file, confirm a private requirement, or ask for human help." },
  { icon: FileOutput, title: "Prepare the paperwork", text: "Answer a short company-specific questionnaire and download supported programs in Word and PDF." },
  { icon: FolderKanban, title: "Keep the work together", text: "Return to your company workspace for results, completed documents, client projects, and maintenance dates." },
] as const;

const PROGRAMS = ["Hazard Communication", "Personal Protective Equipment", "Emergency Action Plan", "Incident Reporting & Investigation"];

export function ProductStory() {
  return <>
    <section id="product" aria-labelledby="product-heading" className="border-b border-zinc-dust">
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <div className="max-w-3xl"><p className="tag">From question to completed file</p><h2 id="product-heading" className="type-h2 mt-4">A guided path through contractor prequalification paperwork</h2><p className="type-lede mt-5">CertLoop is more than a checklist. It connects each finding to a practical next step and keeps the result in the same company workspace.</p></div>
        <ol className="mt-10 grid gap-px border border-zinc-dust bg-zinc-dust md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({icon: Icon,title,text}, i) => <li key={title} className="bg-paper p-6"><span className="flex items-center justify-between"><Icon className="h-5 w-5 text-verdigris" aria-hidden/><span className="tag">0{i+1}</span></span><h3 className="type-h3 mt-8">{title}</h3><p className="type-body mt-3">{text}</p></li>)}
        </ol>
      </div>
    </section>
    <section aria-labelledby="programs-heading" className="border-b border-zinc-dust bg-paper">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 md:grid-cols-[0.9fr_1.1fr] md:py-24">
        <div><p className="tag">Written-program generation</p><h2 id="programs-heading" className="type-h2 mt-4">Already know the document you need?</h2><p className="type-body mt-5">Go straight to a working generator. Each one uses your company profile and questionnaire answers, then stores editable Word and PDF files in your dashboard.</p><Link href="/documents" className="btn-primary mt-7">View available generators <ArrowRight className="h-4 w-4" aria-hidden/></Link></div>
        <div className="border border-zinc-dust bg-galvanise p-2"><ul className="grid gap-2 sm:grid-cols-2">{PROGRAMS.map((p)=><li key={p} className="flex min-h-28 flex-col justify-between bg-paper p-5"><FileOutput className="h-5 w-5 text-verdigris" aria-hidden/><span className="type-label mt-5">{p}</span></li>)}</ul><p className="px-3 py-3 text-xs leading-relaxed text-slate-wash">Four generators are available today. Other program types are clearly marked unavailable and can be discussed as human-assisted work.</p></div>
      </div>
    </section>
    <section aria-labelledby="limits-heading" className="border-b border-zinc-dust surface-dark"><div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-[0.75fr_1.25fr] md:py-16"><div><p className="tag">Clear boundaries</p><h2 id="limits-heading" className="type-h2 mt-4">Preparation help, not a promise of approval</h2></div><ul className="grid gap-4 text-sm leading-relaxed text-zinc-dust sm:grid-cols-2"><li className="border-l border-verdigris-pale pl-4"><strong className="block text-paper">Independent</strong>Not affiliated with or endorsed by ISNetworld or Avetta.</li><li className="border-l border-verdigris-pale pl-4"><strong className="block text-paper">No portal access</strong>We do not log in or submit through your private account.</li><li className="border-l border-verdigris-pale pl-4"><strong className="block text-paper">Evidence-based</strong>Private client requirements must be provided by you.</li><li className="border-l border-verdigris-pale pl-4"><strong className="block text-paper">No guarantee</strong>The platform or hiring client makes the final decision.</li></ul></div></section>
  </>;
}
