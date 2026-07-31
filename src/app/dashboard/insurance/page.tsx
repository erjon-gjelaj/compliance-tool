import { redirect } from "next/navigation";
import Link from "next/link";

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
      <p className="type-body mt-3 max-w-2xl">Upload an ACORD 25 with the current approval project. CertLoop extracts visible coverage lines and flags uncertain fields for review; it does not decide whether a client will accept the policy.</p>
      <Link href="/dashboard/documents#upload" className="btn-primary mt-5 inline-flex">Upload an ACORD 25</Link>
      {rows.length === 0 ? (
        <section className="mt-6 border border-zinc-dust bg-paper p-6"><h2 className="type-h3 text-millscale">No extracted coverage yet</h2><p className="type-body mt-2">After upload and processing, general liability, workers compensation, auto, umbrella and other visible coverage lines appear here. Unreadable or absent values remain marked for review.</p></section>
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
