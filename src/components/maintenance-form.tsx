"use client";

import { useActionState } from "react";

import {
  saveReminder,
  type MaintenanceState,
} from "@/app/dashboard/maintenance/actions";
import { SubmitButton } from "@/components/submit-button";

type Choice = { value: string; label: string };
const initial: MaintenanceState = { status: "editing" };
const field =
  "mt-2 w-full border border-zinc-dust bg-galvanise px-3 py-2 text-sm text-millscale";

export function MaintenanceForm({ choices }: { choices: Choice[] }) {
  const [state, action] = useActionState(saveReminder, initial);

  return (
    <form action={action} className="border border-zinc-dust bg-paper p-5">
      <h2 className="type-h3 text-millscale">Add or update a reminder</h2>
      <p className="mt-2 text-sm text-slate-wash">
        The date is used exactly as you enter it. We do not infer renewal dates
        from a file, platform, or regulation.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="target" className="type-label block text-millscale">Document</label>
          <select id="target" name="target" required className={field}>
            <option value="">Choose a document</option>
            {choices.map((choice) => (
              <option key={choice.value} value={choice.value}>{choice.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="kind" className="type-label block text-millscale">Reminder</label>
          <select id="kind" name="kind" className={field}>
            <option value="expiry">Expiry date</option>
            <option value="review">Review date</option>
          </select>
        </div>
        <div>
          <label htmlFor="due_date" className="type-label block text-millscale">Date</label>
          <input id="due_date" name="due_date" type="date" required className={field} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="note" className="type-label block text-millscale">
            Note <span className="font-normal text-slate-wash">(optional)</span>
          </label>
          <input id="note" name="note" maxLength={500} className={field} />
        </div>
      </div>
      {state.error ? <p className="mt-3 text-sm text-rust-flag">{state.error}</p> : null}
      {state.status === "saved" ? <p className="mt-3 text-sm text-verdigris">Reminder saved.</p> : null}
      <SubmitButton pendingLabel="Saving…" className="btn-primary mt-4">
        Save reminder
      </SubmitButton>
    </form>
  );
}
