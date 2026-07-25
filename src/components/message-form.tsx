"use client";

import { useActionState } from "react";
import { ArrowRight, CircleAlert, Mail } from "lucide-react";
import { submitMessage } from "@/app/actions";
import {
  HONEYPOT_FIELD,
  initialMessageFormState,
  type MessageFields,
  type MessageFormState,
} from "@/lib/messages";
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
function fieldProps(state: MessageFormState, field: MessageFields) {
  const error = state.errors?.[field];

  return {
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": error ? `contact-${field}-error` : undefined,
    className: fieldClass(Boolean(error)),
    defaultValue: state.values?.[field] ?? "",
  };
}

/**
 * Remounts a field when the echoed value changes, so the value is actually
 * applied — React only reads defaultValue on mount. Same reasoning as the
 * gap-check form, and it has to be passed to the element directly rather
 * than spread in, or React drops it.
 */
function fieldKey(state: MessageFormState, field: MessageFields) {
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
      <h3 className="type-h3 mt-4">That&apos;s landed in our inbox</h3>
      <p className="type-body mt-3">
        A person reads it — usually within a few business days. The reply comes
        from {CONTACT_EMAIL}, so it is worth checking a spam folder if nothing
        shows up.
      </p>
      <p className="mt-4 text-sm leading-relaxed text-slate-wash">
        We did not send you a copy of what you wrote, so keep your own if you
        need one.
      </p>
    </div>
  );
}

export function MessageForm() {
  const [state, formAction, isPending] = useActionState(
    submitMessage,
    initialMessageFormState,
  );

  if (state.status === "success") {
    return <SuccessPanel />;
  }

  const formError = state.status === "error" ? state.message : undefined;

  return (
    <form
      action={formAction}
      className="border border-zinc-dust bg-paper p-6 md:p-8"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-1">
          <label className={labelClass} htmlFor="contact-name">
            Your name
          </label>
          <input
            key={fieldKey(state, "name")}
            id="contact-name"
            name="name"
            type="text"
            required
            maxLength={100}
            autoComplete="name"
            placeholder="Who we're replying to"
            disabled={isPending}
            {...fieldProps(state, "name")}
          />
          <FieldError id="contact-name-error" message={state.errors?.name} />
        </div>

        <div className="sm:col-span-1">
          <label className={labelClass} htmlFor="contact-email">
            Your email
          </label>
          <input
            key={fieldKey(state, "email")}
            id="contact-email"
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            placeholder="you@yourcompany.com"
            disabled={isPending}
            {...fieldProps(state, "email")}
          />
          <FieldError id="contact-email-error" message={state.errors?.email} />
        </div>

        <div className="sm:col-span-2">
          {/*
            * Field ids are prefixed because this form shares a page with
            * PageSection headings that use the same words as anchor targets —
            * an id="message" textarea silently collided with the section's
            * own id="message", pointing the label at the heading instead.
            * The name attributes, which are what the action reads, are
            * unprefixed.
            */}
          <label className={labelClass} htmlFor="contact-message">
            Your message
          </label>
          <textarea
            key={fieldKey(state, "message")}
            id="contact-message"
            name="message"
            required
            rows={7}
            maxLength={4000}
            placeholder="What you need, and anything from the list above that applies."
            disabled={isPending}
            {...fieldProps(state, "message")}
          />
          <FieldError
            id="contact-message-error"
            message={state.errors?.message}
          />
        </div>
      </div>

      {/*
       * Honeypot. Hidden from people and from screen readers, left out of the
       * tab order, and with autocomplete off so a password manager doesn't
       * fill it in on a real visitor's behalf. Anything that arrives with it
       * filled in is discarded server-side.
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

      <button
        type="submit"
        disabled={isPending}
        className="btn-primary mt-7 w-full sm:w-auto"
      >
        {isPending ? "Sending…" : "Send message"}
        {!isPending && (
          <ArrowRight aria-hidden="true" strokeWidth={2} className="h-4 w-4" />
        )}
      </button>

      <p className="mt-4 text-xs leading-relaxed text-slate-wash">
        This goes to {CONTACT_EMAIL} and nowhere else. We use it to answer you.
        No mailing list.
      </p>
    </form>
  );
}
