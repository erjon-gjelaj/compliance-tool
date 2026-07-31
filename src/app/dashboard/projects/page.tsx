import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, FileWarning, Plus } from "lucide-react";

import { currentWorkspace } from "@/lib/workspaces";
import { listSubmissionsForEmail } from "@/lib/dashboard";
import { getCompanyForEmail } from "@/lib/companies";
import { listCurrentRequirements } from "@/lib/domain-dashboard";

export const dynamic = "force-dynamic";

function date(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

export default async function ProjectsPage() {
  const workspace = await currentWorkspace();
  if (!workspace) redirect("/sign-in");
  const [projects, company] = await Promise.all([
    listSubmissionsForEmail(workspace.email),
    getCompanyForEmail(workspace.email),
  ]);
  const requirements = company ? await listCurrentRequirements(company.id) : [];

  return (
    <main>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="tag">Client and platform work</p>
          <h1 className="type-h2 mt-2 text-millscale">Approval projects</h1>
          <p className="type-body mt-3 max-w-2xl">Each project keeps the client, platform, uploaded evidence, review and target date together.</p>
        </div>
        <Link href="/gap-check" className="btn-primary inline-flex items-center gap-2"><Plus className="h-4 w-4" />New approval project</Link>
      </div>

      {projects.length === 0 ? (
        <section className="mt-8 border border-zinc-dust bg-paper p-7">
          <h2 className="type-h3 text-millscale">No approval project yet</h2>
          <p className="type-body mt-2 max-w-xl">Start with a hiring client or platform. If you only need one document, use Generate documents instead.</p>
          <div className="mt-5 flex flex-wrap gap-3"><Link href="/gap-check" className="btn-primary">Start approval preparation</Link><Link href="/dashboard/programs" className="btn-secondary">Generate one document</Link></div>
        </section>
      ) : (
        <ul className="mt-8 grid gap-3 xl:grid-cols-2">
          {projects.map((project, index) => {
            const overdue = Boolean(project.deadline && project.deadline < new Date().toISOString().slice(0, 10));
            return <li key={project.id} className="border border-zinc-dust bg-paper p-5">
              <div className="flex items-start justify-between gap-4">
                <div><p className="text-xs font-medium uppercase tracking-wide text-verdigris">{index === 0 ? "Current project" : "Approval project"}</p><h2 className="type-h3 mt-1 text-millscale">{project.hiring_client || "Hiring client not entered"}</h2><p className="mt-1 text-sm text-slate-wash">{project.platform} · {project.trade}</p></div>
                <span className={`text-xs font-medium ${project.status === "partial" ? "text-rust-flag" : "text-verdigris"}`}>{project.status === "partial" ? `Intake step ${project.last_step} of 4` : project.hasReview ? "Review ready" : "Evidence received"}</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 border-y border-zinc-dust py-3 text-sm"><div><span className="block text-xs text-slate-wash">Files</span>{project.documentCount}</div><div><span className="block text-xs text-slate-wash">Requirements</span>{index === 0 ? requirements.length : "Not linked"}</div><div><span className="block text-xs text-slate-wash">Target</span><span className={overdue ? "text-rust-flag" : ""}>{project.deadline ? date(project.deadline) : "Not provided"}</span></div></div>
              {index === 0 && requirements.some((item) => item.applicability === "unknown") ? <p className="mt-3 flex gap-2 text-sm text-rust-flag"><FileWarning className="mt-0.5 h-4 w-4 shrink-0" />Some requirements still need confirmation from the client or live platform account.</p> : null}
              <div className="mt-4 flex flex-wrap gap-4 text-sm"><Link href={project.status === "partial" ? `/dashboard/${project.id}/continue` : `/dashboard/${project.id}`} className="inline-flex items-center gap-1 font-medium text-verdigris">{project.status === "partial" ? "Continue intake" : "Open project"}<ArrowRight className="h-4 w-4" /></Link>{index === 0 ? <><Link href="/dashboard/projects/requirements" className="text-millscale underline underline-offset-4">Requirements</Link><Link href="/dashboard/training" className="text-millscale underline underline-offset-4">Training</Link><Link href="/dashboard/insurance" className="text-millscale underline underline-offset-4">Insurance</Link><Link href="/dashboard/statistics" className="text-millscale underline underline-offset-4">Safety statistics</Link></> : null}</div>
            </li>;
          })}
        </ul>
      )}
    </main>
  );
}
