"use client";

import { useState } from "react";
import { ArrowRight, Wrench } from "lucide-react";
import { SITE_NAME } from "@/lib/constants";

/* Trades taken from the audience described in business-model.md. */
const TRADES = [
  "Electrical",
  "Scaffolding",
  "Welding / fabrication",
  "Insulation",
  "Industrial cleaning",
  "Other",
];

const CREW_SIZES = ["1-5", "6-10", "11-25", "26-50", "51+"];

const fieldClass =
  "mt-2 w-full border border-zinc-dust bg-paper px-3.5 py-2.5 text-[0.95rem] text-millscale placeholder:text-slate-wash/70 focus:border-verdigris focus:outline-none";

const labelClass = "block font-display text-sm font-semibold tracking-tight";

export function LeadForm() {
  // TODO (task 003): replace with a server action that writes to Supabase
  // and returns real success / error states.
  const [submitted, setSubmitted] = useState(false);

  return (
    <form
      className="border border-zinc-dust bg-paper p-6 md:p-8"
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-1">
          <label className={labelClass} htmlFor="trade">
            Your trade
          </label>
          <select id="trade" name="trade" required className={fieldClass}>
            <option value="">Select a trade</option>
            {TRADES.map((trade) => (
              <option key={trade} value={trade}>
                {trade}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-1">
          <label className={labelClass} htmlFor="employee_count">
            People on the crew
          </label>
          <select
            id="employee_count"
            name="employee_count"
            required
            className={fieldClass}
          >
            <option value="">Select a range</option>
            {CREW_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="hiring_client">
            Who&apos;s asking you to register
          </label>
          <input
            id="hiring_client"
            name="hiring_client"
            type="text"
            required
            autoComplete="organization"
            placeholder="The refinery, plant, or GC that sent you the request"
            className={fieldClass}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="email">
            Where to send the list
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@yourcompany.com"
            className={fieldClass}
          />
        </div>
      </div>

      <button
        type="submit"
        className="mt-7 inline-flex w-full items-center justify-center gap-2 bg-verdigris px-6 py-3.5 font-display text-base font-semibold tracking-tight text-paper transition-colors hover:bg-verdigris-deep sm:w-auto"
      >
        Send my gap check
        <ArrowRight aria-hidden="true" strokeWidth={2} className="h-4 w-4" />
      </button>

      <p className="mt-4 font-mono text-xs leading-relaxed text-slate-wash">
        We use this to answer your question and nothing else. No mailing list.
      </p>

      {submitted && (
        <div
          role="status"
          aria-live="polite"
          className="mt-6 flex gap-3 border border-verdigris bg-galvanise p-4"
        >
          <Wrench
            aria-hidden="true"
            strokeWidth={1.5}
            className="mt-0.5 h-5 w-5 shrink-0 text-verdigris"
          />
          <p className="text-sm leading-relaxed">
            Lead capture isn&apos;t connected yet — nothing was sent. {SITE_NAME}{" "}
            is still being built, and this form starts storing submissions in
            the next step.
          </p>
        </div>
      )}
    </form>
  );
}
