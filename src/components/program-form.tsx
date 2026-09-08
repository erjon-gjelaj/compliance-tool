"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { Check, CheckCircle2, FileDown } from "lucide-react";

import {
  answerProgramStep,
  requestProgramPreparation,
  startCheckout,
} from "@/app/dashboard/programs/actions";
import {
  initialCheckout,
  initialPreparationRequest,
  initialProgramState,
  type CheckoutState,
  type PreparationRequestState,
  type ProgramFormState,
} from "@/lib/programs/form-state";
import { PROGRAMS_PRODUCT, formatPrice } from "@/lib/billing/catalog";
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
  checkoutEnabled,
}: {
  programId: string;
  context: CompanyContext;
  /** Whether Stripe is configured, decided on the server. */
  checkoutEnabled: boolean;
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

  /*
   * Answers survive the trip to Stripe.
   *
   * Paying means leaving this origin entirely and coming back on a fresh
   * page load, which drops React state — so somebody who answered seven
   * questions and then paid would return to an empty form and have to answer
   * them again, immediately after giving us money. That is the worst possible
   * moment to ask somebody to redo something.
   *
   * `sessionStorage` rather than a server round trip: it is same-origin, it
   * survives the redirect, it dies with the tab, and a half-finished
   * questionnaire is not worth a database row. Wrapped because storage throws
   * outright in some privacy modes, where losing the draft is a nuisance and
   * an unhandled exception would be a blank page.
   */
  const draftKey = `certloop:program:${programId}`;

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(draftKey);
      /*
       * `react-hooks/set-state-in-effect` is disabled deliberately, not
       * worked around. The rule exists to catch state derived from props,
       * which should be computed during render instead — but sessionStorage
       * does not exist during render on the server, and seeding it with a
       * lazy initialiser would make the first client render disagree with the
       * server HTML and produce a hydration error on every controlled input
       * in the form. Reading it after mount is the correct shape for a
       * browser-only store, and one extra render of an empty form is not
       * something anybody can perceive.
       */
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setAnswers(JSON.parse(saved) as Answers);
    } catch {
      // No draft, or storage is unavailable. Start empty.
    }
  }, [draftKey]);

  useEffect(() => {
    try {
      if (Object.keys(answers).length > 0) {
        sessionStorage.setItem(draftKey, JSON.stringify(answers));
      }
    } catch {
      // Not being able to save a draft is not worth interrupting anybody for.
    }
  }, [answers, draftKey]);

  // Only reachable if a route and the registry disagree, which is a bug rather
  // than a state a customer can reach. Rendering nothing beats throwing.
  if (!template) return null;

  if (state.status === "generated" && state.documentId) {
    // The document exists; the draft has done its job and keeping it would
    // repopulate the form the next time they open this program.
    try {
      sessionStorage.removeItem(draftKey);
    } catch {
      // Nothing to clean up, or storage is unavailable.
    }

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

  /*
   * They finished the questionnaire and their plan does not include having a
   * document prepared.
   *
   * Deliberately not styled as a failure. Nothing went wrong — they have just
   * described exactly what they want, and the answers travel with the request
   * so nobody has to ask again. The price is a range from lib/pricing with
   * its note attached, because a single figure here would read as a quote.
   */
  if (state.status === "locked") {
    return (
      <LockedPanel
        programId={template.id}
        shortName={template.shortName}
        answers={answers}
        companyName={context.companyName}
        checkoutEnabled={checkoutEnabled}
      />
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

/**
 * The paywall, at the moment somebody has just described what they want.
 *
 * This is the whole purchase. They answered the questions, so the product
 * knows exactly what to build; all that is left is the card. One button, one
 * price, and the document is generated the second they come back.
 *
 * `checkoutEnabled` decides between selling and asking. With Stripe
 * configured it is a real checkout. Without it, the older path — record what
 * they want, somebody replies — is still here, because a Buy button that
 * throws on click is the worst possible outcome: it takes somebody who had
 * decided to pay and shows them an error.
 */
function LockedPanel({
  programId,
  shortName,
  answers,
  companyName,
  checkoutEnabled,
}: {
  /*
   * An id and a name rather than the template, even though this component
   * runs on the same side of the boundary as its caller and could take the
   * whole thing. The guard in boundaries.test.mts is deliberately coarse —
   * grep cannot tell which side a component sits on — and the rule is worth
   * more intact than this file is worth saving two props.
   */
  programId: string;
  shortName: string;
  answers: Answers;
  companyName: string;
  checkoutEnabled: boolean;
}) {
  const [request, requestAction] = useActionState<PreparationRequestState, FormData>(
    requestProgramPreparation,
    initialPreparationRequest,
  );
  const [checkout, checkoutAction] = useActionState<CheckoutState, FormData>(
    startCheckout,
    initialCheckout,
  );

  if (request.status === "sent") {
    return (
      <div className="border border-verdigris bg-paper p-6 md:p-8">
        <CheckCircle2 aria-hidden className="h-6 w-6 text-verdigris" />
        <h2 className="type-h3 mt-4 text-millscale">That&rsquo;s with us</h2>
        <p className="type-body mt-3">
          Your answers went with it, so we know exactly what to prepare for{" "}
          {companyName}.
        </p>
        <Link href="/dashboard/requests" className="btn-primary mt-6 inline-block">
          See your requests
        </Link>
      </div>
    );
  }

  const price = formatPrice(PROGRAMS_PRODUCT);

  return (
    <div className="border border-zinc-dust bg-paper p-6 md:p-8">
      <h2 className="type-h3 text-millscale">
        Your {shortName} program is ready to build
      </h2>

      <p className="type-body mt-3">
        You&rsquo;ve answered everything it needs. Unlock the programs and
        we&rsquo;ll generate it for {companyName}{" "}
        right away &mdash; along with every other program we prepare.
      </p>

      <div className="mt-6 border-t border-zinc-dust pt-5">
        <p className="type-h3 text-millscale">
          {price}{" "}
          <span className="type-body font-normal text-slate-wash">
            once, not a subscription
          </span>
        </p>

        <ul className="mt-4 grid gap-2">
          {PROGRAMS_PRODUCT.includes.map((item) => (
            <li key={item} className="flex gap-2.5">
              <Check
                aria-hidden
                strokeWidth={1.5}
                className="mt-0.5 h-4 w-4 shrink-0 text-verdigris"
              />
              <span className="text-sm text-millscale">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {checkoutEnabled ? (
        <form action={checkoutAction} className="mt-6">
          {checkout.error ? (
            <p role="alert" className="mb-4 text-sm text-rust-flag">
              {checkout.error}
            </p>
          ) : null}

          <SubmitButton pendingLabel="Opening payment…" className="btn-primary">
            Unlock the programs &mdash; {price}
          </SubmitButton>

          <p className="mt-4 text-sm text-slate-wash">
            Card payment through Stripe. Your answers are kept, so the document
            is generated as soon as you&rsquo;re back.
          </p>
        </form>
      ) : (
        <form action={requestAction} className="mt-6">
          <input type="hidden" name="program_id" value={programId} />
          {/*
            The answers ride along rather than being re-entered. They are the
            whole value of asking at this moment instead of at the top of the
            page.
          */}
          {Object.entries(answers).map(([id, value]) => (
            <input key={id} type="hidden" name={`answer_${id}`} value={value} />
          ))}

          {request.error ? (
            <p role="alert" className="mb-4 text-sm text-rust-flag">
              {request.error}
            </p>
          ) : null}

          <SubmitButton pendingLabel="Sending…" className="btn-primary">
            Ask us to prepare it
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
