import { redirect } from "next/navigation";

import { pageMetadata } from "@/lib/metadata";
import { currentWorkspace } from "@/lib/workspaces";
import { ConsultantBrandForm, InviteClientForm } from "@/components/client-workspace-forms";

export const metadata = pageMetadata({
  title: "Client workspaces",
  description: "Companies managed through your consultant workspace.",
  path: "/dashboard/clients",
  robots: { index: false, follow: false },
});

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const workspace = await currentWorkspace();
  if (!workspace) redirect("/sign-in");
  if (!workspace.canSwitch) redirect("/dashboard");

  return (
    <main className="max-w-3xl">
      <h1 className="type-h2 text-millscale">Client workspaces</h1>
      <p className="type-lede mt-3">
        Create a contractor workspace, invite its owner, and switch into it
        without changing who is signed in.
      </p>

      <div className="mt-8">
        <InviteClientForm />
      </div>

      <div className="mt-6">
        <ConsultantBrandForm
          value={workspace.ownCompany?.consultant_brand_name ?? workspace.ownCompany?.name ?? ""}
        />
      </div>

      <h2 className="type-label mt-10 text-millscale">Managed companies</h2>
      {workspace.managedCompanies.length === 0 ? (
        <p className="type-body mt-3">No client workspaces yet.</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {workspace.managedCompanies.map((company) => (
            <li key={company.id} className="border border-zinc-dust bg-paper p-4">
              <p className="text-sm font-medium text-millscale">{company.name}</p>
              <p className="mt-1 text-xs text-slate-wash">
                {company.email} · {company.accepted_at ? "invitation accepted" : "invitation pending"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
