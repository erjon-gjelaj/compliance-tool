import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Check, CircleAlert } from "lucide-react";

import { currentWorkspace } from "@/lib/workspaces";
import { getCompanyForEmail } from "@/lib/companies";
import { listDocumentsForEmail, listSubmissionsForEmail } from "@/lib/dashboard";
import { listDocumentsForEmail as listGenerated } from "@/lib/programs/store";
import { listCurrentRequirements } from "@/lib/domain-dashboard";
import { listMaintenanceDates } from "@/lib/maintenance";
import { buildPaperwork, nextAction, progress } from "@/lib/paperwork";

export const dynamic = "force-dynamic";

/**
 * Home.
 *
 * One screen, one question: what do I do next?
 *
 * It used to carry six panels — a next-best-action box, a needs-attention
 * list, an approval-file summary of six category tiles, a documents list, a
 * deadlines list and a project header. Every one was individually reasonable
 * and together they asked somebody who had just been given a deadline by a
 * refinery to decide where to start. A screen that lists everything asks you
 * to choose; a screen that names one thing asks you to begin.
 *
 * So: where you are, the single next thing, and anything genuinely urgent.
 * The full list is one tap away and is the only other place it lives.
 */

export default async function HomePage() {
  const workspace = await currentWorkspace();
  if (!workspace) redirect("/sign-in");

  const [submissions, uploaded, generated, company, reminders] =
    await Promise.all([
      listSubmissionsForEmail(workspace.email),
      listDocumentsForEmail(workspace.email),
      listGenerated(workspace.email),
      getCompanyForEmail(workspace.email),
      listMaintenanceDates(workspace.email),
    ]);

  const requirements = company ? await listCurrentRequirements(company.id) : [];
  const items = buildPaperwork({ requirements, generated, uploaded, reminders });
  const done = progress(items);
  const next = nextAction(items);

  const project = submissions[0] ?? null;
  const urgent = items.filter((item) => item.state === "needs_attention");

  /* ---------------------------------------------------------------- *
   * Nothing yet
   * ---------------------------------------------------------------- */

  if (!project && generated.length === 0 && items.length === 0) {
    return (
      <main className="max-w-2xl">
        <h1 className="type-h2 text-millscale">Let&rsquo;s find out where you stand</h1>
        <p className="type-lede mt-3">
          Tell us your trade and who is asking for the approval, attach whatever
          paperwork you already have, and you get back a plain list of what your
          file is short on.
        </p>

        <div className="mt-8 border border-zinc-dust bg-paper p-6">
          <p className="type-label text-millscale">Free, about a minute</p>
          <p className="type-body mt-2">
            No card. You keep whatever you send us, and the list of what is
            missing is yours whether or not you ever pay for anything.
          </p>
          <Link href="/gap-check" className="btn-primary mt-5 inline-block">
            Check my file free
          </Link>
        </div>

        <p className="type-body mt-6">
          Already know which program you need?{" "}
          <Link
            href="/dashboard/documents"
            className="text-verdigris underline underline-offset-4"
          >
            Go straight to your paperwork
          </Link>
          .
        </p>
      </main>
    );
  }

  /* ---------------------------------------------------------------- *
   * The working state
   * ---------------------------------------------------------------- */

  return (
    <main className="max-w-3xl">
      <h1 className="type-h2 text-millscale">
        {company?.name || project?.hiring_client || "Your paperwork"}
      </h1>
      {project ? (
        <p className="mt-2 text-sm text-slate-wash">
          {[project.platform, project.trade].filter(Boolean).join(" · ")}
        </p>
      ) : null}

      {/* Where they are, in one line and one bar. */}
      {done.total > 0 ? (
        <div className="mt-6">
          <p className="type-lede">
            {done.ready === done.total ? (
              <>Everything we can see is sorted.</>
            ) : (
              <>
                <strong className="text-millscale">
                  {done.total - done.ready}
                </strong>{" "}
                {done.total - done.ready === 1 ? "thing" : "things"} left to
                sort.
              </>
            )}
          </p>
          <div
            className="mt-3 h-1.5 w-full max-w-sm bg-zinc-dust"
            role="img"
            aria-label={`${done.ready} of ${done.total} sorted`}
          >
            <div
              className="h-full bg-verdigris"
              style={{ width: `${Math.round((done.ready / done.total) * 100)}%` }}
            />
          </div>
        </div>
      ) : null}

      {/* The one thing. */}
      {next ? (
        <section
          aria-labelledby="next-heading"
          className="mt-8 border-l-2 border-verdigris bg-paper p-6"
        >
          <p className="type-label text-slate-wash">Next</p>
          <h2 id="next-heading" className="type-h3 mt-1 text-millscale">
            {next.title}
          </h2>
          <p className="type-body mt-2 max-w-xl">{next.detail}</p>
          <Link
            href={next.action!.href}
            className="btn-primary mt-5 inline-flex items-center gap-2"
          >
            {next.action!.label}
            <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
        </section>
      ) : (
        <section className="mt-8 border-l-2 border-verdigris bg-paper p-6">
          <Check aria-hidden className="h-5 w-5 text-verdigris" />
          <h2 className="type-h3 mt-2 text-millscale">Nothing outstanding</h2>
          <p className="type-body mt-2 max-w-xl">
            Everything we know about is sorted. If your client asks for
            something that is not in your list, tell us and we will look at it.
          </p>
          <Link href="/dashboard/documents" className="btn-secondary mt-5 inline-block">
            See your paperwork
          </Link>
        </section>
      )}

      {/*
        Only what is actually broken, and only when it is not already the
        next action — repeating it would make the screen look busier than the
        work is.
      */}
      {urgent.filter((item) => item.key !== next?.key).length > 0 ? (
        <section aria-labelledby="urgent-heading" className="mt-8">
          <h2
            id="urgent-heading"
            className="flex items-center gap-2 type-label text-millscale"
          >
            <CircleAlert aria-hidden className="h-4 w-4 text-rust-flag" />
            Also needs you
          </h2>
          <ul className="mt-3 grid gap-2">
            {urgent
              .filter((item) => item.key !== next?.key)
              .slice(0, 3)
              .map((item) => (
                <li
                  key={item.key}
                  className="border border-zinc-dust bg-paper px-4 py-3"
                >
                  <p className="text-sm font-medium text-millscale">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-wash">{item.detail}</p>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <p className="type-body mt-10 border-t border-zinc-dust pt-6">
        <Link
          href="/dashboard/documents"
          className="font-medium text-verdigris underline underline-offset-4"
        >
          See everything
        </Link>{" "}
        &mdash; what is done, what is left, and what to send us.
      </p>
    </main>
  );
}
