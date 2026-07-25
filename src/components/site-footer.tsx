import Link from "next/link";
import { TickRule } from "@/components/tick-rule";
import { Wordmark } from "@/components/wordmark";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/constants";
import { GAP_CHECK_HREF, LEGAL_LINKS, NAV_LINKS } from "@/lib/nav";

/*
 * Baked at build time, since every page here is static. That means the year
 * only advances on the next deploy — fine for a site that redeploys on push,
 * and the alternative (reading the clock in the browser) costs a hydration
 * mismatch and a client bundle for one number.
 */
const YEAR = new Date().getFullYear();

export function SiteFooter() {
  return (
    <footer className="surface-dark">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="grid gap-10 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] sm:gap-14">
          <div>
            <Wordmark tone="invert" />
            <p className="mt-5 max-w-md text-sm leading-relaxed text-zinc-dust">
              {SITE_NAME} is an independent service and is not affiliated with,
              endorsed by, or acting on behalf of ISNetworld, Avetta, or any
              hiring client. A gap check is guidance to help you prepare your
              own submission, not a compliance determination.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <h2 className="tag">Pages</h2>
              <ul className="mt-4 space-y-2.5 text-sm">
                {[...NAV_LINKS, ...LEGAL_LINKS].map(({ href, label }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="text-zinc-dust underline decoration-slate-wash underline-offset-4 transition-colors hover:text-verdigris-pale hover:decoration-verdigris-pale"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link
                    href={GAP_CHECK_HREF}
                    className="text-zinc-dust underline decoration-slate-wash underline-offset-4 transition-colors hover:text-verdigris-pale hover:decoration-verdigris-pale"
                  >
                    Free gap check
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h2 className="tag">Contact</h2>
              <ul className="mt-4 space-y-2.5 text-sm text-zinc-dust">
                <li>
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="text-verdigris-pale underline decoration-slate-wash underline-offset-4 transition-colors hover:decoration-verdigris-pale"
                  >
                    {CONTACT_EMAIL}
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <TickRule id="tick-footer" className="mt-12 text-slate-wash" />

        <p className="mt-5 text-xs text-zinc-dust">
          &copy; {YEAR} {SITE_NAME}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
