"use client";

import { useState } from "react";
import { useActionState } from "react";
import { ArrowRight, CircleAlert, Mail } from "lucide-react";
import { submitLead } from "@/app/actions";
import { SelectField } from "@/components/select-field";
import {
  CREW_SIZES,
  OTHER_TRADE,
  TRADES,
  initialLeadFormState,
  type LeadFields,
  type LeadFormState,
} from "@/lib/leads";
import { CONTACT_EMAIL } from "@/lib/constants";

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

/** Props shared by every input so error state and echoed values stay consistent. */
function fieldProps(state: LeadFormState, field: LeadFields) {
  const error = state.errors?.[field];

  return {
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": error ? `${field}-error` : undefined,
    className: fieldClass(Boolean(error)),
    defaultValue: state.values?.[field] ?? "",
  };
}

/**
 * A key that changes with the echoed value, which remounts the field so the
 * value is actually applied. React only reads defaultValue on mount, so
 * without this a <select> sits back on its placeholder after a failed
 * submission even though the choice came back from the server.
 *
 * This has to be passed to the element directly. It used to be returned
 * inside fieldProps and spread in, which React ignores — it warns about a
 * spread key and drops it, so the remount never actually happened.
 */
function fieldKey(state: LeadFormState, field: LeadFields) {
  return `${field}-${state.values?.[field] ?? ""}`;
}

/**
 * Local state that follows the value the server echoes back. Returns the
 * usual [value, setValue] pair; the only difference from useState is that a
 * change in `echoed` between renders wins over what is held locally.
 */
function useEchoedState(echoed: string) {
  const [value, setValue] = useState(echoed);
  const [lastEchoed, setLastEchoed] = useState(echoed);

  if (echoed !== lastEchoed) {
    setLastEchoed(echoed);
    setValue(echoed);
  }

  return [value, setValue] as const;
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
      <h3 className="type-h3 mt-4">
        Got it — your gap check is in the queue
      </h3>
      <p className="type-body mt-3">
        Someone reads these by hand, so this isn&apos;t instant. You&apos;ll get
        one email with what&apos;s missing from your file. Nothing else, and no
        call to book.
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

export function LeadForm() {
  const [state, formAction, isPending] = useActionState(
    submitLead,
    initialLeadFormState,
  );

  /*
   * The two dropdowns are controlled, because SelectField is a listbox rather
   * than a <select> and the value has to live somewhere. The text inputs stay
   * uncontrolled on defaultValue as before.
   *
   * Both adopt whatever the server echoes back after a failed submission, by
   * comparing the echoed value to the last one seen during render — React's
   * documented way to adjust state when props change. Without it a failed
   * submission would silently clear both dropdowns, and the written-in trade
   * field would vanish along with whatever had been typed into it. An effect
   * would work too, but would render the wrong thing for a frame first.
   */
  const [trade, setTrade] = useEchoedState(state.values?.trade ?? "");
  const [crewSize, setCrewSize] = useEchoedState(
    state.values?.employee_count ?? "",
  );

  if (state.status === "success") {
    return <SuccessPanel />;
  }

  const formError = state.status === "error" ? state.message : undefined;

  return (
    <form action={formAction} className="border border-zinc-dust bg-paper p-6 md:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-1">
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

        <div className="sm:col-span-1">
          <label className={labelClass} htmlFor="employee_count">
            People on the crew
          </label>
          <SelectField
            id="employee_count"
            name="employee_count"
            options={CREW_SIZES}
            placeholder="Select a range"
            value={crewSize}
            onChange={setCrewSize}
            disabled={isPending}
            hasError={Boolean(state.errors?.employee_count)}
            describedBy={
              state.errors?.employee_count ? "employee_count-error" : undefined
            }
          />
          <FieldError
            id="employee_count-error"
            message={state.errors?.employee_count}
          />
        </div>

        {/*
          * Only rendered for "Other", rather than hidden with CSS: a disabled
          * or display:none field still posts its value in some browsers, and
          * a stale "Rigging" arriving alongside a trade of "Electrical" is
          * exactly the kind of thing that quietly corrupts a lead. Not
          * rendering it means there is nothing to post.
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
          <label className={labelClass} htmlFor="email">
            Where to send the list
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

      <button
        type="submit"
        disabled={isPending}
        className="btn-primary mt-7 w-full sm:w-auto"
      >
        {isPending ? "Sending…" : "Send my gap check"}
        {!isPending && (
          <ArrowRight aria-hidden="true" strokeWidth={2} className="h-4 w-4" />
        )}
      </button>

      <p className="mt-4 text-xs leading-relaxed text-slate-wash">
        We use this to answer your question and nothing else. No mailing list.
      </p>
    </form>
  );
}
