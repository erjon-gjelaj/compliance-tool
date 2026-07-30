"use client";

import { useMemo, useState } from "react";

import { calculateSafetyRates } from "@/lib/parsers/statistics";

export function RateCalculator() {
  const [hours, setHours] = useState("");
  const [recordable, setRecordable] = useState("");
  const [dartCases, setDartCases] = useState("");
  const [lostTime, setLostTime] = useState("");

  const result = useMemo(() => {
    try {
      return {
        value: calculateSafetyRates({
          hoursWorked: Number(hours),
          recordableIncidents: Number(recordable),
          dartCases: Number(dartCases),
          lostTimeCases: Number(lostTime),
        }),
        error: null,
      };
    } catch (error) {
      return {
        value: null,
        error: error instanceof Error ? error.message : "Check the inputs.",
      };
    }
  }, [hours, recordable, dartCases, lostTime]);

  return (
    <section className="border border-zinc-dust bg-paper p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          ["Hours worked", hours, setHours],
          ["Recordable incidents", recordable, setRecordable],
          ["DART cases", dartCases, setDartCases],
          ["Lost-time cases", lostTime, setLostTime],
        ].map(([label, value, setter]) => (
          <label key={label as string} className="text-sm text-millscale">
            {label as string}
            <input
              type="number"
              min="0"
              value={value as string}
              onChange={(event) =>
                (setter as React.Dispatch<React.SetStateAction<string>>)(
                  event.target.value,
                )
              }
              className="mt-1 w-full border border-zinc-dust bg-white px-3 py-2"
            />
          </label>
        ))}
      </div>
      {result.value ? (
        <dl className="mt-6 grid grid-cols-3 gap-3">
          {Object.entries(result.value).map(([label, value]) => (
            <div key={label} className="border border-zinc-dust p-3">
              <dt className="text-xs uppercase text-slate-wash">{label}</dt>
              <dd className="mt-1 text-xl font-semibold text-millscale">
                {value.toFixed(3)}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-5 text-sm text-rust-flag">{result.error}</p>
      )}
    </section>
  );
}
