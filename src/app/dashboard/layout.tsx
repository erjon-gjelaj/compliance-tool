import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";

import { SITE_NAME } from "@/lib/constants";
import { signOut } from "@/app/sign-in/actions";
import { switchWorkspace } from "@/app/dashboard/workspace-actions";
import { SubmitButton } from "@/components/submit-button";
import { DashboardNav } from "@/components/dashboard-nav";
import { currentWorkspace } from "@/lib/workspaces";

/**
 * The gate on every signed-in page.
 *
 * A layout rather than middleware, on purpose. A layout runs on the server for
 * every route beneath it and cannot be skipped by a client-side navigation, so
 * "did we check?" has one answer for the whole section instead of one per page
 *; and a page added under /dashboard next month is covered without anyone
 * remembering to cover it.
 *
 * It is still not the only check. Each page re-derives the session and every
 * query filters on the address, because a layout establishes who is asking and
 * says nothing about what they may see.
 */

// Every page under here reads a cookie and live rows.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const workspace = await currentWorkspace();

  // No token, expired token, or a secret that has since been rotated all land
  // here. Nothing is rendered before the redirect, so an expired session can't
  // flash a page of someone's documents on the way out.
  if (!workspace) redirect("/sign-in");

  const choices = [
    workspace.ownCompany,
    ...workspace.managedCompanies,
  ].filter((company) => company !== null);

  return (
    <div className="min-h-screen bg-galvanise">
      <div className="border-b border-zinc-dust bg-paper">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-4">
          <Link href="/dashboard" className="type-label text-millscale">
            {SITE_NAME}
          </Link>

          <div className="flex items-center gap-4 text-sm text-slate-wash">
            <span className="hidden sm:inline">{workspace.viewerEmail}</span>
            <form action={signOut}>
              <SubmitButton
                pendingLabel="Signing out…"
                className="inline-flex cursor-pointer items-center gap-1.5 underline-offset-4 hover:underline disabled:opacity-70"
                icon={<LogOut aria-hidden className="h-4 w-4" />}
              >
                Sign out
              </SubmitButton>
            </form>
          </div>
        </div>
      </div>

      {workspace.canSwitch && choices.length > 0 ? (
        <div className="border-b border-zinc-dust bg-galvanise">
          <form
            action={switchWorkspace}
            className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-3"
          >
            <label htmlFor="company_id" className="type-label text-millscale">
              Workspace
            </label>
            <select
              id="company_id"
              name="company_id"
              defaultValue={workspace.company?.id ?? ""}
              className="min-w-0 max-w-sm border border-zinc-dust bg-paper px-3 py-2 text-sm text-millscale"
            >
              {choices.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
            <SubmitButton pendingLabel="Switching…" className="btn-primary">
              Switch
            </SubmitButton>
          </form>
        </div>
      ) : null}

      {/*
        Navigation beside the content on a wide screen, above it on a narrow
        one. The section is an application now rather than a page, and the
        thing that makes it read as one is that the same chrome is present
        everywhere in it.
      */}
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-6 lg:flex-row lg:gap-10 lg:py-10">
        <DashboardNav canManageClients={workspace.canSwitch} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
