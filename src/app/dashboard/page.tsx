import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  ChevronRight,
  FileText,
  FileWarning,
  HelpCircle,
} from "lucide-react";

import { SITE_NAME } from "@/lib/constants";
import { pageMetadata } from "@/lib/metadata";
import { currentWorkspace } from "@/lib/workspaces";
import {
  getReviewForSubmission,
  listDocumentsForEmail,
  listSubmissionsForEmail,
  type DashboardSubmission,
} from "@/lib/dashboard";
import { buildWorkspace, submissionHeadline, type Workspace } from "@/lib/workspace";
import { getCompanyForEmail, unconfirmedFields } from "@/lib/companies";
import { listRequestsForEmail } from "@/lib/requests/store";
import { SERVICE_LABELS } from "@/lib/service-kinds";
import { needsCustomer } from "@/lib/requests/state";
import { StatusChip } from "@/components/status-chip";
import {
  listMaintenanceDates,
  reminderState,
  todayIso,
} from "@/lib/maintenance";
import { listCurrentRequirements } from "@/lib/domain-dashboard";

export const metadata = pageMetadata({
  title: "Overview",
  description: `Where your ${SITE_NAME} work stands.`,
  path: "/dashboard",
  robots: { index: false, follow: false },
});

export const dynamic = "force-dynamic";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * The four summary figures.
 *
 * The brief asked for these to separate clearly from the page. They sit on
 * `paper` against the `galvanise` body with a full border, and the one
 * representing work waiting on the customer takes the warning treatment; so
 * the only tile that draws the eye is the only one that is their move.
 *
 * A figure with nothing behind it renders as a dash rather than a zero. "0
 * documents" reads as a measurement; ":" reads as nothing here yet, which is
 * what it is.
 */
function Tile({
  label,
  value,
  href,
  alert = false,
}: {
  label: string;
  value: number | string;
  href: string;
  alert?: boolean;
}) {
  const loud = alert && typeof value === "number" && value > 0;

  return (
    <Link
      href={href}
      className={`border p-4 transition-colors ${
        loud
          ? "border-rust-flag bg-rust-flag/8 hover:bg-rust-flag/12"
          : "border-zinc-dust bg-paper hover:border-verdigris"
      }`}
    >
      <p
        className={`text-2xl font-semibold ${loud ? "text-rust-flag" : "text-millscale"}`}
      >
        {value === 0 ? "Start here" : value}
      </p>
      <p className="mt-1 text-xs leading-tight text-slate-wash">{label}</p>
    </Link>
  );
}

function NextAction({ next }: { next: Workspace["next"] }) {
  return (
    <section
      aria-labelledby="next-heading"
      className="border-l-2 border-verdigris bg-paper p-5 md:p-6"
    >
      <p className="tag">Do this next</p>
      <h2 id="next-heading" className="type-h3 mt-2 text-millscale">
        {next.title}
      </h2>
      <p className="type-body mt-2 max-w-xl">{next.detail}</p>
      <Link href={next.href} className="btn-primary mt-4 inline-flex items-center gap-2">
        {next.cta}
        <ArrowRight aria-hidden className="h-4 w-4" />
      </Link>
    </section>
  );
}

