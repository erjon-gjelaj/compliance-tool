"use client";

import { useState } from "react";
import { useActionState } from "react";
import { ArrowRight, ChevronDown, CircleAlert, Mail } from "lucide-react";
import { submitLead } from "@/app/actions";
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

/*
 * Selects add appearance-none to drop the OS dropdown arrow, which is the one
 * part of a native control that ignores every other style and leaves the two
 * dropdowns looking like a different site from the inputs beside them. The
 * chevron below replaces it, matching the FAQ's, with right padding to keep
 * long option text from running underneath it.
 *
 * The list that drops open is still the browser's own, deliberately: it is
 * the part that works properly on a phone, with a keyboard, and with a screen
 * reader, and no div rebuilt as a listbox gets all three right.
 */
const selectClass = "appearance-none pr-11";

const labelClass = "type-label block";

function fieldClass(hasError: boolean) {
  return `${fieldBase} ${
    hasError
      ? "border-rust-flag focus:border-rust-flag"
      : "border-zinc-dust focus:border-verdigris"
  }`;
}

/**
 * Wraps a <select> so the chevron can sit over its right edge. Pointer events
 * are off on the icon, so clicking it still opens the native list rather than
 * landing on a decorative SVG.
 */
function SelectShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      {/* mt-1 offsets half of the field's own mt-2, so the chevron centres on
          the control rather than on the wrapper including its top margin. */}
      <ChevronDown
        aria-hidden="true"
        strokeWidth={1.5}
        className="pointer-events-none absolute top-1/2 right-3.5 mt-1 h-4 w-4 -translate-y-1/2 text-slate-wash"
      />
    </div>
  );
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
function fieldProps(state: LeadFormState, field: LeadFields, extra = "") {
  const error = state.errors?.[field];

  return {
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": error ? `${field}-error` : undefined,
    className: `${fieldClass(Boolean(error))} ${extra}`.trim(),
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
   * Which trade is selected, tracked only so the written-in field can appear
   * for "Other". The rest of the form stays uncontrolled.
   *
   * The second piece of state is what the server last echoed back. Comparing
   * the two during render is React's documented way to adjust state when
   * props change: after a failed submission that had "Other" selected, the
   * select remounts with the echoed value, and without this the extra field
   * would vanish along with what was typed into it. An effect would work too
   * but would show the wrong thing for a frame first.
   */
  const echoedTrade = state.values?.trade ?? "";
  const [trade, setTrade] = useState(echoedTrade);
  const [lastEchoedTrade, setLastEchoedTrade] = useState(echoedTrade);

  if (echoedTrade !== lastEchoedTrade) {
    setLastEchoedTrade(echoedTrade);
    setTrade(echoedTrade);
  }

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
          <SelectShell>
            <select
              key={fieldKey(state, "trade")}
              id="trade"
              name="trade"
              required
              disabled={isPending}
              onChange={(event) => setTrade(event.target.value)}
              {...fieldProps(state, "trade", selectClass)}
            >
              <option value="">Select a trade</option>
              {TRADES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </SelectShell>
          <FieldError id="trade-error" message={state.errors?.trade} />
        </div>

        <div className="sm:col-span-1">
          <label className={labelClass} htmlFor="employee_count">
            People on the crew
          </label>
          <SelectShell>
            <select
              key={fieldKey(state, "employee_count")}
              id="employee_count"
              name="employee_count"
              required
              disabled={isPending}
              {...fieldProps(state, "employee_count", selectClass)}
            >
              <option value="">Select a range</option>
              {CREW_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </SelectShell>
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
