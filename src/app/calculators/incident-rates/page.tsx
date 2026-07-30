import { RateCalculator } from "@/components/rate-calculator";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "TRIR, DART and LTIR calculator",
  description:
    "Calculate incident rates from hours worked and case counts without estimating a platform grade.",
  path: "/calculators/incident-rates",
});

export default function IncidentRatesPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <p className="tag">Free calculator</p>
      <h1 className="type-h1 mt-3 text-millscale">
        TRIR, DART and LTIR calculator
      </h1>
      <p className="type-lede mt-5 max-w-3xl">
        Enter the figures from your records. This performs the arithmetic; it
        does not determine compliance or predict a client decision.
      </p>
      <div className="mt-8">
        <RateCalculator />
      </div>
    </main>
  );
}
