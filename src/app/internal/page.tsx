import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, CalendarClock, Lock, Sprout } from "lucide-react";

import {
  closeInternalSession,
  hasInternalSession,
  internalAccessConfigured,
  openInternalSession,
} from "@/lib/internal-auth";
import { SITE_NAME } from "@/lib/constants";
import { SubmitButton } from "@/components/submit-button";
import {
  listDueReviews,
  listFailedRuns,
  listHarvest,
  tallyRuns,
} from "@/lib/operations";
import { programById } from "@/lib/programs/registry";
import { REQUIREMENTS_VERSION } from "@/lib/requirements";

/**
 * Operations.
 *
 * The two things nothing else in the product would ever tell an operator:
 * reviews that failed silently, and the evidence sitting in submissions that
 * could verify a requirement.
 *
 * /internal previously 404'd — there were pages beneath it and no index — so
 * this is also the door to the other two consoles.
 */

export const dynamic = "force-dynamic";

async function signIn(formData: FormData) {
  "use server";
  const ok = await openInternalSession(String(formData.get("secret") ?? ""));
  redirect(ok ? "/internal" : "/internal?denied=1");
}

async function signOut() {
  "use server";
  await closeInternalSession();
  redirect("/internal");
}

function Gate({ denied }: { denied: boolean }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="border border-zinc-dust bg-paper p-8">
        <Lock aria-hidden className="mb-4 h-5 w-5 text-slate-wash" />
        <h1 className="text-xl font-semibold tracking-tight text-millscale">
          {SITE_NAME} internal
        </h1>
        <form action={signIn} className="mt-6">
          <label htmlFor="secret" className="block text-sm font-medium text-millscale">
            Access key
          </label>
          <input
            id="secret"
            name="secret"
            type="password"
            required
            autoComplete="off"
            className="mt-2 w-full border border-zinc-dust bg-galvanise px-3 py-2 text-sm text-millscale"
          />
          {denied ? (
            <p role="alert" className="mt-3 text-sm text-rust-flag">
              That key was not accepted.
            </p>
          ) : null}
          <SubmitButton pendingLabel="Checking…" className="btn-primary mt-5 w-full">
            Open
          </SubmitButton>
        </form>
      </div>
    </main>
  );
}

