"use client";

import { useRef, useState } from "react";
import { useActionState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  FileText,
  Mail,
  Paperclip,
  X,
} from "lucide-react";
import { createUploadSlots, submitIntakeStep } from "@/app/actions";
import { SelectField } from "@/components/select-field";
import { Spinner } from "@/components/spinner";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { HONEYPOT_FIELD } from "@/lib/messages";
import {
  DEFAULT_ENTRY_REASON,
  MAX_REJECTION_NOTES,
  type EntryReason,
} from "@/lib/entry-points";
import {
  ACCEPT_ATTRIBUTE,
  MAX_FILES,
  MAX_TOTAL_BYTES,
  checkClaim,
  formatBytes,
} from "@/lib/uploads";
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
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/constants";

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
  const labels = ["Your job", "Your company", "What you have", "Documents"];

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
        Check your email in a minute or two. You&apos;ll get one message listing
        what your file still looks short on, in the order worth tackling.
        Nothing else, and no call to book.
      </p>
      <p className="mt-4 text-sm leading-relaxed text-slate-wash">
        It stays in your dashboard too &mdash; sign in with this address any
        time to read it again. Anything unusual about your situation? Reply to
        the email, or write to{" "}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="text-verdigris underline underline-offset-4"
        >
          {CONTACT_EMAIL}
        </a>
        .
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
export function IntakeForm({
  entryReason = DEFAULT_ENTRY_REASON,
  initialState = initialIntakeState,
}: {
  /**
   * Which door this form is serving. Posted on step 1 and recorded on the
   * row, so the review and the dashboard can lead with what the person came
   * for. Defaults to the gap check, which is the door that predates the rest.
   */
  entryReason?: EntryReason;
  /**
   * Where to start. Defaults to a blank step 1.
   *
   * Passed in by /dashboard/[id]/continue to resume an abandoned intake: it
   * carries the row's id, the step they stopped on and the answers already
   * stored, so someone picks up where they left off rather than retyping the
   * form. Every step already posts `submission_id` and updates that row, so
   * resuming needs no new server path — only a different starting state.
   */
  initialState?: IntakeFormState;
} = {}) {
  const [state, formAction, isPending] = useActionState(
    submitIntakeStep,
    initialState,
  );

  const [trade, setTrade] = useEchoedState(echoed(state, "trade"));
  const [platform, setPlatform] = useEchoedState(echoed(state, "platform"));
  const [headcount, setHeadcount] = useEchoedState(
    echoed(state, "headcount_band"),
  );
  const [history, setHistory] = useEchoedState(
    echoed(state, "previously_registered"),
  );

  /*
   * Step 4's files are held here rather than left in the <input>, so the list
   * can be shown with sizes and individual files removed. The input itself
   * has no `name` and never posts — the bytes go straight to Supabase and
   * only the resulting paths are submitted.
   */
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string>();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addFiles(chosen: FileList | null) {
    if (!chosen || chosen.length === 0) return;

    const next = [...files];
    let error: string | undefined;

    for (const file of Array.from(chosen)) {
      if (next.length >= MAX_FILES) {
        error = `${MAX_FILES} files is the most we take at once.`;
        break;
      }

      // Checked here only to save someone's mobile data on a file we were
      // never going to accept. The server checks all of it again, against
      // the bytes rather than the claim.
      const check = checkClaim({
        name: file.name,
        type: file.type,
        size: file.size,
      });

      if (!check.ok) {
        error = `${file.name}: ${check.reason}.`;
        continue;
      }

      if (next.some((existing) => existing.name === file.name)) continue;

      next.push(file);
    }

    const total = next.reduce((sum, file) => sum + file.size, 0);
    if (total > MAX_TOTAL_BYTES) {
      setFileError(
        `That's ${formatBytes(total)} altogether, over the ${formatBytes(MAX_TOTAL_BYTES)} limit.`,
      );
      return;
    }

    setFileError(error);
    setFiles(next);

    // Cleared so choosing the same file again after removing it still fires
    // a change event.
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(name: string) {
    setFiles((current) => current.filter((file) => file.name !== name));
    setFileError(undefined);
  }

  /**
   * Sends the files, then submits the step.
   *
   * Only intercepts the last step, and only when there is something to
   * upload — every other submit goes through the form action untouched.
   */
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (state.step !== TOTAL_STEPS || files.length === 0) return;

    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;

    if (submitter?.value !== "next") return;

    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    setFileError(undefined);
    setUploading(true);

    try {
      const claims = files.map((file) => ({
        name: file.name,
        type: file.type,
        size: file.size,
      }));

      const slots = await createUploadSlots(state.submissionId ?? "", claims);

      if (!slots.ok) {
        setFileError(slots.error);
        return;
      }

      const supabase = getSupabaseBrowserClient();
      const uploaded: { path: string; fileName: string }[] = [];

      for (const [index, slot] of slots.slots.entries()) {
        const { error } = await supabase.storage
          .from("submission-documents")
          .uploadToSignedUrl(slot.path, slot.token, files[index]);

        if (error) {
          // Stops rather than pressing on. Sending a partial set while
          // showing a success panel would tell someone their documents were
          // received when some of them were not.
          console.error("Upload failed:", error.message);
          setFileError(
            `${slot.fileName} didn't upload. Check your connection and try again, or send without attachments.`,
          );
          return;
        }

        uploaded.push({ path: slot.path, fileName: slot.fileName });
      }

      // The submitter's name/value isn't included by new FormData(form), so
      // the intent is set by hand.
      formData.set("intent", "next");
      formData.set("uploads", JSON.stringify(uploaded));

      formAction(formData);
    } catch (cause) {
      console.error("Upload step failed:", cause);
      setFileError(
        "Something went wrong sending those files. Try again, or send without attachments.",
      );
    } finally {
      setUploading(false);
    }
  }

  if (state.status === "success") {
    return <SuccessPanel />;
  }

  const { step } = state;

  /* Two different waits, one disabled state: the files going to storage, and
   * the step going to the server. */
  const busy = isPending || uploading;
  const formError = state.status === "error" ? state.message : undefined;
  const heldDocuments = echoedList(state, "documents_held");
  const heldStates = echoedList(state, "states");

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
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
          {/* Which door this is. Step 1 only — later steps update a row that
           * already has it, and re-posting it would let a later step change
           * what kind of submission this is. */}
          <input type="hidden" name="entry_reason" value={entryReason} />

          {/*
           * Rendered only on the rejection door, and not merely hidden there:
           * a disabled or hidden field can still post, and a paste left behind
           * by someone who changed their mind must not ride onto a submission
           * that is not about a rejection. Same reasoning as trade_other
           * below.
           */}
          {entryReason === "rejection" && (
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="rejection_notes">
                What did they send back?
              </label>
              <p className="mt-1.5 mb-2 text-sm leading-relaxed text-slate-wash">
                Paste the reviewer&apos;s comments or the deficiency notice,
                exactly as they wrote it. If you only have a screenshot or the
                document itself, leave this and attach it at the last step.
              </p>
              <textarea
                key={fieldKey(state, "rejection_notes")}
                id="rejection_notes"
                name="rejection_notes"
                rows={5}
                maxLength={MAX_REJECTION_NOTES}
                placeholder="&quot;Lockout/tagout program does not include periodic inspection requirements…&quot;"
                disabled={isPending}
                {...fieldProps(state, "rejection_notes")}
              />
              <FieldError
                id="rejection_notes-error"
                message={state.errors?.rejection_notes}
              />
            </div>
          )}

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

      {step === 4 && (
        <div className="grid gap-5">
          <div>
            <p className={labelClass}>Your documents</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-wash">
              If you have any of it written down already, attach it. Reading
              what you actually have beats guessing at it — and a photo of a
              training card taken on your phone is a perfectly good file.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-wash">
              PDFs, Word documents and photos. Up to {MAX_FILES} files,{" "}
              {formatBytes(MAX_TOTAL_BYTES)} altogether.
            </p>
          </div>

          <div>
            <label
              htmlFor="documents"
              className="inline-flex cursor-pointer items-center gap-2 border border-zinc-dust px-4 py-2.5 text-[0.95rem] hover:border-verdigris"
            >
              <Paperclip
                aria-hidden="true"
                strokeWidth={1.5}
                className="h-4 w-4"
              />
              Choose files
            </label>
            {/*
             * No `name`, deliberately: this input never posts. The bytes go
             * straight from the browser to Supabase Storage with a signed
             * upload URL, because a Vercel serverless request body caps at
             * 4.5MB and this step takes far more than that.
             */}
            <input
              ref={fileInputRef}
              id="documents"
              type="file"
              multiple
              accept={ACCEPT_ATTRIBUTE}
              disabled={isPending || uploading}
              onChange={(event) => addFiles(event.target.files)}
              className="sr-only"
            />
          </div>

          {files.length > 0 && (
            <ul className="grid gap-2">
              {files.map((file) => (
                <li
                  key={file.name}
                  className="flex items-center gap-3 border border-zinc-dust px-3.5 py-2.5 text-sm"
                >
                  <FileText
                    aria-hidden="true"
                    strokeWidth={1.5}
                    className="h-4 w-4 shrink-0 text-slate-wash"
                  />
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                  <span className="shrink-0 text-slate-wash tabular-nums">
                    {formatBytes(file.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(file.name)}
                    disabled={isPending || uploading}
                    className="shrink-0 text-slate-wash hover:text-rust-flag disabled:opacity-60"
                  >
                    <X aria-hidden="true" strokeWidth={2} className="h-4 w-4" />
                    <span className="sr-only">Remove {file.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {(fileError || state.errors?.uploads) && (
            <p className="text-sm text-rust-flag">
              {fileError ?? state.errors?.uploads}
            </p>
          )}

          {files.length > 0 && (
            <div className="border-t border-zinc-dust pt-4">
              <CheckboxRow
                id="upload_consent"
                name="upload_consent"
                label={`I'm happy for ${SITE_NAME} to use these documents to prepare my review.`}
                defaultChecked={Boolean(echoed(state, "upload_consent"))}
                disabled={isPending || uploading}
              />
              <p className="mt-3 text-xs leading-relaxed text-slate-wash">
                They&apos;re stored privately, are not shared with a hiring
                client or a prequalification platform, and are used for nothing
                but preparing your review. Ask us and we delete them — files and
                record together. Full detail on the{" "}
                <Link
                  href="/privacy"
                  className="text-verdigris underline underline-offset-4"
                >
                  privacy page
                </Link>
                .
              </p>
              <FieldError
                id="upload_consent-error"
                message={state.errors?.upload_consent}
              />
            </div>
          )}
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
          disabled={busy}
          className="btn-primary w-full sm:w-auto"
        >
          {uploading
            ? "Sending your files…"
            : isPending
              ? "Saving…"
              : step === TOTAL_STEPS
                ? "Send my gap check"
                : "Continue"}
          {busy ? (
            <Spinner />
          ) : step === TOTAL_STEPS ? (
            <Check aria-hidden="true" strokeWidth={2} className="h-4 w-4" />
          ) : (
            <ArrowRight aria-hidden="true" strokeWidth={2} className="h-4 w-4" />
          )}
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
            disabled={busy}
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
            disabled={busy}
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
          : step === TOTAL_STEPS
            ? "Nothing to attach? Skip and send — plenty of people have nothing written down yet, and that's an answer in itself."
            : "Answered enough? Skip the rest — you'll still get a reply."}
      </p>
    </form>
  );
}
