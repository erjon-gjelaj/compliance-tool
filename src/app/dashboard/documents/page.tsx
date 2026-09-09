import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Check,
  CircleAlert,
  CircleHelp,
  FileText,
  MessageSquare,
  Upload,
} from "lucide-react";

import { pageMetadata } from "@/lib/metadata";
import { formatBytes } from "@/lib/uploads";
import { currentWorkspace } from "@/lib/workspaces";
import { getCompanyForEmail } from "@/lib/companies";
import { listDocumentsForEmail, listSubmissionsForEmail } from "@/lib/dashboard";
import { listDocumentsForEmail as listGenerated } from "@/lib/programs/store";
import { listCurrentRequirements } from "@/lib/domain-dashboard";
import { listMaintenanceDates } from "@/lib/maintenance";
import {
  GROUPS,
  buildPaperwork,
  progress,
  type PaperworkItem,
  type PaperworkState,
} from "@/lib/paperwork";
import { ProjectUpload } from "@/components/project-upload";

export const metadata = pageMetadata({
  title: "Paperwork",
  description: "Everything your file needs, and where each piece stands.",
  path: "/dashboard/documents",
  robots: { index: false, follow: false },
});

export const dynamic = "force-dynamic";

/**
 * Everything the file needs, in one list.
 *
 * This replaces four screens — approval projects, generate documents,
 * documents and maintenance — which between them showed the same piece of
 * paper four times in four vocabularies. The model behind it is lib/paperwork;
 * this is only the rendering.
 *
 * The order of the groups is the order somebody should work in: what is
 * broken, then what we can do for them, then what only they can send, then
 * what is finished, then what is genuinely uncertain. Nothing here is sorted
 * by our categories, because a contractor does not have them.
 */

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * The state, as a small piece of visual language rather than a word alone.
 *
 * Colour is doubled with an icon and a label throughout, because a status
 * carried by hue alone is invisible to a colour-blind reader and to anybody
 * who prints the page.
 */
const LOOK: Record<
  PaperworkState,
  { icon: typeof Check; label: string; tone: string }
> = {
  ready: {
    icon: Check,
    label: "Sorted",
    tone: "border-verdigris bg-verdigris/8 text-verdigris",
  },
  we_can_write_it: {
    icon: FileText,
    label: "We can write it",
    tone: "border-verdigris bg-paper text-verdigris",
  },
  not_automated: {
    icon: MessageSquare,
    label: "Ask us",
    tone: "border-slate-wash bg-galvanise text-millscale",
  },
  you_provide_it: {
    icon: Upload,
    label: "Send it to us",
    tone: "border-slate-wash bg-galvanise text-millscale",
  },
  needs_attention: {
    icon: CircleAlert,
    label: "Needs you",
    tone: "border-rust-flag bg-rust-flag/8 text-rust-flag",
  },
  ask_your_client: {
    icon: CircleHelp,
    label: "Unconfirmed",
    tone: "border-zinc-dust bg-galvanise text-slate-wash",
  },
};

/**
 * One piece of paperwork.
 *
 * The state is carried by a small icon rather than a labelled badge, and the
 * detail line appears only when the item has one. Both are the same decision:
 * this row sits under a heading that already says what its whole group is, so
 * repeating it here costs a reader twelve identical lines to find twelve
 * names — and the name is the thing they came for.
 *
 * The icon stays because it survives scanning where a word does not, and it
 * carries its label to assistive technology where the visual grouping is not
 * available.
 */
