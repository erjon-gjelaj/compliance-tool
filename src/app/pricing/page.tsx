import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";

import { pageMetadata } from "@/lib/metadata";
import { PageIntro } from "@/components/page-intro";
import {
  FREE_INCLUDES,
  PROGRAMS_PRODUCT,
  formatPrice,
  programCount,
} from "@/lib/billing/catalog";

export const metadata: Metadata = pageMetadata({
  title: "Pricing",
  description:
    "Gap checks are free. Every written safety program, prepared in your " +
    "company's name, is a single one-off payment.",
  path: "/pricing",
});

/**
 * The pricing page.
 *
 * Two columns, because there are two things: a free half and a paid half.
 * Every figure comes from lib/billing/catalog, which is the same constant
 * Stripe charges — a page that quotes a price the checkout does not honour is
 * the one mistake a pricing page cannot make.
 *
 * The page used to explain that there was no checkout, that a person would
 * reply, and that invoices were sent by hand. All three were true and none of
 * them is now.
 */
export default function PricingPage() {
  const price = formatPrice(PROGRAMS_PRODUCT);

  return (
    <main className="flex-1">
      <PageIntro tag="Pricing" tickId="tick-pricing" title="What this costs">
        <p>
          Find out what your file is missing for nothing. If you want the
          programs written, it is one payment for all of them &mdash; no
          subscription, no per-document charge, no waiting on a quote.
        </p>
      </PageIntro>

      <section aria-labelledby="plans-heading" className="border-b border-zinc-dust">
        <h2 id="plans-heading" className="sr-only">
          What is free and what is paid
        </h2>

        <div className="mx-auto max-w-5xl px-6 py-14 md:py-16">
          <div className="grid gap-px border border-zinc-dust bg-zinc-dust md:grid-cols-2">
            {/* Free */}
            <div className="bg-paper p-8">
              <p className="tag">Free</p>
              <p className="type-h2 mt-3 text-millscale">$0</p>
              <p className="type-body mt-3">
                No card, no account to create. Enough to find out exactly where
                you stand.
              </p>

              <ul className="mt-6 grid gap-2.5">
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

              <Link href="/gap-check" className="btn-secondary mt-8 inline-block">
                Check my file free
              </Link>
            </div>

            {/* Paid */}
            <div className="bg-paper p-8">
              <p className="tag">{PROGRAMS_PRODUCT.name}</p>
              <p className="type-h2 mt-3 text-millscale">
                {price}{" "}
                <span className="type-body font-normal text-slate-wash">once</span>
              </p>
              <p className="type-body mt-3">{PROGRAMS_PRODUCT.summary}</p>
              {/*
                Read from the registry rather than written down, so the page
                cannot undersell the library the day a program is added.
              */}
              <p className="mt-2 text-sm text-slate-wash">
                {programCount()} programs today, and every one we add after.
              </p>

              <ul className="mt-6 grid gap-2.5">
                {PROGRAMS_PRODUCT.includes.map((item) => (
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

              {/*
                The gap check first, deliberately. Buying requires an account,
                an account comes from a gap check, and the gap check is also
                how somebody finds out whether they need any of this — sending
                a stranger straight to a card form would convert worse and
                deserve to.
              */}
              <Link href="/gap-check" className="btn-primary mt-8 inline-block">
                Start free, unlock when you need it
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="how-heading">
        <div className="mx-auto max-w-5xl px-6 py-14 md:py-16">
          <h2 id="how-heading" className="type-h2 max-w-2xl">
            How it works
          </h2>

          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            <li>
              <p className="type-label text-millscale">Send what you have</p>
              <p className="type-body mt-2">
                Your trade, who is asking, and whatever paperwork you already
                hold. You get a plain list of what your file looks short on,
                free, in a couple of minutes.
              </p>
            </li>
            <li>
              <p className="type-label text-millscale">Unlock the programs</p>
              <p className="type-body mt-2">
                One payment by card, {price}. It covers every program we
                prepare, not one of them, and there is nothing recurring.
              </p>
            </li>
            <li>
              <p className="type-label text-millscale">Answer and download</p>
              <p className="type-body mt-2">
                Seven short questions about how you actually work, then the
                document is built in your company&rsquo;s name. Word and PDF,
                straight away.
              </p>
            </li>
          </ol>

          <p className="type-body mt-10 max-w-2xl border-l-2 border-verdigris pl-4">
            A gap check is an automated review of what you sent us, not a
            certified audit, and what a particular hiring client accepts is
            between you and them. Everything it tells you points at the file
            and the wording it came from, so you can check it yourself.
          </p>
        </div>
      </section>
    </main>
  );
}
