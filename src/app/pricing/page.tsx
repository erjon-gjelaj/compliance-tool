import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";

import { pageMetadata } from "@/lib/metadata";
import { PageIntro } from "@/components/page-intro";
import { SITE_NAME } from "@/lib/constants";
import {
  FREE_INCLUDES,
  MAINTENANCE_PLAN,
  ONE_TIME_SERVICES,
  PRICING_NOTE,
  formatMoney,
} from "@/lib/pricing";

export const metadata: Metadata = pageMetadata({
  title: "Pricing",
  description:
    "What is free, what is paid, and roughly what it costs. Ranges rather " +
    "than quotes, confirmed before any work starts.",
  path: "/pricing",
});

/**
 * The pricing page.
 *
 * Every number comes from lib/pricing so a change is one edit, and every one
 * is shown as a range under an early-access label — because they are
 * assumptions, and a single figure would read as a quote.
 *
 * There is no checkout here and no button that implies one. Payment is not
 * connected, so every action leads to asking, and says so.
 */
export default function PricingPage() {
  return (
    <main className="flex-1">
      <PageIntro tag="Pricing" tickId="tick-pricing" title="What this costs">
        <p>
          The gap check is free and stays free. Paid work is the part a person
          does: writing the programs you are missing, or sorting out a rejection
          with you.
        </p>
      </PageIntro>

      <section aria-labelledby="free-heading" className="border-b border-zinc-dust">
        <div className="mx-auto max-w-5xl px-6 py-14 md:py-16">
          <div className="grid gap-10 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:gap-16">
            <div>
              <p className="tag">Free</p>
              <h2 id="free-heading" className="type-h2 mt-3">
                No card, no account to create
              </h2>
              <p className="type-body mt-4">
                Enough to find out where you actually stand. Most people never
                need more than this.
              </p>
              <Link href="/" className="btn-primary mt-6 inline-block">
                Start a gap check
              </Link>
            </div>

            <ul className="grid gap-2.5 self-start">
              {FREE_INCLUDES.map((item) => (
                <li key={item} className="flex gap-3">
                  <Check
                    aria-hidden
                    strokeWidth={1.5}
                    className="mt-0.5 h-4 w-4 shrink-0 text-verdigris"
                  />
                  <span className="type-body">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="paid-heading" className="border-b border-zinc-dust">
        <div className="mx-auto max-w-5xl px-6 py-14 md:py-16">
          <p className="tag">Paid, one job at a time</p>
          <h2 id="paid-heading" className="type-h2 mt-3 max-w-2xl">
            Pay for the thing you need, not a subscription
          </h2>
          <p className="type-body mt-4 max-w-2xl">
            Most people arrive with one problem, get it sorted, and do not need
            us again for months. That should not cost a monthly plan.
          </p>

          <ul className="mt-10 grid gap-px border border-zinc-dust bg-zinc-dust md:grid-cols-3">
            {ONE_TIME_SERVICES.map((offer) => (
              <li key={offer.id} className="bg-paper p-6">
                <p className="type-label text-millscale">{offer.name}</p>
                <p className="type-h3 mt-3 text-millscale">
                  {formatMoney(offer.price)}
                </p>
                <p className="type-body mt-3">{offer.summary}</p>
              </li>
            ))}
          </ul>

          <div className="mt-8 border border-zinc-dust bg-paper p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <p className="type-label text-millscale">{MAINTENANCE_PLAN.name}</p>
              <p className="type-h3 text-millscale">
                {formatMoney(MAINTENANCE_PLAN.price)}
                <span className="type-body"> a {MAINTENANCE_PLAN.per}</span>
              </p>
            </div>
            <p className="type-body mt-3 max-w-2xl">
              {MAINTENANCE_PLAN.summary} For companies that have to stay current
              across several hiring clients rather than get current once.
            </p>
          </div>

          <p className="type-body mt-8 max-w-2xl border-l-2 border-verdigris pl-4">
            {PRICING_NOTE}
          </p>
        </div>
      </section>

      <section aria-labelledby="how-heading">
        <div className="mx-auto max-w-5xl px-6 py-14 md:py-16">
          <h2 id="how-heading" className="type-h2 max-w-2xl">
            How paying actually works right now
          </h2>
          <p className="type-body mt-4 max-w-2xl">
            There is no checkout on this site yet. You ask for what you need,
            we reply with what it involves and what it will cost, and we agree
            it before anything starts. If that turns out not to be worth it to
            you, nothing has happened.
          </p>
          <p className="type-body mt-4 max-w-2xl">
            Card payment is coming. Until it is, {SITE_NAME} invoices you
            directly for work you have already agreed to.
          </p>
          <Link href="/dashboard/help" className="btn-primary mt-6 inline-block">
            Ask what something would cost
          </Link>
        </div>
      </section>
    </main>
  );
}
