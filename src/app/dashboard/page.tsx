import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, AlertTriangle, CheckCircle2, FileText } from "lucide-react";

import { currentWorkspace } from "@/lib/workspaces";
import { getCompanyForEmail, unconfirmedFields } from "@/lib/companies";
import { getReviewForSubmission, listDocumentsForEmail, listSubmissionsForEmail } from "@/lib/dashboard";
import { buildWorkspace } from "@/lib/workspace";
import { listCurrentRequirements } from "@/lib/domain-dashboard";
import { listDocumentsForEmail as listGenerated } from "@/lib/programs/store";
import { listMaintenanceDates, reminderState, todayIso } from "@/lib/maintenance";
import { offerablePrograms, programById } from "@/lib/programs/registry";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = { written_programs: "Written programs", statistics: "Safety statistics", recordkeeping: "Recordkeeping", insurance: "Insurance", questionnaire: "Client questionnaire", training: "Training evidence" };
function date(value: string) { return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }

export default async function DashboardPage() {
  const active = await currentWorkspace();
  if (!active) redirect("/sign-in");
  const [submissions, uploaded, generated, company, reminders] = await Promise.all([
    listSubmissionsForEmail(active.email), listDocumentsForEmail(active.email), listGenerated(active.email), getCompanyForEmail(active.email), listMaintenanceDates(active.email),
  ]);
  const project = submissions[0] ?? null;
  const activeReview = project?.analysis_status === "ok" ? await getReviewForSubmission(project.id) : null;
  const requirements = company ? await listCurrentRequirements(company.id) : [];
  const workspace = buildWorkspace({ submissions, documents: uploaded, activeReview, activeSubmission: project });
  const unconfirmedCompany = company ? unconfirmedFields(company) : [];
  const unreadable = uploaded.filter((file) => !file.readable);
  const unconfirmedRequirements = requirements.filter((item) => item.applicability === "unknown");
  const overdue = reminders.filter((item) => reminderState(item.due_date, todayIso()) === "overdue");
  const generators = offerablePrograms();
  const missingWithGenerator = requirements.filter((item) => item.status === "missing" && item.requirement_key.startsWith("program.") && generators.some((program) => item.requirement_key.includes(program.id) || program.matchesLabel?.(item.title)));
  const primaryAction = !project
    ? { title: "Start an approval project", detail: "Add the hiring client and platform when you are ready to prepare a complete approval file.", href: "/gap-check", cta: "Start approval preparation" }
    : workspace.next;
  const attention = [
    ...unreadable.map((file) => ({ key: file.id, title: `Replace ${file.file_name}`, detail: "We could not reliably read this file.", href: "/dashboard/documents", action: "Replace file" })),
    ...(unconfirmedRequirements.length ? [{ key: "requirements", title: `Confirm ${unconfirmedRequirements.length} client requirement${unconfirmedRequirements.length === 1 ? "" : "s"}`, detail: "These are possible requirements, not confirmed portal requirements.", href: "/dashboard/projects/requirements", action: "Review requirements" }] : []),
    ...(unconfirmedCompany.length ? [{ key: "company", title: `Confirm ${unconfirmedCompany.length} company detail${unconfirmedCompany.length === 1 ? "" : "s"}`, detail: "Check information that was inferred during intake.", href: "/dashboard/company", action: "Check company" }] : []),
    ...overdue.map((item) => ({ key: item.id, title: `${item.document_name} is overdue`, detail: `${item.kind === "expiry" ? "Expired" : "Review was due"} ${date(item.due_date)}.`, href: "/dashboard/maintenance", action: "Update date" })),
  ];
  const categories = Object.keys(CATEGORY_LABELS).map((key) => { const rows = requirements.filter((r) => r.category_key === key); return { key, label: CATEGORY_LABELS[key], ready: rows.filter((r) => ["draft","submitted","under_review","accepted"].includes(r.status)).length, total: rows.length, unknown: rows.filter((r) => r.applicability === "unknown").length }; });

  if (!company && submissions.length === 0 && generated.length === 0) return <main><p className="tag">Welcome to CertLoop</p><h1 className="type-h2 mt-2 text-millscale">What do you need to accomplish?</h1><p className="type-lede mt-3 max-w-2xl">Prepare for a client or platform approval, or create one safety document directly.</p><div className="mt-8 grid gap-4 md:grid-cols-2"><Link href="/gap-check" className="border border-zinc-dust bg-paper p-6 hover:border-verdigris"><h2 className="type-h3 text-millscale">Prepare for an approval</h2><p className="type-body mt-2">Enter the client and platform, upload what you have, and organize the work still needed.</p><span className="mt-5 inline-flex items-center gap-2 font-medium text-verdigris">Start an approval project <ArrowRight className="h-4 w-4" /></span></Link><Link href="/dashboard/programs" className="border border-zinc-dust bg-paper p-6 hover:border-verdigris"><h2 className="type-h3 text-millscale">Generate one document</h2><p className="type-body mt-2">Choose a working generator and prepare a Word and PDF draft in your company name.</p><span className="mt-5 inline-flex items-center gap-2 font-medium text-verdigris">Browse generators <ArrowRight className="h-4 w-4" /></span></Link></div></main>;

  return <main>
    <div className="flex flex-wrap items-start justify-between gap-5"><div><p className="tag">Current work</p><h1 className="type-h2 mt-2 text-millscale">{project?.hiring_client || company?.name || "Your workspace"}</h1><p className="mt-2 text-sm text-slate-wash">{project ? `${project.platform} · ${project.trade}${project.deadline ? ` · target ${date(project.deadline)}` : " · no target date entered"}` : "No active approval project"}</p></div>{project ? <Link href={`/dashboard/${project.id}`} className="btn-secondary">Open approval project</Link> : <Link href="/gap-check" className="btn-primary">Start approval project</Link>}</div>
    {project ? <p className="mt-4 border-l-2 border-zinc-dust bg-paper px-4 py-3 text-sm text-slate-wash">Requirements shown here come from your profile and supplied information. CertLoop cannot see private client portal requirements unless you provide them.</p> : null}

    <section className="mt-6 border-l-2 border-verdigris bg-paper p-6"><p className="tag">Next best action</p><h2 className="type-h3 mt-2 text-millscale">{missingWithGenerator[0] ? `Generate ${missingWithGenerator[0].title}` : primaryAction.title}</h2><p className="type-body mt-2 max-w-2xl">{missingWithGenerator[0] ? "This appears in your current requirement set and has a working self-service generator." : primaryAction.detail}</p><Link href={missingWithGenerator[0] ? `/dashboard/programs?selected=${missingWithGenerator[0].requirement_key.replace(/^program\./, "")}` : primaryAction.href} className="btn-primary mt-4 inline-flex items-center gap-2">{missingWithGenerator[0] ? "Generate document" : primaryAction.cta}<ArrowRight className="h-4 w-4" /></Link></section>

    {attention.length ? <section className="mt-8"><h2 className="type-h3 text-millscale">Needs your attention</h2><ul className="mt-3 grid gap-2 lg:grid-cols-2">{attention.slice(0,6).map((item) => <li key={item.key} className="flex items-start gap-3 border border-zinc-dust bg-paper p-4"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rust-flag" /><div className="min-w-0 flex-1"><p className="font-medium text-millscale">{item.title}</p><p className="mt-1 text-sm text-slate-wash">{item.detail}</p><Link href={item.href} className="mt-2 inline-block text-sm font-medium text-verdigris underline">{item.action}</Link></div></li>)}</ul></section> : null}

    {requirements.length ? <section className="mt-8"><div className="flex items-baseline justify-between"><h2 className="type-h3 text-millscale">Approval-file summary</h2><Link href="/dashboard/projects/requirements" className="text-sm text-verdigris underline">All requirements</Link></div><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{categories.filter((c) => c.total).map((c) => <div key={c.key} className="border border-zinc-dust bg-paper p-4"><p className="font-medium text-millscale">{c.label}</p><p className="mt-2 text-sm text-slate-wash">{c.ready} of {c.total} in progress or ready{c.unknown ? ` · ${c.unknown} need confirmation` : ""}</p></div>)}</div></section> : null}

    <div className="mt-8 grid gap-8 xl:grid-cols-2"><section><div className="flex items-baseline justify-between"><h2 className="type-h3 text-millscale">Documents ready</h2><Link href="/dashboard/documents" className="text-sm text-verdigris underline">All documents</Link></div>{generated.length ? <ul className="mt-3 grid gap-2">{generated.slice(0,4).map((doc) => <li key={doc.id}><Link href={`/dashboard/documents/${doc.id}`} className="flex items-center justify-between border border-zinc-dust bg-paper p-4"><span className="flex items-center gap-2 text-sm font-medium text-millscale"><CheckCircle2 className="h-4 w-4 text-verdigris" />{programById(doc.program_id)?.title ?? doc.program_id}</span><span className="text-xs text-slate-wash">Version {doc.current.version}</span></Link></li>)}</ul> : <div className="mt-3 border border-zinc-dust bg-paper p-5"><FileText className="h-4 w-4 text-slate-wash" /><p className="mt-2 text-sm text-slate-wash">No generated documents yet.</p><Link href="/dashboard/programs" className="mt-2 inline-block text-sm text-verdigris underline">Browse generators</Link></div>}</section><section><h2 className="type-h3 text-millscale">Upcoming deadlines</h2>{reminders.length ? <ul className="mt-3 grid gap-2">{reminders.slice(0,4).map((item) => <li key={item.id} className="border border-zinc-dust bg-paper p-4"><p className="text-sm font-medium text-millscale">{item.document_name}</p><p className={`mt-1 text-xs ${reminderState(item.due_date, todayIso()) === "overdue" ? "text-rust-flag" : "text-slate-wash"}`}>{date(item.due_date)} · {reminderState(item.due_date, todayIso()).replace("_", " ")}</p></li>)}</ul> : <p className="mt-3 border border-zinc-dust bg-paper p-5 text-sm text-slate-wash">No document dates entered. <Link href="/dashboard/maintenance" className="text-verdigris underline">Add a reminder</Link></p>}</section></div>
  </main>;
}
