import Link from "next/link";
import { PageIntro } from "@/components/page-intro";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/constants";
import { GAP_CHECK_HREF, NAV_LINKS } from "@/lib/nav";

/*
 * The root not-found file catches every unmatched URL for the whole site,
 * not just an explicit notFound() call, so this is the 404 page.
 *
 * It renders inside the root layout, which means it gets the same header and
 * footer as everything else — the point being that someone who mistypes a URL
 * lands somewhere that plainly belongs to this site rather than on the
 * framework's default page, which ships its own styles and follows the
 * visitor's dark-mode setting.
 *
 * No metadata export: Next only supports that on the experimental
 * global-not-found convention, so the title falls back to the layout default.
 * The noindex tag is injected automatically for anything returning 404.
 */
export default function NotFound() {
  return (
    <main className="flex-1">
      <PageIntro
        tag="404"
        tickId="tick-404"
        title="That page isn't here"
      >
        <p>
          The address is either mistyped or points at something that has moved.
          Nothing you have already sent us is affected — if you submitted a gap
          check, it is safe and a person will still get to it.
        </p>
      </PageIntro>

      <section aria-labelledby="not-found-next" className="border-b border-zinc-dust">
        <div className="mx-auto max-w-5xl px-6 py-14 md:py-16">
          <h2 id="not-found-next" className="type-h2 max-w-2xl">
            Where you probably meant to go
          </h2>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href={GAP_CHECK_HREF} className="btn-primary">
              Get your free gap check
            </Link>
            <span className="text-xs text-slate-wash">
              Four questions. No account, no card.
            </span>
          </div>

          <ul className="mt-10 max-w-2xl divide-y divide-zinc-dust border-y border-zinc-dust">
            {NAV_LINKS.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="flex items-baseline gap-4 py-4 transition-colors hover:text-verdigris"
                >
                  <span className="tag w-16 shrink-0">{label}</span>
                  <span className="type-body">{DESCRIPTIONS[href]}</span>
                </Link>
              </li>
            ))}
          </ul>

          <p className="type-body mt-10 max-w-2xl">
            If you followed a link on {SITE_NAME} to get here, it is our
            mistake and worth telling us about —{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-verdigris underline decoration-zinc-dust underline-offset-4 transition-colors hover:decoration-verdigris"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </div>
      </section>
    </main>
  );
}

/*
 * Keyed by href so this stays tied to NAV_LINKS rather than repeating the
 * list. A page added to the nav without a line here renders the label alone,
 * which is untidy but not broken — and TypeScript flags the gap.
 */
const DESCRIPTIONS: Record<(typeof NAV_LINKS)[number]["href"], string> = {
  "/about": "What a gap check covers, and what it deliberately doesn't.",
  "/faq": "Cost, turnaround, and what happens to what you send us.",
  "/contact": "One email address, and what to put in the message.",
};
