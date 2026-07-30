"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { currentWorkspace, WORKSPACE_COOKIE } from "@/lib/workspaces";

export async function switchWorkspace(formData: FormData): Promise<never> {
  const workspace = await currentWorkspace();
  if (!workspace) redirect("/sign-in");

  const companyId = String(formData.get("company_id") ?? "");
  const allowed = [
    workspace.ownCompany,
    ...workspace.managedCompanies,
  ].some((company) => company?.id === companyId);

  const jar = await cookies();
  if (allowed) {
    jar.set(WORKSPACE_COOKIE, companyId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
  } else {
    jar.delete(WORKSPACE_COOKIE);
  }

  redirect("/dashboard");
}
