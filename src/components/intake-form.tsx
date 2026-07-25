"use client";

import { useState } from "react";
import { useActionState } from "react";
import { ArrowLeft, ArrowRight, Check, CircleAlert, Mail } from "lucide-react";
import { submitIntakeStep } from "@/app/actions";
import { SelectField } from "@/components/select-field";
import { HONEYPOT_FIELD } from "@/lib/messages";
import {
  DOCUMENT_CATEGORIES,
  DONT_KNOW,
  HEADCOUNT_BANDS,
  OTHER_TRADE,
  PLATFORMS,
  REGISTRATION_HISTORY,
  TOTAL_STEPS,
  TRADES,
  US_STATES,
  initialIntakeState,
  type IntakeField,
  type IntakeFormState,
} from "@/lib/intake";
import { CONTACT_EMAIL } from "@/lib/constants";

/* Shared with the lead and contact forms, so a field looks the same wherever
 * it appears. */
const fieldBase =
  "mt-2 w-full border bg-paper px-3.5 py-2.5 text-[0.95rem] text-millscale placeholder:text-slate-wash/70 focus:outline-none disabled:opacity-60";

const labelClass = "type-label block";

function fieldClass(hasError: boolean) {
  return `${fieldBase} ${
    hasError
      ? "border-rust-flag focus:border-rust-flag"
      : "border-zinc-dust focus:border-verdigris"
  }`;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;

  return (
    <p id={id} className="mt-2 text-sm text-rust-flag">
      {message}
    </p>
  );
}

/** The echoed value for a single-valued field. */
function echoed(state: IntakeFormState, field: IntakeField): string {
  const value = state.values?.[field];
  return typeof value === "string" ? value : "";
}

/** The echoed value for a checkbox group. */
function echoedList(state: IntakeFormState, field: IntakeField): string[] {
  const value = state.values?.[field];
  return Array.isArray(value) ? value : [];
}

function fieldProps(state: IntakeFormState, field: IntakeField) {
  const error = state.errors?.[field];

  return {
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": error ? `${field}-error` : undefined,
    className: fieldClass(Boolean(error)),
    defaultValue: echoed(state, field),
  };
}

/**
 * React only reads defaultValue on mount, so a field has to remount for an
 * echoed value to actually appear. Keying on the value does that. It has to
 * be passed to the element directly — a key inside a spread is dropped.
 */
function fieldKey(state: IntakeFormState, field: IntakeField) {
  return `${field}-${echoed(state, field)}`;
}

/**
 * Local state that follows the value the server echoes back, for the
 * controlled listboxes. Same hook as the lead form: a change in `echo`
 * between renders wins over what is held locally, which is what makes a
 * rejected step — or a step arrived at by going back — show the stored
 * answer rather than an empty control.
 */
function useEchoedState(echo: string) {
  const [value, setValue] = useState(echo);
  const [lastEcho, setLastEcho] = useState(echo);

  if (echo !== lastEcho) {
    setLastEcho(echo);
    setValue(echo);
  }

  return [value, setValue] as const;
}

