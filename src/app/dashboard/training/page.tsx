import { redirect } from "next/navigation";
import Link from "next/link";

import { getCompanyForEmail } from "@/lib/companies";
import { listTrainingRecords } from "@/lib/domain-dashboard";
import { currentWorkspace } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

export default async function TrainingPage() {
  const workspace = await currentWorkspace();
  if (!workspace) redirect("/sign-in");
  const company = await getCompanyForEmail(workspace.email);
  const rows = company ? await listTrainingRecords(company.id) : [];
  return (
    <main>
      <p className="tag">Program evidence matrix</p>
      <h1 className="type-h2 mt-2 text-millscale">Training</h1>
      <p className="type-body mt-3 max-w-2xl">Keep completed rosters with the approval project, or create a blank sign-in sheet below. After the training, collect attendee and instructor signatures and upload the completed sheet.</p>
      <Link href="/dashboard/documents#upload" className="btn-primary mt-5 inline-flex">Upload training evidence</Link>
      {rows.length === 0 ? (
        <section className="mt-6 border border-zinc-dust bg-paper p-6"><h2 className="type-h3 text-millscale">No completed roster evidence yet</h2><p className="type-body mt-2">Upload signed rosters or toolbox-talk sheets. CertLoop will retain the topic, date, instructor, attendee list and page evidence when readable.</p></section>
      ) : (
        <ul className="mt-6 grid gap-2">
          {rows.map((row) => (
            <li key={row.id} className="border border-zinc-dust bg-paper p-4">
              <p className="font-medium text-millscale">{row.program_key ?? "Topic needs confirmation"}</p>
              <p className="mt-1 text-sm text-slate-wash">
                {row.training_date ?? "Date needed"}; instructor {row.instructor_name ?? "needs confirmation"}; signature {row.instructor_signature === true ? "found" : "needs confirmation"}
              </p>
            </li>
          ))}
        </ul>
      )}
      <section className="mt-10 border border-zinc-dust bg-paper p-5">
        <h2 className="type-h3 text-millscale">Prepare a sign-in sheet</h2>
        <form
          action="/api/training-roster"
          method="post"
          className="mt-4 grid gap-3"
        >
          <input name="program_title" required placeholder="Training topic or program" className="border border-zinc-dust bg-white px-3 py-2" />
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="training_date" type="date" required className="border border-zinc-dust bg-white px-3 py-2" />
            <input name="instructor_name" required placeholder="Instructor name" className="border border-zinc-dust bg-white px-3 py-2" />
          </div>
          <textarea name="attendees" required rows={6} placeholder={"Attendee names, one per line"} className="border border-zinc-dust bg-white px-3 py-2" />
          <button type="submit" className="btn-primary justify-self-start">
            Download sign-in sheet PDF
          </button>
        </form>
      </section>
    </main>
  );
}
