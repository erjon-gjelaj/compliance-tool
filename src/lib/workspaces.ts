import "server-only";

import { cookies } from "next/headers";

import { currentClient } from "@/lib/auth/session";
import {
  getCompanyForEmail,
  getManagedCompany,
  listManagedCompanies,
  type CompanyRow,
} from "@/lib/companies";
import { can, planOf } from "@/lib/entitlements";

export const WORKSPACE_COOKIE = "certloop_workspace";

export type WorkspaceContext = {
  viewerEmail: string;
  email: string;
  company: CompanyRow | null;
  ownCompany: CompanyRow | null;
  managedCompanies: CompanyRow[];
  canSwitch: boolean;
};

export function resolveWorkspaceCompany({
  ownCompany,
  managedCompanies,
  permitted,
  selectedId,
}: {
  ownCompany: CompanyRow | null;
  managedCompanies: CompanyRow[];
  permitted: boolean;
  selectedId?: string;
}): CompanyRow | null {
  if (!permitted || !selectedId) return ownCompany;
  return (
    managedCompanies.find((entry) => entry.id === selectedId) ?? ownCompany
  );
}

/**
 * Resolves the active contractor without ever changing who is signed in.
 *
 * The cookie is only a preference. Every request rechecks the consultant plan
 * and the managed_by_email relationship before it can affect a query.
 */
export async function currentWorkspace(): Promise<WorkspaceContext | null> {
  const session = await currentClient();
  if (!session) return null;

  const ownCompany = await getCompanyForEmail(session.email);
  const permitted = can(planOf(ownCompany), "multiple_companies");
  const managedCompanies = permitted
    ? await listManagedCompanies(session.email)
    : [];

  const selected = permitted
    ? (await cookies()).get(WORKSPACE_COOKIE)?.value
    : undefined;
  const company = resolveWorkspaceCompany({
    ownCompany,
    managedCompanies,
    permitted,
    selectedId: selected,
  });

  return {
    viewerEmail: session.email,
    email: company?.email ?? session.email,
    company,
    ownCompany,
    managedCompanies,
    canSwitch: permitted,
  };
}

export async function companyIsAccessible(
  viewerEmail: string,
  companyId: string,
): Promise<boolean> {
  const own = await getCompanyForEmail(viewerEmail);
  if (own?.id === companyId) return true;
  if (!can(planOf(own), "multiple_companies")) return false;
  return Boolean(await getManagedCompany(viewerEmail, companyId));
}