function StepIndicator({ step }: { step: number }) {
  const labels = ["Your job", "Your company", "What you have"];

  return (
    <ol className="mb-7 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      {labels.map((label, index) => {
        const number = index + 1;
        const done = number < step;
        const current = number === step;

        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={
                current
                  ? "text-millscale"
                  : done
                    ? "text-verdigris"
                    : "text-slate-wash"
              }
              aria-current={current ? "step" : undefined}
            >
              <span className="tabular-nums">{number}.</span> {label}
            </span>
            {number < labels.length && (
              <span aria-hidden="true" className="text-zinc-dust">
                /
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** A checkbox drawn to match the rest of the form rather than the OS. */
function CheckboxRow({
  id,
  name,
  value,
  label,
  defaultChecked,
  disabled,
}: {
  id: string;
  name: string;
  value?: string;
  label: string;
  defaultChecked?: boolean;
  disabled?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 text-[0.95rem] leading-relaxed"
    >
      <input
        id={id}
        name={name}
        value={value}
        type="checkbox"
        defaultChecked={defaultChecked}
        disabled={disabled}
        className="mt-1 h-4 w-4 shrink-0 accent-verdigris"
      />
      <span>{label}</span>
    </label>
  );
}

function SuccessPanel() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="border border-verdigris bg-paper p-6 md:p-8"
    >
      <Mail
        aria-hidden="true"
        strokeWidth={1.5}
        className="h-6 w-6 text-verdigris"
      />
      <h3 className="type-h3 mt-4">Got it — your gap check is in</h3>
      <p className="type-body mt-3">
        You&apos;ll get one email listing what your file still looks short on,
        in the order worth tackling. Nothing else, and no call to book.
      </p>
      <p className="mt-4 text-sm leading-relaxed text-slate-wash">
        Deadline sooner than that? Reply straight to{" "}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="text-verdigris underline underline-offset-4"
        >
          {CONTACT_EMAIL}
        </a>{" "}
        and say so.
      </p>
    </div>
  );
}

/**
 * The Scope B intake: three steps instead of one screen.
 *
 * Two things drive the shape. This audience fills the form in on a phone at a
 * job site, so a long single page is worse than short screens. And every step
 * after the first is skippable, because a partial answer is worth far more
 * than an abandoned form — each step is sent to the server as it is finished,
 * so an intake left at step 2 is still a row with a name and an email on it.
 *
 * Step 4, the document upload, is task 026. It slots in ahead of the send,
 * which is why TOTAL_STEPS lives in lib/intake rather than being written out
 * here.
 */
export function IntakeForm() {
  const [state, formAction, isPending] = useActionState(
    submitIntakeStep,
    initialIntakeState,
  );

  const [trade, setTrade] = useEchoedState(echoed(state, "trade"));
  const [platform, setPlatform] = useEchoedState(echoed(state, "platform"));
  const [headcount, setHeadcount] = useEchoedState(
    echoed(state, "headcount_band"),
  );
  const [history, setHistory] = useEchoedState(
    echoed(state, "previously_registered"),
  );

  if (state.status === "success") {
    return <SuccessPanel />;
  }

  const { step } = state;
  const formError = state.status === "error" ? state.message : undefined;
  const heldDocuments = echoedList(state, "documents_held");
  const heldStates = echoedList(state, "states");

  return (
    <form
      action={formAction}
      className="border border-zinc-dust bg-paper p-6 md:p-8"
    >
      <StepIndicator step={step} />

      {/* Carried on every step so the server knows which one it is answering,
       * and which row to attach it to. */}
      <input type="hidden" name="step" value={step} />
      <input
        type="hidden"
        name="submission_id"
        value={state.submissionId ?? ""}
      />

      {step === 1 && (
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="trade">
              Your trade
            </label>
            <SelectField
              id="trade"
              name="trade"
              options={TRADES}
              placeholder="Select a trade"
              value={trade}
              onChange={setTrade}
              disabled={isPending}
              hasError={Boolean(state.errors?.trade)}
              describedBy={state.errors?.trade ? "trade-error" : undefined}
            />
            <FieldError id="trade-error" message={state.errors?.trade} />
          </div>

          <div>
            <label className={labelClass} htmlFor="platform">
              Which platform
            </label>
            <SelectField
              id="platform"
              name="platform"
              options={PLATFORMS}
              placeholder="Select a platform"
              value={platform}
              onChange={setPlatform}
              disabled={isPending}
              hasError={Boolean(state.errors?.platform)}
              describedBy={
                state.errors?.platform ? "platform-error" : undefined
              }
            />
            <FieldError id="platform-error" message={state.errors?.platform} />
          </div>

          {/*
           * Rendered only for "Other" rather than hidden with CSS: a hidden
           * or disabled field can still post its value, and a stale "Rigging"
           * arriving next to a trade of "Electrical" quietly corrupts the
           * record. Not rendering it means there is nothing to post.
           */}
          {trade === OTHER_TRADE && (
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="trade_other">
                Which trade is it?
              </label>
              <input
                key={fieldKey(state, "trade_other")}
                id="trade_other"
                name="trade_other"
                type="text"
                required
                maxLength={80}
                autoFocus
                placeholder="Rigging, millwrighting, hydroblasting…"
                disabled={isPending}
                {...fieldProps(state, "trade_other")}
              />
              <FieldError
                id="trade_other-error"
                message={state.errors?.trade_other}
              />
            </div>
          )}

          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="hiring_client">
              Who&apos;s asking you to register
            </label>
            <input
              key={fieldKey(state, "hiring_client")}
              id="hiring_client"
              name="hiring_client"
              type="text"
              required
              maxLength={200}
              autoComplete="organization"
              placeholder="The refinery, plant, or GC that sent you the request"
              disabled={isPending}
              {...fieldProps(state, "hiring_client")}
            />
            <FieldError
              id="hiring_client-error"
              message={state.errors?.hiring_client}
            />
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="deadline">
              When do they need you approved by
            </label>
            <input
              key={fieldKey(state, "deadline")}
              id="deadline"
              name="deadline"
              type="date"
              disabled={isPending}
              {...fieldProps(state, "deadline")}
            />
            <div className="mt-3">
              <CheckboxRow
                id="deadline_unknown"
                name="deadline_unknown"
                label="They haven't given me a date"
                defaultChecked={Boolean(echoed(state, "deadline_unknown"))}
                disabled={isPending}
              />
            </div>
            <FieldError id="deadline-error" message={state.errors?.deadline} />
          </div>

          <div>
            <label className={labelClass} htmlFor="contact_name">
              Your name
            </label>
            <input
              key={fieldKey(state, "contact_name")}
              id="contact_name"
              name="contact_name"
              type="text"
              required
              maxLength={120}
              autoComplete="name"
              placeholder="Who we're writing back to"
              disabled={isPending}
              {...fieldProps(state, "contact_name")}
            />
            <FieldError
              id="contact_name-error"
              message={state.errors?.contact_name}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="email">
              Where to send it
            </label>
            <input
              key={fieldKey(state, "email")}
              id="email"
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              placeholder="you@yourcompany.com"
              disabled={isPending}
              {...fieldProps(state, "email")}
            />
            <FieldError id="email-error" message={state.errors?.email} />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-6">
          <p className="text-sm leading-relaxed text-slate-wash">
            All of this is optional. Skip whatever you don&apos;t have to hand —
            it changes how specific we can be, not whether you get an answer.
          </p>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="headcount_band">
                People on the crew
              </label>
              <SelectField
                id="headcount_band"
                name="headcount_band"
                options={HEADCOUNT_BANDS}
                placeholder="Select a range"
                value={headcount}
                onChange={setHeadcount}
                disabled={isPending}
                hasError={Boolean(state.errors?.headcount_band)}
                describedBy={
                  state.errors?.headcount_band
                    ? "headcount_band-error"
                    : undefined
                }
              />
              <FieldError
                id="headcount_band-error"
                message={state.errors?.headcount_band}
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="previously_registered">
                Registered on one of these before?
              </label>
              <SelectField
                id="previously_registered"
                name="previously_registered"
                options={REGISTRATION_HISTORY}
                placeholder="Select an answer"
                value={history}
                onChange={setHistory}
                disabled={isPending}
                hasError={Boolean(state.errors?.previously_registered)}
                describedBy={
                  state.errors?.previously_registered
                    ? "previously_registered-error"
                    : undefined
                }
              />
              <FieldError
                id="previously_registered-error"
                message={state.errors?.previously_registered}
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="emr">
                EMR
              </label>
              <input
                key={fieldKey(state, "emr")}
                id="emr"
                name="emr"
                type="text"
                inputMode="decimal"
                maxLength={7}
                placeholder="e.g. 0.94"
                disabled={isPending}
                {...fieldProps(state, "emr")}
              />
              <FieldError id="emr-error" message={state.errors?.emr} />
            </div>

            <div>
              <label className={labelClass} htmlFor="trir">
                TRIR
              </label>
              <input
                key={fieldKey(state, "trir")}
                id="trir"
                name="trir"
                type="text"
                inputMode="decimal"
                maxLength={7}
                placeholder="e.g. 1.2"
                disabled={isPending}
                {...fieldProps(state, "trir")}
              />
              <FieldError id="trir-error" message={state.errors?.trir} />
            </div>
          </div>

          <p className="text-sm leading-relaxed text-slate-wash">
            Don&apos;t know your EMR or TRIR? Leave them blank — that is a
            normal answer and we won&apos;t guess a number for you.
          </p>

          <fieldset>
            <legend className={labelClass}>Where you work</legend>
            <p className="mt-1 text-sm text-slate-wash">
              Tick the states you take work in.
            </p>
            <div
              className="mt-3 flex flex-wrap gap-1.5"
              aria-describedby={
                state.errors?.states ? "states-error" : undefined
              }
            >
              {US_STATES.map((code) => (
                <label
                  key={code}
                  className="cursor-pointer border border-zinc-dust px-2.5 py-1.5 text-sm tabular-nums has-[:checked]:border-verdigris has-[:checked]:text-verdigris"
                >
                  <input
                    type="checkbox"
                    name="states"
                    value={code}
                    defaultChecked={heldStates.includes(code)}
                    disabled={isPending}
                    className="sr-only"
                  />
                  {code}
                </label>
              ))}
            </div>
            <FieldError id="states-error" message={state.errors?.states} />
          </fieldset>
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-5">
          <div>
            <p className={labelClass}>What you already have</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-wash">
              Tick anything you know you have written down somewhere. This is
              your own account of your file — we take it as that and nothing
              more.
            </p>
          </div>

          <fieldset
            className="grid gap-3 sm:grid-cols-2"
            aria-describedby={
              state.errors?.documents_held ? "documents_held-error" : undefined
            }
          >
            <legend className="sr-only">Documents you already have</legend>
            {DOCUMENT_CATEGORIES.map((category, index) => (
              <CheckboxRow
                key={category}
                id={`document-${index}`}
                name="documents_held"
                value={category}
                label={category}
                defaultChecked={heldDocuments.includes(category)}
                disabled={isPending}
              />
            ))}
          </fieldset>
          <FieldError
            id="documents_held-error"
            message={state.errors?.documents_held}
          />

          <div className="border-t border-zinc-dust pt-4">
            <CheckboxRow
              id="documents_unsure"
              name="documents_unsure"
              label={`${DONT_KNOW} what we have — someone else handled it`}
              defaultChecked={Boolean(echoed(state, "documents_unsure"))}
              disabled={isPending}
            />
          </div>
        </div>
      )}

      {/*
       * Honeypot. Positioned off-canvas by the .honeypot class rather than
       * display:none, because some bots skip hidden fields, and aria-hidden
       * plus tabIndex -1 keeps assistive technology and keyboard users away
       * from it. Anything arriving with it filled in is discarded server-side.
       */}
      <div className="honeypot" aria-hidden="true">
        <label htmlFor={HONEYPOT_FIELD}>Company website</label>
        <input
          id={HONEYPOT_FIELD}
          name={HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      {formError && (
        <div
          role="alert"
          className="mt-6 flex gap-3 border border-rust-flag bg-galvanise p-4"
        >
          <CircleAlert
            aria-hidden="true"
            strokeWidth={1.5}
            className="mt-0.5 h-5 w-5 shrink-0 text-rust-flag"
          />
          <p className="text-sm leading-relaxed">{formError}</p>
        </div>
      )}

      <div className="mt-7 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          name="intent"
          value="next"
          disabled={isPending}
          className="btn-primary w-full sm:w-auto"
        >
          {isPending
            ? "Saving…"
            : step === TOTAL_STEPS
              ? "Send my gap check"
              : "Continue"}
          {!isPending &&
            (step === TOTAL_STEPS ? (
              <Check aria-hidden="true" strokeWidth={2} className="h-4 w-4" />
            ) : (
              <ArrowRight
                aria-hidden="true"
                strokeWidth={2}
                className="h-4 w-4"
              />
            ))}
        </button>

        {/*
         * Skip is a real submit button, not a link: it has to reach the
         * server so the row records how far they got. Step 1 has none — it
         * is the step that produces a lead at all.
         */}
        {step > 1 && (
          <button
            type="submit"
            name="intent"
            value="skip"
            disabled={isPending}
            className="text-sm text-slate-wash underline underline-offset-4 hover:text-millscale disabled:opacity-60"
          >
            {step === TOTAL_STEPS ? "Skip and send" : "Skip this step"}
          </button>
        )}

        {step > 1 && (
          <button
            type="submit"
            name="intent"
            value="back"
            formNoValidate
            disabled={isPending}
            className="flex items-center gap-1.5 text-sm text-slate-wash hover:text-millscale disabled:opacity-60"
          >
            <ArrowLeft aria-hidden="true" strokeWidth={2} className="h-4 w-4" />
            Back
          </button>
        )}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-slate-wash">
        {step === 1
          ? "We save your answers as you go, so an interruption doesn't cost you the form. We use them to answer your question and nothing else. No mailing list."
          : "Answered enough? Skip the rest — you'll still get a reply."}
      </p>
    </form>
  );
}
