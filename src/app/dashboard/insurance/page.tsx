import { redirect } from "next/navigation";

import { getCompanyForEmail } from "@/lib/companies";
import { listInsuranceCoverages } from "@/lib/domain-dashboard";
import { currentWorkspace } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

export default async function InsurancePage() {
  const workspace = await currentWorkspace();
  if (!workspace) redirect("/sign-in");
  const company = await getCompanyForEmail(workspace.email);
  const rows = company ? await listInsuranceCoverages(company.id) : [];
  return (
    <main>
      <p className="tag">Coverage lines</p>
      <h1 className="type-h2 mt-2 text-millscale">Insurance</h1>
      {rows.length === 0 ? (
        <p className="type-body mt-5">Upload an ACORD 25 to extract coverage lines.</p>
      ) : (
        <ul className="mt-6 grid gap-2">
          {rows.map((row) => (
            <li key={row.id} className="border border-zinc-dust bg-paper p-4">
              <p className="font-medium text-millscale">{row.coverage_type}</p>
              <p className="mt-1 text-sm text-slate-wash">
                Each occurrence: {row.each_occurrence ?? "Needs review"}; aggregate: {row.general_aggregate ?? "Needs review"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
