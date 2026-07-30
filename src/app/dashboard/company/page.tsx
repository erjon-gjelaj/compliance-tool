import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { SITE_NAME } from "@/lib/constants";
import { pageMetadata } from "@/lib/metadata";
import { currentWorkspace } from "@/lib/workspaces";
import { getCompanyForEmail, unconfirmedFields } from "@/lib/companies";
import { CompanyForm } from "@/components/company-form";

export const metadata = pageMetadata({
  title: "Your company",
  description: `The company details ${SITE_NAME} reuses across your requests.`,
  path: "/dashboard/company",
  robots: { index: false, follow: false },
});

export const dynamic = "force-dynamic";

export default async function CompanyPage() {
  const workspace = await currentWorkspace();
  if (!workspace) redirect("/sign-in");

  const company = await getCompanyForEmail(workspace.email);

  return (
    <main className="max-w-3xl">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-slate-wash underline-offset-4 hover:underline"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" />
        Your workspace
      </Link>

      <h1 className="type-h2 mt-4 text-millscale">Your company</h1>
      <p className="type-lede mt-3">
        Fill this in once and every request starts from it instead of asking you
        again. Only the name is needed &mdash; the rest sharpens the answer.
      </p>

      <div className="mt-8">
        <CompanyForm
          company={company}
          unconfirmed={company ? unconfirmedFields(company) : []}
        />
      </div>

      <p className="type-body mt-8 border-t border-zinc-dust pt-6">
        This is your description of your own company. It is not a hazard
        assessment and nothing here is treated as evidence of a programme,
        training, or a certificate &mdash; those have to be documents we can
        read.
      </p>
    </main>
  );
}
