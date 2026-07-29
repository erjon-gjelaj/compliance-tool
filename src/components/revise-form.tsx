"use client";

import { useActionState } from "react";
import { Check, HelpCircle } from "lucide-react";

import { reviseDocument } from "@/app/dashboard/programs/actions";
import { initialRevisionState } from "@/lib/programs/form-state";
import { SubmitButton } from "@/components/submit-button";

/**
 * Asking for a revision after a hiring client sent the document back.
 *
 * Three states. The customer pastes what the reviewer said; either a new
 * version is produced, or we come back with questions.
 *
 * The questions state is the one worth understanding. It appears when the
 * request could not be carried out without assuming something — a name, a
 * location, which of two readings was meant — and the alternative to asking
 * is a document containing an invented fact. That is the failure this whole
 * feature exists to avoid, so the questions are not an error state and are
 * deliberately not styled as one.
 */
export function ReviseForm({ documentId }: { documentId: string }) {
  const [state, formAction] = useActionState(reviseDocument, initialRevisionState);

  if (state.status === "sent") {
    return (
      <div role="status" className="border border-verdigris bg-paper p-5">
        <div className="flex gap-3">
          <Check aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-verdigris" />
          <p className="type-body">
            A new version has been prepared and is above. The earlier one is
            kept in the history below.
          </p>
        </div>

        {/*
          What actually changed, in the words of whatever produced it. Shown
          rather than only recorded, because somebody about to forward this to
          a hiring client should be able to see what we did to their document
          without opening it.
        */}
        {state.summary && state.summary.length > 0 ? (
          <div className="mt-4 border-t border-zinc-dust pt-4">
            <p className="type-label text-millscale">What changed</p>
            <ul className="type-body mt-2 grid gap-1.5">
              {state.summary.map((entry) => (
                <li key={entry} className="flex gap-2">
                  <span aria-hidden className="text-verdigris">
                    &mdash;
                  </span>
                  {entry}
                </li>
              ))}
            </ul>
            <p className="type-body mt-3">
              Read it over before you send it on.
            </p>
          </div>
        ) : null}
      </div>
    );
  }

  if (state.status === "clarifying" && state.questions) {
    return (
      <form action={formAction} className="border border-verdigris bg-paper p-5">
        <input type="hidden" name="document_id" value={documentId} />
        <input type="hidden" name="carried_request" value={state.request ?? ""} />

        <div className="flex gap-3">
          <HelpCircle
            aria-hidden
            className="mt-0.5 h-5 w-5 shrink-0 text-verdigris"
          />
          <div>
            <p className="type-label text-millscale">
              We need to check{" "}
              {state.questions.length === 1 ? "one thing" : "a few things"}
            </p>
            <p className="type-body mt-1">
              Nothing goes into your document that you haven&rsquo;t told us, so
              rather than assume, here&rsquo;s what we need from you.
            </p>
          </div>
        </div>

        <ol className="mt-5 grid gap-4">
          {state.questions.map((question, index) => (
            <li key={question}>
              {/*
                The question travels back alongside the answer. The model has
                to see what it asked, and re-deriving the questions would mean
                a second call that might ask different ones — leaving answers
                paired with questions nobody asked.
              */}
              <input type="hidden" name="asked" value={question} />
              <label
                className="type-label block text-millscale"
                htmlFor={`answer_${index}`}
              >
                {question}
              </label>
              <input
                id={`answer_${index}`}
                name={`answer_${index}`}
                maxLength={500}
                autoComplete="off"
                className="mt-2 w-full border border-zinc-dust bg-galvanise px-3 py-2 text-sm text-millscale"
              />
            </li>
          ))}
        </ol>

        {state.error ? (
          <p role="alert" className="mt-3 text-sm text-rust-flag">
            {state.error}
          </p>
        ) : null}

        <SubmitButton
          pendingLabel="Preparing a new version…"
          className="btn-primary mt-5"
        >
          Send these answers
        </SubmitButton>
      </form>
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
        defaultValue={state.request ?? ""}
        className="w-full border border-zinc-dust bg-galvanise px-3 py-2 text-sm text-millscale"
      />

      {state.error ? (
        <p role="alert" className="mt-2 text-sm text-rust-flag">
          {state.error}
        </p>
      ) : null}

      <SubmitButton
        pendingLabel="Reading your document…"
        className="btn-primary mt-3"
      >
        Send it to us
      </SubmitButton>
    </form>
  );
}
