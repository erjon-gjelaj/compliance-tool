import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";

import { SITE_NAME } from "@/lib/constants";
import { currentClient } from "@/lib/auth/session";
import { signOut } from "@/app/sign-in/actions";
import { SubmitButton } from "@/components/submit-button";

/**
 * The gate on every signed-in page.
 *
 * A layout rather than middleware, on purpose. A layout runs on the server for
 * every route beneath it and cannot be skipped by a client-side navigation, so
 * "did we check?" has one answer for the whole section instead of one per page
 * — and a page added under /dashboard next month is covered without anyone
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
  const session = await currentClient();

  // No token, expired token, or a secret that has since been rotated all land
  // here. Nothing is rendered before the redirect, so an expired session can't
  // flash a page of someone's documents on the way out.
  if (!session) redirect("/sign-in");

  return (
    <div className="min-h-screen bg-galvanise">
      <div className="border-b border-zinc-dust bg-paper">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-4">
          <Link href="/dashboard" className="type-label text-millscale">
            Your {SITE_NAME} file
          </Link>

          <div className="flex items-center gap-4 text-sm text-slate-wash">
            <span className="hidden sm:inline">{session.email}</span>
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

      {children}
    </div>
  );
}
