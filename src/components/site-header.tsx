"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/wordmark";
import { NAV_LINKS } from "@/lib/nav";

/**
 * Four pages total, so the nav is a flat row that stays visible at every
 * width — no hamburger, no dropdowns. Three short labels fit on a phone.
 *
 * Sits on the dark chrome surface and sticks to the top of the viewport, so
 * it stays legible over whatever scrolls past underneath. `html` carries a
 * matching scroll-padding-top so in-page anchors don't land behind it.
 *
 * Client component only for the current-page underline; usePathname is the
 * whole reason. Everything else here is static.
 */
export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="surface-dark sticky top-0 z-50">
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-5"
      >
        <Link href="/" className="transition-colors hover:text-verdigris-pale">
          <Wordmark tone="invert" />
        </Link>

        <ul className="flex items-center gap-5 sm:gap-7">
          {NAV_LINKS.map(({ href, label }) => {
            const isCurrent = pathname === href;
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={isCurrent ? "page" : undefined}
                  className={`text-xs tracking-[0.12em] uppercase underline-offset-[6px] transition-colors hover:text-verdigris-pale hover:underline hover:decoration-verdigris-pale ${
                    isCurrent
                      ? "text-verdigris-pale underline decoration-verdigris-pale"
                      : "text-zinc-dust"
                  }`}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