function Row({ item }: { item: PaperworkItem }) {
  const look = LOOK[item.state];
  const Icon = look.icon;

  return (
    <li className="border border-zinc-dust bg-paper">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4 sm:flex-nowrap">
        <span
          className={`inline-flex shrink-0 items-center justify-center border p-1.5 ${look.tone}`}
        >
          <Icon aria-hidden className="h-4 w-4" />
          <span className="sr-only">{look.label}</span>
        </span>

        <div className="min-w-0 flex-1 basis-full sm:basis-auto">
          <p className="font-medium text-millscale">{item.title}</p>
          {item.detail ? (
            <p className="mt-0.5 text-sm text-slate-wash">{item.detail}</p>
          ) : null}
        </div>

        {item.action ? (
          <Link
            href={item.action.href}
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-verdigris underline-offset-4 hover:underline"
          >
            {item.action.label}
            <ArrowRight aria-hidden className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
    </li>
  );
}

export default async function PaperworkPage() {
  const workspace = await currentWorkspace();
  if (!workspace) redirect("/sign-in");

  const [uploaded, generated, company, reminders, projects] = await Promise.all([
    listDocumentsForEmail(workspace.email),
    listGenerated(workspace.email),
    getCompanyForEmail(workspace.email),
    listMaintenanceDates(workspace.email),
    listSubmissionsForEmail(workspace.email),
  ]);

  const requirements = company ? await listCurrentRequirements(company.id) : [];

  const items = buildPaperwork({ requirements, generated, uploaded, reminders });
  const done = progress(items);

  const grouped = GROUPS.map((group) => ({
    ...group,
    rows: items.filter((item) => item.state === group.id),
  })).filter((group) => group.rows.length > 0);

  return (
    <main className="max-w-3xl">
      <h1 className="type-h2 text-millscale">Your paperwork</h1>

      {done.total > 0 ? (
        <>
          <p className="type-lede mt-3">
            {done.ready} of {done.total} sorted.
          </p>
          {/*
            A bar rather than a percentage. The number matters less than
            whether the end is in sight, and a contractor checking this on a
            phone between jobs reads a shape faster than a figure.
          */}
          <div
            className="mt-4 h-1.5 w-full max-w-sm bg-zinc-dust"
            role="img"
            aria-label={`${done.ready} of ${done.total} pieces of paperwork sorted`}
          >
            <div
              className="h-full bg-verdigris"
              style={{ width: `${Math.round((done.ready / done.total) * 100)}%` }}
            />
          </div>
        </>
      ) : (
        <p className="type-lede mt-3">
          Nothing here yet. Run a free gap check and we will list what your file
          is short on.
        </p>
      )}

      {items.length === 0 ? (
        <div className="mt-8 border border-zinc-dust bg-paper p-6">
          <h2 className="type-h3 text-millscale">Start with a gap check</h2>
          <p className="type-body mt-2">
            Tell us your trade and who is asking, attach whatever you already
            hold, and you get back a plain list of what is missing. Free, and it
            takes about a minute.
          </p>
          <Link href="/gap-check" className="btn-primary mt-5 inline-block">
            Check my file free
          </Link>
        </div>
      ) : null}

      {grouped.map((group) => (
        <section key={group.id} aria-labelledby={`${group.id}-heading`} className="mt-10">
          <h2 id={`${group.id}-heading`} className="type-h3 text-millscale">
            {group.heading}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-wash">{group.blurb}</p>

          <ul className="mt-4 grid gap-2">
            {group.rows.map((item) => (
              <Row key={item.key} item={item} />
            ))}
          </ul>
        </section>
      ))}

      {/*
        The way to something nobody asked them for. A requirement set only
        knows what we could work out about their client — somebody who has
        been told to produce a program that is not in their list still needs
        a door to it, and without this the only route was a page that is no
        longer in the navigation.
      */}
      {items.length > 0 ? (
        <p className="type-body mt-10">
          Need a program that is not listed here?{" "}
          <Link
            href="/dashboard/programs"
            className="font-medium text-verdigris underline underline-offset-4"
          >
            See everything we can write
          </Link>
          .
        </p>
      ) : null}

      {/* ---------------------------------------------------------------- */}

      <section id="upload" className="mt-12 border-t border-zinc-dust pt-8">
        <h2 className="type-h3 text-millscale">Send us a file</h2>
        <p className="type-body mt-2 max-w-2xl">
          An existing program, an insurance certificate, an OSHA summary, a
          training roster, or a clear photo of one. We read what we can and keep
          the rest on file.
        </p>

        {projects.length > 0 ? (
          <div className="mt-5">
            <ProjectUpload
              projects={projects.map((project) => ({
                id: project.id,
                label: `${project.hiring_client || "Client not entered"} · ${project.platform}`,
              }))}
            />
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-wash">
            Uploads attach to a gap check.{" "}
            <Link
              href="/gap-check"
              className="text-verdigris underline underline-offset-4"
            >
              Start one
            </Link>{" "}
            and you can send files with it.
          </p>
        )}
      </section>

      {/*
        Renewal dates left the navigation with Maintenance, so this is now the
        only way in. Without it the feature would still work and nobody could
        reach it, which is the worst of both — and the dates it collects are
        what put anything into "needs attention" at all.
      */}
      <p className="type-body mt-8">
        Need to track when something expires or is due a review?{" "}
        <Link
          href="/dashboard/maintenance"
          className="font-medium text-verdigris underline underline-offset-4"
        >
          Add a date
        </Link>{" "}
        and it will show up here when it comes round.
      </p>

      {uploaded.length > 0 ? (
        <section aria-labelledby="sent-heading" className="mt-10">
          <h2 id="sent-heading" className="type-label text-millscale">
            What you have sent us
          </h2>
          <ul className="mt-3 grid gap-2">
            {uploaded.map((file) => (
              <li
                key={file.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border border-zinc-dust bg-paper px-4 py-3"
              >
                <span className="min-w-0 text-sm text-millscale">
                  {file.file_name}
                </span>
                <span className="text-xs text-slate-wash">
                  {formatBytes(file.size_bytes)} &middot;{" "}
                  {formatDate(file.created_at)}
                  {file.readable ? "" : " · could not be read"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
