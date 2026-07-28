import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { SITE_NAME } from "@/lib/constants";
import { pageMetadata } from "@/lib/metadata";
import { currentClient } from "@/lib/auth/session";
import { getSubmissionForEmail } from "@/lib/dashboard";
import { rowToValues } from "@/lib/submissions";
import { TOTAL_STEPS, type StepNumber } from "@/lib/intake";
import { IntakeForm } from "@/components/intake-form";

/**
 * Picking up an intake that was abandoned partway.
 *
 * This exists because the dashboard's first instruction was a dead end. It
 * said "Finish the form you started" and linked to the submission page, which
 * shows documents and a review — neither of which a partial submission has —
 * and offered no way to actually finish anything. The primary action on the
 * page did not work.
 *
 * Nothing new happens on the server. Every step already posts its
 * `submission_id` and updates that row, so resuming is only a question of
 * starting the form somewhere other than a blank step 1. The row is read back
 * through `rowToValues`, which is the same mapping the form already uses when
 * a rejected step is echoed back.
 *
 * Ownership is checked here rather than trusted from the URL.
 * `getSubmissionForEmail` filters on the signed-in address inside the query,
 * so a guessed id belonging to someone else is indistinguishable from one that
 * does not exist. That matters more on this route than on the read-only ones:
 * the id it hands to the form is a write capability over that row.
 */

export const metadata = pageMetadata({
  title: "Finish your request",
  description: `Pick up the ${SITE_NAME} request you started.`,
  path: "/dashboard",
  robots: { index: false, follow: false },
});

export const dynamic = "force-dynamic";

/*
 * The analysis runs inside the submit action via after(), and the last step is
 * submitted from this page, so it needs the same wall clock as the other
 * routes that host the form. See the note on src/app/page.tsx.
 */
export const maxDuration = 60;

export default async function ContinuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await currentClient();
  if (!session) redirect("/sign-in");

  const { id } = await params;

  const submission = await getSubmissionForEmail(session.email, id);
  if (!submission) notFound();

  // Already finished. Sending them back to the form would invite a second
  // submission of a completed intake, so they go to the thing they actually
  // want, which is the review.
  if (submission.status === "complete") redirect(`/dashboard/${id}`);

  /*
   * Resume on the step after the last one they completed.
   *
   * `last_step` records what was finished, not what they were looking at, so
   * the next unfinished step is one further on. Clamped at the last step
   * because a row that somehow recorded step 4 has nowhere further to go, and
   * a step number outside the union would render nothing at all.
   */
  const resumeAt = Math.min(submission.last_step + 1, TOTAL_STEPS) as StepNumber;

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-slate-wash underline-offset-4 hover:underline"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" />
        Your workspace
      </Link>

      <h1 className="type-h2 mt-4 text-millscale">Finish your request</h1>
      <p className="type-body mt-3">
        This is the {submission.platform} request for{" "}
        <span className="text-millscale">{submission.hiring_client}</span>. What
        you already filled in is saved &mdash; carry on from step {resumeAt}, or
        skip to the end and send it as it stands.
      </p>

      <div className="mt-8">
        <IntakeForm
          entryReason={submission.entry_reason}
          initialState={{
            status: "editing",
            step: resumeAt,
            submissionId: submission.id,
            values: rowToValues(submission),
          }}
        />
      </div>
    </main>
  );
}
