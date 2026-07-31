import { redirect } from "next/navigation";
import Link from "next/link";

import { getCompanyForEmail } from "@/lib/companies";
import { listSafetyStatistics } from "@/lib/domain-dashboard";
import { currentWorkspace } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

export default async function StatisticsPage() {
  const workspace = await currentWorkspace();
  if (!workspace) redirect("/sign-in");
  const company = await getCompanyForEmail(workspace.email);
  const rows = company ? await listSafetyStatistics(company.id) : [];
  return (
    <main>
      <p className="tag">Three-year history</p>
      <h1 className="type-h2 mt-2 text-millscale">Safety statistics</h1>
      <p className="type-body mt-3 max-w-2xl">Upload OSHA 300A summaries to calculate TRIR, DART and LTIR from the hours and case counts shown on the form. Reported and calculated rates remain separate when they disagree.</p>
      <Link href="/dashboard/documents#upload" className="btn-primary mt-5 inline-flex">Upload OSHA 300A</Link>
      {rows.length === 0 ? (
        <section className="mt-6 border border-zinc-dust bg-paper p-6"><h2 className="type-h3 text-millscale">No calculated years yet</h2><p className="type-body mt-2">Processed years will show hours worked and calculated TRIR, DART and LTIR. Missing or unreadable inputs will be shown as needing review, never estimated.</p></section>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead><tr>{["Year","Hours","TRIR","DART","LTIR"].map((cell) => <th key={cell} className="border border-zinc-dust p-3">{cell}</th>)}</tr></thead>
            <tbody>{rows.map((row) => <tr key={row.id}><td className="border border-zinc-dust p-3">{row.report_year}</td><td className="border border-zinc-dust p-3">{row.hours_worked ?? "Needs review"}</td><td className="border border-zinc-dust p-3">{row.trir ?? "Needs review"}</td><td className="border border-zinc-dust p-3">{row.dart ?? "Needs review"}</td><td className="border border-zinc-dust p-3">{row.ltir ?? "Needs review"}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </main>
  );
}
