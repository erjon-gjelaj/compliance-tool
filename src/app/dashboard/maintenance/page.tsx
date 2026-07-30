import { redirect } from "next/navigation";
import { CalendarClock, Trash2 } from "lucide-react";

import { pageMetadata } from "@/lib/metadata";
import { currentWorkspace } from "@/lib/workspaces";
import { listDocumentsForEmail as listUploaded } from "@/lib/dashboard";
import { listDocumentsForEmail as listGenerated } from "@/lib/programs/store";
import {
  listMaintenanceDates,
  reminderState,
  todayIso,
} from "@/lib/maintenance";
import { MaintenanceForm } from "@/components/maintenance-form";
import { removeReminder } from "@/app/dashboard/maintenance/actions";
import { programById } from "@/lib/programs/registry";

export const metadata = pageMetadata({
  title: "Maintenance",
  description: "Expiry and review dates supplied for your documents.",
  path: "/dashboard/maintenance",
  robots: { index: false, follow: false },
});

export const dynamic = "force-dynamic";

function when(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function MaintenancePage() {
  const workspace = await currentWorkspace();
  if (!workspace) redirect("/sign-in");

  const [uploaded, generated, reminders] = await Promise.all([
    listUploaded(workspace.email),
    listGenerated(workspace.email),
    listMaintenanceDates(workspace.email),
  ]);

  const choices = [
    ...generated.map((document) => ({
      value: `generated:${document.id}`,
      label: document.current
        ? `${programById(document.program_id)?.title ?? document.program_id}: generated program`
        : (programById(document.program_id)?.title ?? document.program_id),
    })),
    ...uploaded.map((document) => ({
      value: `uploaded:${document.id}`,
      label: document.file_name,
    })),
  ];
  const today = todayIso();

  return (
    <main className="max-w-3xl">
      <h1 className="type-h2 text-millscale">Maintenance</h1>
      <p className="type-lede mt-3">
        Track the expiry and review dates you were given. Nothing here claims a
        platform changed or a document expires unless you supplied the date.
      </p>

      {choices.length > 0 ? (
        <div className="mt-8"><MaintenanceForm choices={choices} /></div>
      ) : (
        <div className="mt-8 border border-zinc-dust bg-paper p-6">
          <p className="type-body">Add or generate a document before setting a reminder.</p>
        </div>
      )}

      <h2 className="type-label mt-10 text-millscale">Your reminders</h2>
      {reminders.length === 0 ? (
        <p className="type-body mt-3">No expiry or review dates have been entered.</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {reminders.map((reminder) => {
            const state = reminderState(reminder.due_date, today);
            return (
              <li key={reminder.id} className="flex items-start justify-between gap-4 border border-zinc-dust bg-paper p-4">
                <div className="flex min-w-0 gap-3">
                  <CalendarClock className={`mt-0.5 h-4 w-4 shrink-0 ${state === "overdue" ? "text-rust-flag" : "text-verdigris"}`} />
                  <div>
                    <p className="text-sm font-medium text-millscale">{reminder.document_name}</p>
                    <p className={`mt-1 text-xs ${state === "overdue" ? "text-rust-flag" : "text-slate-wash"}`}>
                      {reminder.kind === "expiry" ? "Expires" : "Review"} {when(reminder.due_date)}
                      {state === "overdue" ? " · overdue" : state === "due_soon" ? " · due soon" : ""}
                    </p>
                    {reminder.note ? <p className="mt-1 text-sm text-slate-wash">{reminder.note}</p> : null}
                  </div>
                </div>
                <form action={removeReminder}>
                  <input type="hidden" name="id" value={reminder.id} />
                  <button type="submit" className="text-slate-wash hover:text-rust-flag" aria-label={`Remove reminder for ${reminder.document_name}`}>
                    <Trash2 aria-hidden className="h-4 w-4" />
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
