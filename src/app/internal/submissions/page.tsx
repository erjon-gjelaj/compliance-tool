import { redirect } from "next/navigation";
import { FileText, Lock } from "lucide-react";

import {
  closeInternalSession,
  hasInternalSession,
  internalAccessConfigured,
  openInternalSession,
} from "@/lib/internal-auth";
import { listSubmissions, type SubmissionListRow } from "@/lib/submissions";
import { SITE_NAME } from "@/lib/constants";
import { SubmitButton } from "@/components/submit-button";

/**
 * The internal submissions list.
 *
 * Read-only on purpose. Deleting a submission stays behind the DELETE
 * endpoint and a curl command rather than a button on a page reachable with a
 * single shared secret — a stray click should not be able to destroy a
 * customer's uploads.
 */

// Never prerendered, never cached: it reads a cookie and live rows.
export const dynamic = "force-dynamic";

async function signIn(formData: FormData) {
  "use server";
  const secret = String(formData.get("secret") ?? "");
  const ok = await openInternalSession(secret);
  // Redirect either way. The failure path returns to the same URL with a flag
  // rather than rendering a message inline, so the posted secret does not sit
  // in the form's resubmit buffer.
  redirect(ok ? "/internal/submissions" : "/internal/submissions?denied=1");
}

async function signOut() {
  "use server";
  await closeInternalSession();
  redirect("/internal/submissions");
}

function Gate({ denied }: { denied: boolean }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="border border-zinc-dust bg-paper p-8">
        <Lock aria-hidden className="mb-4 h-5 w-5 text-slate-wash" />
        <h1 className="text-xl font-semibold tracking-tight text-millscale">
          {SITE_NAME} internal
        </h1>
        <p className="mt-2 text-sm text-slate-wash">
          This page is not part of the public site.
        </p>

        <form action={signIn} className="mt-6">
          <label
            htmlFor="secret"
            className="block text-sm font-medium text-millscale"
          >
            Access key
          </label>
          <input
            id="secret"
            name="secret"
            type="password"
            autoComplete="off"
            required
            className="mt-2 w-full border border-zinc-dust bg-galvanise px-3 py-2 text-sm text-millscale"
          />
          {denied ? (
            <p className="mt-3 text-sm text-rust-flag">
              That key was not accepted.
            </p>
          ) : null}
          <SubmitButton
            pendingLabel="Checking…"
            className="mt-4 inline-flex w-full items-center justify-center gap-2 bg-verdigris px-4 py-2 text-sm font-semibold text-paper disabled:opacity-70"
          >
            Continue
          </SubmitButton>
        </form>
      </div>
    </main>
  );
}

function Unconfigured() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="border border-zinc-dust bg-paper p-8">
        <h1 className="text-xl font-semibold tracking-tight text-millscale">
          Not configured
        </h1>
        <p className="mt-2 text-sm text-slate-wash">
          <code>ADMIN_SECRET</code> is not set in this environment, so there is
          no key that could open this page. Set it and redeploy.
        </p>
      </div>
    </main>
  );
}

const ANALYSIS_LABEL: Record<string, string> = {
  ok: "Review sent",
  fallback: "Explainer sent",
  pending: "Running",
};

function Row({ row }: { row: SubmissionListRow }) {
  const partial = row.status === "partial";

  return (
    <tr className="border-t border-zinc-dust align-top">
      <td className="px-3 py-3 text-sm whitespace-nowrap text-slate-wash">
        {new Date(row.created_at).toLocaleString("en-GB", {
          dateStyle: "short",
          timeStyle: "short",
        })}
      </td>
      <td className="px-3 py-3 text-sm">
        <span className="font-medium text-millscale">{row.contact_name}</span>
        <span className="block text-slate-wash">{row.email}</span>
      </td>
      <td className="px-3 py-3 text-sm text-millscale">
        {row.trade}
        <span className="block text-slate-wash">
          {row.hiring_client} &middot; {row.platform}
        </span>
      </td>
      <td className="px-3 py-3 text-sm text-slate-wash">
        {partial ? (
          <span className="text-rust-flag">Partial &mdash; step {row.last_step}</span>
        ) : (
          (ANALYSIS_LABEL[row.analysis_status ?? ""] ?? "Complete")
        )}
      </td>
      <td className="px-3 py-3 text-sm text-slate-wash">
        {row.document_names.length === 0 ? (
          <span className="text-zinc-dust">&mdash;</span>
        ) : (
          row.document_names.map((name) => (
            <span key={name} className="flex items-center gap-1.5">
              <FileText aria-hidden className="h-3.5 w-3.5 shrink-0" />
              <span className="font-mono text-xs">{name}</span>
            </span>
          ))
        )}
      </td>
      <td className="px-3 py-3 font-mono text-xs text-slate-wash">{row.id}</td>
    </tr>
  );
}

export default async function InternalSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  if (!internalAccessConfigured()) return <Unconfigured />;

  if (!(await hasInternalSession())) {
    const { denied } = await searchParams;
    return <Gate denied={denied === "1"} />;
  }

  const rows = await listSubmissions();
  const complete = rows.filter((r) => r.status === "complete").length;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-millscale">
            Submissions
          </h1>
          <p className="mt-1 text-sm text-slate-wash">
            {rows.length} most recent &middot; {complete} complete &middot;{" "}
            {rows.length - complete} partial
          </p>
        </div>
        <form action={signOut}>
          <SubmitButton
            pendingLabel="Signing out…"
            className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-wash underline underline-offset-4 disabled:opacity-70"
          >
            Sign out
          </SubmitButton>
        </form>
      </div>

      {rows.length === 0 ? (
        <p className="mt-10 text-sm text-slate-wash">Nothing yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto border border-zinc-dust bg-paper">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-galvanise">
                {["Received", "Contact", "Trade / client", "State", "Files", "ID"].map(
                  (h) => (
                    <th
                      key={h}
                      scope="col"
                      className="px-3 py-2 text-xs font-semibold tracking-wide text-slate-wash uppercase"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Row key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
