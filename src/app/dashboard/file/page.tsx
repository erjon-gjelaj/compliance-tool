import Link from "next/link";
import { redirect } from "next/navigation";

import { getCompanyForEmail } from "@/lib/companies";
import { listCurrentRequirements } from "@/lib/domain-dashboard";
import { currentWorkspace } from "@/lib/workspaces";
import { generateFile } from "./actions";

const CATEGORIES = [
  ["written_programs", "Written programs"],
  ["statistics", "Statistics"],
  ["recordkeeping", "Recordkeeping"],
  ["insurance", "Insurance"],
  ["questionnaire", "Questionnaire"],
  ["training", "Training"],
] as const;

export const dynamic = "force-dynamic";

export default async function FilePage() {
  const workspace = await currentWorkspace();
  if (!workspace) redirect("/sign-in");
  const company = await getCompanyForEmail(workspace.email);
  const requirements = company
    ? await listCurrentRequirements(company.id)
    : [];

  return (
    <main>
      <p className="tag">Current approval project</p>
      <h1 className="type-h2 mt-2 text-millscale">Requirements</h1>
      <p className="type-body mt-3 max-w-2xl">
        Grouped by the six evidence categories. Unknown items need confirmation
        from the hiring client; they are not treated as requirements by guess.
      </p>
      {requirements.length === 0 ? (
        <section className="mt-6 border border-zinc-dust bg-paper p-6">
          <h2 className="type-h3 text-millscale">Generate the first requirement set</h2>
          <p className="type-body mt-2">Complete the company profile first.</p>
          <Link href="/dashboard/company" className="btn-primary mt-4 inline-flex">
            Complete company profile
          </Link>
          {company ? (
            <form action={generateFile} className="mt-3">
              <button type="submit" className="text-sm text-verdigris underline">
                Generate with known profile facts
              </button>
            </form>
          ) : null}
        </section>
      ) : (
        CATEGORIES.map(([key, title]) => (
          <section key={key} className="mt-8">
            <h2 className="type-h3 text-millscale">{title}</h2>
            <ul className="mt-3 grid gap-2">
              {requirements
                .filter((entry) => entry.category_key === key)
                .map((entry) => (
                  <li key={entry.id} className="border border-zinc-dust bg-paper p-4">
                    <div className="flex justify-between gap-4">
                      <p className="font-medium text-millscale">{entry.title}</p>
                      <span className="text-sm text-slate-wash">{entry.status}</span>
                    </div>
                    {entry.applicability === "unknown" ? (
                      <p className="mt-1 text-sm text-rust-flag">
                        Confirm whether this applies in the live account.
                      </p>
                    ) : null}
                    {entry.requirement_key.startsWith("program.") ? (
                      <Link
                        href={`/dashboard/programs?selected=${encodeURIComponent(entry.requirement_key.replace(/^program\./, ""))}`}
                        className="mt-2 inline-block text-sm text-verdigris underline"
                      >
                        See document options
                      </Link>
                    ) : null}
                  </li>
                ))}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
