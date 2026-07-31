import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, Search } from "lucide-react";

import { currentWorkspace } from "@/lib/workspaces";
import { offerablePrograms } from "@/lib/programs/registry";
import { listDocumentsForEmail } from "@/lib/programs/store";
import { getCompanyForEmail } from "@/lib/companies";
import { listCurrentRequirements } from "@/lib/domain-dashboard";
import { PROGRAM_CATALOG, programConfigByKey } from "@/lib/config";
import { customerProgramAction } from "@/lib/programs/customer-state";

export const dynamic = "force-dynamic";

export default async function ProgramsPage({ searchParams }: { searchParams: Promise<{ q?: string; selected?: string }> }) {
  const workspace = await currentWorkspace();
  if (!workspace) redirect("/sign-in");
  const params = await searchParams;
  const [held, company] = await Promise.all([listDocumentsForEmail(workspace.email), getCompanyForEmail(workspace.email)]);
  const requirements = company ? await listCurrentRequirements(company.id) : [];
  const requiredKeys = new Set(requirements.filter((r) => r.category_key === "written_programs").map((r) => r.requirement_key.replace(/^program\./, "")));
  const generators = offerablePrograms();
  const generatorByKey = new Map(generators.map((generator) => [programConfigByKey(generator.id)?.program_key ?? generator.id, generator]));
  const heldByKey = new Map(held.map((document) => [programConfigByKey(document.program_id)?.program_key ?? document.program_id, document]));
  const query = params.q?.trim().toLowerCase() ?? "";
  const rows = PROGRAM_CATALOG.filter((program) => !query || program.title.toLowerCase().includes(query));
  const sorted = [...rows].sort((a, b) => Number(requiredKeys.has(b.program_key)) - Number(requiredKeys.has(a.program_key)) || a.title.localeCompare(b.title));

  return <main>
    <p className="tag">Self-service document library</p>
    <h1 className="type-h2 mt-2 text-millscale">Generate documents</h1>
    <p className="type-body mt-3 max-w-3xl">Create an individual document or work from the recommendations for your current approval project. Only programs with a working generator show a Generate action.</p>
    {!company?.name ? <div className="mt-5 border-l-2 border-rust-flag bg-paper p-4 text-sm">Add your company name before generating a document. <Link href="/dashboard/company" className="text-verdigris underline">Update company</Link></div> : null}
    <form className="mt-6 flex max-w-xl gap-2" role="search"><label className="sr-only" htmlFor="program-search">Search programs</label><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-wash" /><input id="program-search" name="q" defaultValue={params.q} placeholder="Search safety programs" className="w-full border border-zinc-dust bg-paper py-2.5 pl-10 pr-3" /></div><button className="btn-secondary">Search</button></form>

    <div className="mt-8 flex flex-wrap gap-3 text-xs text-slate-wash"><span><strong className="text-millscale">{generators.length}</strong> generators available</span><span><strong className="text-millscale">{held.length}</strong> documents ready</span>{requirements.length ? <span><strong className="text-millscale">{requiredKeys.size}</strong> recommended for current project</span> : null}</div>
    <ul className="mt-4 grid gap-2">
      {sorted.map((program) => {
        const generator = generatorByKey.get(program.program_key);
        const existing = heldByKey.get(program.program_key);
        const recommended = requiredKeys.has(program.program_key);
        const selected = params.selected === program.program_key;
        const requirement = requirements.find((item) => item.requirement_key === `program.${program.program_key}`);
        const action = customerProgramAction({ programKey: program.program_key, programTitle: program.title, generatorId: generator?.id, documentId: existing?.id, applicability: requirement?.applicability });
        return <li id={`program-${program.program_key}`} key={program.program_key} className={`border bg-paper p-4 ${selected ? "border-verdigris ring-1 ring-verdigris" : "border-zinc-dust"}`}>
          <div className="flex flex-wrap items-center justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-medium text-millscale">{program.title}</h2>{recommended ? <span className="bg-verdigris/10 px-2 py-0.5 text-xs text-verdigris">Recommended for project</span> : null}</div><p className="mt-1 text-sm text-slate-wash">{existing ? `Version ${existing.current.version} is ready` : generator ? "Working generator: Word and PDF" : "Generator not currently available"}</p></div>
          {action.href ? <Link href={action.href} className={action.state === "generate" ? "btn-primary" : action.state === "ready" ? "btn-secondary inline-flex items-center gap-2" : "text-sm font-medium text-verdigris underline underline-offset-4"}>{action.state === "ready" ? <Check className="h-4 w-4" /> : null}{action.label}</Link> : <span className="text-sm text-slate-wash">{action.label}</span>}</div>
        </li>;
      })}
    </ul>
    {sorted.length === 0 ? <p className="mt-6 border border-zinc-dust bg-paper p-6">No programs match that search.</p> : null}
  </main>;
}
