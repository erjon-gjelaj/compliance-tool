import { redirect } from "next/navigation";

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
      <h1 className="type-h2 mt-2 text-millscale">Statistics</h1>
      {rows.length === 0 ? (
        <p className="type-body mt-5">Upload a 300A to calculate and reconcile rates.</p>
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
