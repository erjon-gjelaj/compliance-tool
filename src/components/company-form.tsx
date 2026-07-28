"use client";

import { useActionState } from "react";
import { Check, CircleAlert } from "lucide-react";

import { saveCompany, type ProfileState } from "@/app/dashboard/company/actions";
import { SubmitButton } from "@/components/submit-button";
import {
  HEADCOUNT_BANDS,
  PLATFORMS,
  TRADES,
  US_STATES,
} from "@/lib/intake";
import type { CompanyRow, ProfileField } from "@/lib/companies";

/**
 * The company profile form.
 *
 * Only the name is required. Everything else improves the review and none of
 * it blocks saving — this audience fills forms in between jobs, and a profile
 * half-filled is worth more than one abandoned because it demanded an EMR.
 *
 * Plain selects and inputs rather than the intake form's Listbox components.
 * This page is a settings screen someone visits occasionally, not the funnel,
 * and native controls are better on a phone and cost no JavaScript.
 */

const initial: ProfileState = { status: "editing" };

const labelClass = "type-label block text-millscale";
const fieldClass =
  "mt-2 w-full border border-zinc-dust bg-galvanise px-3 py-2 text-sm text-millscale";

/**
 * Marks a value we inferred rather than heard.
 *
 * Rendered as a question against the field, so nothing we guessed can sit on
 * the page looking like something the contractor told us. Nothing infers
 * anything yet — this is here so the first thing that does cannot skip it.
 */
function Unconfirmed() {
  return (
    <p className="mt-1.5 flex items-start gap-1.5 text-xs text-rust-flag">
      <CircleAlert aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      We filled this in from what we could find. Is it right? Correcting or
      re-saving it confirms it.
    </p>
  );
}

export function CompanyForm({
  company,
  unconfirmed,
}: {
  company: CompanyRow | null;
  unconfirmed: ProfileField[];
}) {
  const [state, formAction] = useActionState(saveCompany, initial);

  const flagged = (field: ProfileField) =>
    unconfirmed.includes(field) ? <Unconfirmed /> : null;

  return (
    <form action={formAction} className="border border-zinc-dust bg-paper p-6 md:p-8">
      {state.status === "saved" ? (
        <p
          role="status"
          className="mb-6 flex items-center gap-2 border-l-2 border-verdigris bg-galvanise px-3 py-2 text-sm text-millscale"
        >
          <Check aria-hidden className="h-4 w-4 shrink-0 text-verdigris" />
          Saved. Your next request will start from this.
        </p>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="name">
            Company name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            maxLength={200}
            defaultValue={company?.name ?? ""}
            className={fieldClass}
          />
          {flagged("name")}
        </div>

        <div>
          <label className={labelClass} htmlFor="website">
            Website <span className="font-normal text-slate-wash">(optional)</span>
          </label>
          <input
            id="website"
            name="website"
            type="text"
            inputMode="url"
            maxLength={300}
            placeholder="example.com"
            defaultValue={company?.website ?? ""}
            className={fieldClass}
          />
          {flagged("website")}
        </div>

        <div>
          <label className={labelClass} htmlFor="trade">
            Trade
          </label>
          <select
            id="trade"
            name="trade"
            defaultValue={company?.trade ?? ""}
            className={fieldClass}
          >
            <option value="">Not set</option>
            {TRADES.map((trade) => (
              <option key={trade} value={trade}>
                {trade}
              </option>
            ))}
          </select>
          {flagged("trade")}
        </div>

        <div>
          <label className={labelClass} htmlFor="home_state">
            Based in
          </label>
          <select
            id="home_state"
            name="home_state"
            defaultValue={company?.home_state ?? ""}
            className={fieldClass}
          >
            <option value="">Not set</option>
            {US_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
          {flagged("home_state")}
        </div>

        <div>
          <label className={labelClass} htmlFor="headcount_band">
            Roughly how many people
          </label>
          <select
            id="headcount_band"
            name="headcount_band"
            defaultValue={company?.headcount_band ?? ""}
            className={fieldClass}
          >
            <option value="">Not set</option>
            {HEADCOUNT_BANDS.map((band) => (
              <option key={band} value={band}>
                {band}
              </option>
            ))}
          </select>
          {flagged("headcount_band")}
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="platforms">
            Which platform you&apos;re registering in
          </label>
          <select
            id="platforms"
            name="platforms"
            defaultValue={company?.platforms ?? ""}
            className={fieldClass}
          >
            <option value="">Not set</option>
            {PLATFORMS.map((platform) => (
              <option key={platform} value={platform}>
                {platform}
              </option>
            ))}
          </select>
          {flagged("platforms")}
        </div>

        <fieldset className="sm:col-span-2">
          <legend className={labelClass}>States you work in</legend>
          <p className="mt-1 mb-3 text-sm text-slate-wash">
            Where the crew actually goes, which is often not just where
            you&rsquo;re based.
          </p>
          <div className="grid max-h-48 grid-cols-4 gap-x-3 gap-y-2 overflow-y-auto border border-zinc-dust p-3 sm:grid-cols-8">
            {US_STATES.map((state) => (
              <label
                key={state}
                className="flex items-center gap-1.5 text-sm text-millscale"
              >
                <input
                  type="checkbox"
                  name="operating_states"
                  value={state}
                  defaultChecked={company?.operating_states?.includes(state)}
                  className="h-3.5 w-3.5"
                />
                {state}
              </label>
            ))}
          </div>
          {flagged("operating_states")}
        </fieldset>

        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="hiring_clients">
            Who you work for{" "}
            <span className="font-normal text-slate-wash">
              (one per line, optional)
            </span>
          </label>
          <textarea
            id="hiring_clients"
            name="hiring_clients"
            rows={3}
            placeholder={"Gulf Refining\nMidstate Chemical"}
            defaultValue={(company?.hiring_clients ?? []).join("\n")}
            className={fieldClass}
          />
          {flagged("hiring_clients")}
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="operations">
            What your crew actually does{" "}
            <span className="font-normal text-slate-wash">(optional)</span>
          </label>
          <p className="mt-1 mb-2 text-sm text-slate-wash">
            In your own words. Working at height, confined space entry, hot
            work, energised equipment &mdash; whatever the job involves. This
            changes which documents are worth asking you about.
          </p>
          <textarea
            id="operations"
            name="operations"
            rows={4}
            maxLength={2000}
            defaultValue={company?.operations ?? ""}
            className={fieldClass}
          />
          {flagged("operations")}
        </div>
      </div>

      {state.error ? (
        <p role="alert" className="mt-4 text-sm text-rust-flag">
          {state.error}
        </p>
      ) : null}

      <SubmitButton pendingLabel="Saving…" className="btn-primary mt-6">
        Save
      </SubmitButton>
    </form>
  );
}