function Section({
  heading,
  id,
  action,
  children,
}: {
  heading: string;
  id: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="mt-8">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={id} className="type-label text-millscale">
          {heading}
        </h2>
        {action ? (
          <Link
            href={action.href}
            className="text-sm text-verdigris underline-offset-4 hover:underline"
          >
            {action.label}
          </Link>
        ) : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function SubmissionRow({ row }: { row: DashboardSubmission }) {
  const state =
    row.status === "partial"
      ? { label: `Unfinished: step ${row.last_step} of 4`, tone: "text-rust-flag" }
      : row.analysis_status === "ok"
        ? { label: "Review ready", tone: "text-verdigris" }
        : row.analysis_status === "pending"
          ? { label: "Review running", tone: "text-slate-wash" }
          : row.analysis_status === "fallback"
            ? { label: "No review; emailed instead", tone: "text-slate-wash" }
            : { label: "Received", tone: "text-slate-wash" };

  return (
    <li>
      <Link
        href={`/dashboard/${row.id}`}
        className="flex items-center justify-between gap-4 border border-zinc-dust bg-paper p-4 transition-colors hover:border-verdigris"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-millscale">
            {submissionHeadline(row)} &middot; {row.hiring_client}
          </p>
          <p className="mt-0.5 text-xs text-slate-wash">
            {formatDate(row.created_at)} &middot;{" "}
            <span className={state.tone}>{state.label}</span>
          </p>
        </div>
        <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-zinc-dust" />
      </Link>
    </li>
  );
}

export default async function DashboardPage() {
  const active = await currentWorkspace();
  if (!active) redirect("/sign-in");

  const [submissions, documents, company, requests, maintenance] = await Promise.all([
    listSubmissionsForEmail(active.email),
    listDocumentsForEmail(active.email),
    getCompanyForEmail(active.email),
    listRequestsForEmail(active.email),
    listMaintenanceDates(active.email),
  ]);

  const toConfirm = company ? unconfirmedFields(company) : [];

  const activeSubmission =
    submissions.find((row) => row.status === "complete") ?? null;

  const activeReview = activeSubmission
    ? await getReviewForSubmission(activeSubmission.id)
    : null;

  const workspace = buildWorkspace({
    submissions,
    documents,
    activeReview,
    activeSubmission,
  });

  /*
   * Both derived from the event log rather than from a stored column, so
   * neither figure can be stale; which is the whole point of task 055. A
   * count on an overview is exactly where a wrong status does the most damage,
   * because nobody clicks through to check it.
   */
  const yourMove = requests.filter((request) => needsCustomer(request.status));
  const open = requests.filter(
    (request) =>
      request.status.state !== "completed" && request.status.state !== "closed",
  );

  const unreadable = documents.filter((entry) => !entry.readable);
  const today = todayIso();
  const maintenanceDue = maintenance.filter(
    (entry) => reminderState(entry.due_date, today) !== "later",
  );
  const requirements = company ? await listCurrentRequirements(company.id) : [];
  const requirementsInPlace = requirements.filter((entry) =>
    ["draft", "submitted", "under_review", "accepted"].includes(entry.status),
  ).length;

  return (
    <main>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h1 className="type-h2 text-millscale">{company?.name ?? "Overview"}</h1>
        <p className="text-sm text-slate-wash">
          {workspace.platforms.length > 0
            ? workspace.platforms.join(", ")
            : "No platform set"}
          {workspace.nextDeadline ? (
            <>
              {" "}
              &middot;{" "}
              {workspace.nextDeadline.passed ? (
                <span className="text-rust-flag">
                  {workspace.nextDeadline.hiringClient} wanted you approved by{" "}
                  {formatDate(workspace.nextDeadline.date)}
                </span>
              ) : (
                <>
                  {workspace.nextDeadline.hiringClient} by{" "}
                  <span className="text-millscale">
                    {formatDate(workspace.nextDeadline.date)}
                  </span>
                </>
              )}
            </>
          ) : null}
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Tile
          label="file items in place"
          value={`${requirementsInPlace} of ${requirements.length}`}
          href="/dashboard/file"
        />
        <Tile
          label="need something from you"
          value={yourMove.length}
          href="/dashboard/requests"
          alert
        />
        <Tile
          label="dates due or overdue"
          value={maintenanceDue.length}
          href="/dashboard/maintenance"
          alert
        />
      </div>

      {submissions.length === 0 && requests.length === 0 ? (
        <div className="mt-8 border border-zinc-dust bg-paper p-8">
          <FileText aria-hidden className="mb-4 h-5 w-5 text-slate-wash" />
          <h2 className="type-h3 text-millscale">Nothing here yet</h2>
          <p className="type-body mt-3 max-w-xl">
            There are no requests against this address. If you asked us to
            delete your file, it is gone, documents included.
          </p>
          <Link href="/" className="btn-primary mt-6">
            Start a request
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-6">
            <NextAction next={workspace.next} />
          </div>

          {toConfirm.length > 0 ? (
            <p className="mt-3 border-l-2 border-rust-flag bg-paper px-4 py-3 text-sm text-millscale">
              {toConfirm.length} company{" "}
              {toConfirm.length === 1 ? "detail" : "details"} we filled in
              hasn&rsquo;t been confirmed.{" "}
              <Link
                href="/dashboard/company"
                className="text-verdigris underline underline-offset-4"
              >
                Check them
              </Link>
            </p>
          ) : null}

          {open.length > 0 ? (
            <Section
              heading="Active requests"
              id="requests-heading"
              action={{ href: "/dashboard/requests", label: "All requests" }}
            >
              <ul className="grid gap-2">
                {open.slice(0, 4).map((request) => (
                  <li key={request.id}>
                    <Link
                      href={`/dashboard/requests/${request.id}`}
                      className="flex items-center justify-between gap-4 border border-zinc-dust bg-paper p-4 transition-colors hover:border-verdigris"
                    >
                      <span className="min-w-0 truncate text-sm font-medium text-millscale">
                        {SERVICE_LABELS[request.kind] ?? request.kind}
                      </span>
                      <StatusChip state={request.status.state} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {workspace.blockers.length > 0 ? (
            <Section
              heading="What your file looks short on"
              id="blockers-heading"
              action={
                workspace.activeSubmission
                  ? {
                      href: `/dashboard/${workspace.activeSubmission.id}`,
                      label: "See the reasoning",
                    }
                  : undefined
              }
            >
              <ul className="grid gap-2">
                {workspace.blockers.slice(0, 5).map((item) => (
                  <li
                    key={item.requirement}
                    className="border border-zinc-dust bg-paper p-4"
                  >
                    <p className="text-sm font-medium text-millscale">
                      {item.requirement}
                    </p>
                    <p className="mt-1 text-sm text-slate-wash">{item.action}</p>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {unreadable.length > 0 ? (
            <Section
              heading="Files we couldn't read"
              id="unreadable-heading"
              action={{ href: "/dashboard/documents", label: "All documents" }}
            >
              <ul className="grid gap-2">
                {unreadable.slice(0, 3).map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center gap-3 border border-zinc-dust bg-paper p-4 text-sm text-millscale"
                  >
                    <FileWarning aria-hidden className="h-4 w-4 shrink-0 text-rust-flag" />
                    <span className="min-w-0 truncate">{entry.file_name}</span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {workspace.questions.length > 0 ? (
            <Section heading="Still to confirm with your client" id="questions-heading">
              <ul className="grid gap-2">
                {workspace.questions.slice(0, 3).map((question) => (
                  <li
                    key={question}
                    className="flex gap-3 border border-zinc-dust bg-paper p-4"
                  >
                    <HelpCircle
                      aria-hidden
                      className="mt-0.5 h-4 w-4 shrink-0 text-slate-wash"
                    />
                    <p className="text-sm text-millscale">{question}</p>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {submissions.length > 0 ? (
            <Section heading="Recent activity" id="recent-heading">
              <ul className="grid gap-2">
                {submissions.slice(0, 4).map((row) => (
                  <SubmissionRow key={row.id} row={row} />
                ))}
              </ul>
            </Section>
          ) : null}
        </>
      )}
    </main>
  );
}
