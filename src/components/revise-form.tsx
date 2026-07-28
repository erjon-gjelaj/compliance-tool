"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";

import { reviseDocument, type RevisionState } from "@/app/dashboard/programs/actions";
import { SubmitButton } from "@/components/submit-button";

const initial: RevisionState = { status: "editing" };

/**
 * Asking for a revision after a hiring client sent the document back.
 *
 * One field. The customer pastes what the reviewer said, and a new version is
 * produced from the answers that made the last one — they are not put back
 * through a questionnaire for a document they have already described.
 */
export function ReviseForm({ documentId }: { documentId: string }) {
  const [state, formAction] = useActionState(reviseDocument, initial);

  if (state.status === "sent") {
    return (
      <div role="status" className="flex gap-3 border border-verdigris bg-paper p-5">
        <Check aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-verdigris" />
        <p className="type-body">
          A new version has been prepared and is above. The earlier one is kept
          in the history below.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="border border-zinc-dust bg-paper p-5">
      <input type="hidden" name="document_id" value={documentId} />

      <label className="type-label block text-millscale" htmlFor="reason">
        What did they ask you to change?
      </label>
      <p className="mt-1 mb-2 text-sm text-slate-wash">
        Paste the reviewer&rsquo;s wording exactly as they sent it.
      </p>
      <textarea
        id="reason"
        name="reason"
        rows={4}
        maxLength={4000}
        className="w-full border border-zinc-dust bg-galvanise px-3 py-2 text-sm text-millscale"
      />

      {state.error ? (
        <p role="alert" className="mt-2 text-sm text-rust-flag">
          {state.error}
        </p>
      ) : null}

      <SubmitButton
        pendingLabel="Preparing a new version…"
        className="btn-primary mt-3"
      >
        Send it to us
      </SubmitButton>
    </form>
  );
}
