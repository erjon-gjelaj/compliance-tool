"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCompanyForEmail } from "@/lib/companies";
import { regenerateRequirements } from "@/lib/domain-dashboard";
import { currentWorkspace } from "@/lib/workspaces";

export async function generateFile(): Promise<void> {
  const workspace = await currentWorkspace();
  if (!workspace) redirect("/sign-in");
  const company = await getCompanyForEmail(workspace.email);
  if (!company) redirect("/dashboard/company");

  const domain = (company as typeof company & {
    employee_count?: number | null;
    trade_codes?: string[];
    scope_of_work?: string[];
    domain_profile?: Record<string, unknown>;
  });

  await regenerateRequirements({
    input: {
      companyId: company.id,
      profile: {
        ...(domain.domain_profile ?? {}),
        employee_count: domain.employee_count ?? null,
      },
      tradeCodes:
        domain.trade_codes?.length
          ? domain.trade_codes
          : company.trade
            ? [company.trade]
            : [],
      scopeOfWork:
        domain.scope_of_work?.length
          ? domain.scope_of_work
          : company.operations
            ? [company.operations]
            : [],
      platformKey: company.platforms?.toLowerCase() ?? null,
      hiringClientId: null,
    },
    cause: "manual",
  });
  revalidatePath("/dashboard/file");
  revalidatePath("/dashboard");
}
