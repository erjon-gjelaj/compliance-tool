"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CheckCircle2, FileDown } from "lucide-react";

import {
  answerProgramStep,
  initialProgramState,
  type ProgramFormState,
} from "@/app/dashboard/programs/actions";
import { SubmitButton } from "@/components/submit-button";
import { visibleQuestions } from "@/lib/programs/validate";
import { programById } from "@/lib/programs/registry";
import type { Answers, CompanyContext, Question } from "@/lib/programs/types";

/**
 * The questionnaire.
 *
 * Every question on one screen rather than one per step. Seven short questions
 * is a two-minute job, and a wizard would turn it into seven page loads for no
 * gain — conditional questions simply appear as the answer above them is
 * given, which is the same guidance without the waiting.
 *
 * The branching runs client-side through `visibleQuestions`, the same function
 * the server validates with. One definition, so a question can never be shown
 * here and rejected there.
 */

function Field({
  question,
  value,
  onChange,
  disabled,
}: {
  question: Question;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const id = `answer_${question.id}`;

  return (
    <div className="border-t border-zinc-dust pt-5 first:border-t-0 first:pt-0">
      <label className="type-label block text-millscale" htmlFor={id}>
        {question.prompt}
      </label>
      {question.help ? (
        <p className="mt-1 text-sm text-slate-wash">{question.help}</p>
      ) : null}

      {question.kind === "choice" || question.kind === "boolean" ? (
        <div
          className={
            question.kind === "boolean" ? "mt-3 flex gap-2" : "mt-3 grid gap-2"
          }
        >
          {(question.kind === "boolean"
            ? [
                { id: "yes", label: "Yes" },
                { id: "no", label: "No" },
              ]
            : (question.options ?? [])
          ).map((option) => (
            <label
              key={option.id}
              className={`flex cursor-pointer items-center gap-3 border px-4 py-3 text-sm transition-colors ${
                question.kind === "boolean" ? "flex-1 justify-center" : ""
              } ${
                value === option.id
                  ? "border-verdigris bg-verdigris/8 text-millscale"
                  : "border-zinc-dust text-millscale hover:border-verdigris"
              }`}
            >
              <input
                type="radio"
                name={id}
                value={option.id}
                checked={value === option.id}
                onChange={() => onChange(option.id)}
                disabled={disabled}
                className={question.kind === "boolean" ? "sr-only" : "h-3.5 w-3.5"}
              />
              {option.label}
            </label>
          ))}
        </div>
      ) : (
        <input
          id={id}
          name={id}
          type="text"
          maxLength={200}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="mt-3 w-full border border-zinc-dust bg-galvanise px-3 py-2 text-sm text-millscale"
        />
      )}
    </div>
  );
}

/**
 * Takes the programme's ID, not the programme.
 *
 * A `ProgramTemplate` carries functions — `showWhen`, `build`, `matchesLabel`
 * — and functions cannot cross the server/client boundary. Passing the whole
 * template as a prop threw "Functions cannot be passed directly to Client
 * Components" on every render of this page.
 *
 * Looking it up here instead works because the registry is *imported* into the
 * client bundle rather than serialised into it, and that keeps the property
 * that mattered: the branching a customer sees comes from the same definition
 * the server validates against, not a second copy.
 */
export function ProgramForm({
  programId,
  context,
}: {
  programId: string;
  context: CompanyContext;
}) {
  const template = programById(programId);

  const [state, formAction, isPending] = useActionState<ProgramFormState, FormData>(
    answerProgramStep,
    initialProgramState,
  );

  /*
   * Answers are held locally so a conditional question appears the instant the
   * answer above it is clicked. The server echoes them back on an error, but
   * local state already holds the same values — nothing is lost either way,
   * and seeding from the server would fight the user mid-edit.
   */
  const [answers, setAnswers] = useState<Answers>({});

  // Only reachable if a route and the registry disagree, which is a bug rather
  // than a state a customer can reach. Rendering nothing beats throwing.
  if (!template) return null;

  if (state.status === "generated" && state.documentId) {
    return (
      <div className="border border-verdigris bg-paper p-6 md:p-8">
        <CheckCircle2 aria-hidden className="h-6 w-6 text-verdigris" />
        <h2 className="type-h3 mt-4 text-millscale">
          Your {template.shortName} program is ready
        </h2>
        <p className="type-body mt-3">
          Prepared for {context.companyName}, version {state.version}. Word and
          PDF are both in your document library, and they stay there.
        </p>

        <Link
          href={`/dashboard/documents/${state.documentId}`}
          className="btn-primary mt-6 inline-flex items-center gap-2"
        >
          <FileDown aria-hidden className="h-4 w-4" />
          Open and download
        </Link>
      </div>
    );
  }

  const shown = visibleQuestions(template, answers, context);

  return (
    <form action={formAction} className="border border-zinc-dust bg-paper p-6 md:p-8">
      <input type="hidden" name="program_id" value={template.id} />

      <div className="grid gap-5">
        {shown.map((question) => (
          <Field
            key={question.id}
            question={question}
            value={answers[question.id] ?? ""}
            disabled={isPending}
            onChange={(value) =>
              setAnswers((current) => ({ ...current, [question.id]: value }))
            }
          />
        ))}
      </div>

      {state.error ? (
        <p role="alert" className="mt-5 text-sm text-rust-flag">
          {state.error}
        </p>
      ) : null}

      <SubmitButton
        pendingLabel="Preparing your document…"
        className="btn-primary mt-6"
      >
        Generate my program
      </SubmitButton>

      <p className="mt-4 text-sm text-slate-wash">
        Prepared in the name of {context.companyName}. Everything in it comes
        from your answers above and your company profile.
      </p>
    </form>
  );
}