function when(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function InternalHomePage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const { denied } = await searchParams;

  if (!internalAccessConfigured()) return <Gate denied={false} />;
  if (!(await hasInternalSession())) return <Gate denied={Boolean(denied)} />;

  const [failed, tally, harvest, due] = await Promise.all([
    listFailedRuns(),
    tallyRuns(),
    listHarvest(),
    listDueReviews(),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight text-millscale">
          Operations
        </h1>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-slate-wash underline-offset-4 hover:underline"
          >
            Sign out
          </button>
        </form>
      </div>

      <nav aria-label="Internal" className="mt-4 flex flex-wrap gap-4 text-sm">
        <Link href="/internal/requests" className="text-verdigris underline-offset-4 hover:underline">
          Requests
        </Link>
        <Link href="/internal/submissions" className="text-verdigris underline-offset-4 hover:underline">
          Submissions
        </Link>
      </nav>

      <p className="mt-6 text-xs text-slate-wash">
        Reference data {REQUIREMENTS_VERSION} &middot; {tally.ok} of {tally.total}{" "}
        {tally.total === 1 ? "review" : "reviews"} produced normally
      </p>

      {/* ---------------------------------------------------------------- */}

      <section aria-labelledby="failed-heading" className="mt-10">
        <h2
          id="failed-heading"
          className="flex items-center gap-2 text-sm font-semibold text-millscale"
        >
          <AlertTriangle
            aria-hidden
            className={`h-4 w-4 ${failed.length > 0 ? "text-rust-flag" : "text-slate-wash"}`}
          />
          Reviews that did not go out
        </h2>

        <p className="mt-2 max-w-2xl text-xs text-slate-wash">
          The analysis runs after the response has already been sent, so a
          failure here is silent: the contractor gets the generic explainer
          instead of their review and nothing raises an alarm. These rows have
          been written since the pipeline was built and nothing has ever read
          them.
        </p>

        {failed.length === 0 ? (
          <p className="mt-4 border border-zinc-dust bg-paper p-4 text-sm text-slate-wash">
            Nothing has failed. Every review that ran produced output.
          </p>
        ) : (
          <ul className="mt-4 grid gap-2">
            {failed.map((run) => (
              <li key={run.id} className="border border-rust-flag bg-paper p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-sm font-medium text-millscale">
                    {run.email ?? "unknown address"}
                    {run.trade ? ` · ${run.trade}` : ""}
                    {run.platform ? ` · ${run.platform}` : ""}
                  </p>
                  <p className="text-xs text-slate-wash">
                    {when(run.created_at)} &middot; {run.status}
                  </p>
                </div>

                {run.error ? (
                  <p className="mt-2 font-mono text-xs break-words text-rust-flag">
                    {run.error}
                  </p>
                ) : null}

                <p className="mt-2 text-xs text-slate-wash">
                  {run.documents_read} read, {run.documents_unreadable} unreadable
                  &middot; reference {run.reference_version} &middot; submission{" "}
                  {run.submission_id}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------------------------------------------------------------- */}

      <section aria-labelledby="due-heading" className="mt-12">
        <h2
          id="due-heading"
          className="flex items-center gap-2 text-sm font-semibold text-millscale"
        >
          <CalendarClock
            aria-hidden
            className={`h-4 w-4 ${due.length > 0 ? "text-rust-flag" : "text-slate-wash"}`}
          />
          Programs due another look
        </h2>

        <p className="mt-2 max-w-2xl text-xs text-slate-wash">
          Every program we issue says, in its own closing section, that it is
          reviewed at least annually. That is the company&rsquo;s own
          commitment with an effective date printed beside it, so this is the
          one renewal date in the product that is not a guess &mdash; and it is
          the list the maintenance service is sold on. Nothing here is emailed
          automatically; somebody gets in touch.
        </p>

        {due.length === 0 ? (
          <p className="mt-4 border border-zinc-dust bg-paper p-4 text-sm text-slate-wash">
            Nothing is due. Every live program was issued within the year.
          </p>
        ) : (
          <ul className="mt-4 grid gap-2">
            {due.map((entry) => (
              <li
                key={entry.documentId}
                className={`border bg-paper p-4 ${
                  entry.status === "overdue" ? "border-rust-flag" : "border-zinc-dust"
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-sm font-medium text-millscale">
                    {entry.companyName ?? entry.email}
                    {" · "}
                    {programById(entry.programId)?.shortName ?? entry.programId}
                  </p>
                  <p
                    className={`text-xs ${
                      entry.status === "overdue" ? "text-rust-flag" : "text-slate-wash"
                    }`}
                  >
                    {entry.status === "overdue"
                      ? `${Math.abs(entry.daysUntilDue)} days overdue`
                      : `due in ${entry.daysUntilDue} days`}
                  </p>
                </div>
                <p className="mt-1 text-xs text-slate-wash">
                  version {entry.version} &middot; effective {when(entry.effectiveDate)}{" "}
                  &middot; review due {when(entry.reviewDue)} &middot; {entry.email}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------------------------------------------------------------- */}

      <section aria-labelledby="harvest-heading" className="mt-12">
        <h2
          id="harvest-heading"
          className="flex items-center gap-2 text-sm font-semibold text-millscale"
        >
          <Sprout aria-hidden className="h-4 w-4 text-verdigris" />
          Evidence for the reference data
        </h2>

        <p className="mt-2 max-w-2xl text-xs text-slate-wash">
          Every entry in <span className="font-mono">lib/requirements</span> is
          still <span className="font-mono">verified: false</span>, which means
          the review calls each one commonly requested rather than required.
          What moves an entry to verified is a real rejection letter or a real
          platform list — and both arrive here, in the words a reviewer or a
          contractor used. Read against the requirement it concerns, then set
          the flag.
        </p>

        {harvest.length === 0 ? (
          <p className="mt-4 border border-zinc-dust bg-paper p-4 text-sm text-slate-wash">
            Nothing submitted yet carries a rejection note or a checklist
            answer.
          </p>
        ) : (
          <ul className="mt-4 grid gap-2">
            {harvest.map((entry) => (
              <li key={entry.submission_id} className="border border-zinc-dust bg-paper p-4">
                <p className="text-sm font-medium text-millscale">
                  {entry.trade || "no trade"} &middot; {entry.platform || "no platform"}
                  {entry.hiring_client ? ` · ${entry.hiring_client}` : ""}
                </p>
                <p className="text-xs text-slate-wash">{when(entry.created_at)}</p>

                {entry.rejection_notes ? (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-millscale">
                      What the reviewer sent back
                    </p>
                    <p className="mt-1 border-l-2 border-verdigris pl-3 text-sm whitespace-pre-wrap text-millscale">
                      {entry.rejection_notes}
                    </p>
                  </div>
                ) : null}

                {entry.documents_held && entry.documents_held.length > 0 ? (
                  <p className="mt-3 text-xs text-slate-wash">
                    <span className="font-medium text-millscale">They hold:</span>{" "}
                    {entry.documents_held.join(", ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
