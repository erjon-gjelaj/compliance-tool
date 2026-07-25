"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/wordmark";
import { NAV_LINKS } from "@/lib/nav";

/**
 * Four pages total, so the nav is a flat row that stays visible at every
 * width — no hamburger, no dropdowns. Three short labels fit on a phone.
 *
 * Client component only for the current-page underline; usePathname is the
 * whole reason. Everything else here is static.
 */
export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-zinc-dust">
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-5"
      >
        <Link href="/" className="transition-colors hover:text-verdigris">
          <Wordmark />
        </Link>

        <ul className="flex items-center gap-5 sm:gap-7">
          {NAV_LINKS.map(({ href, label }) => {
            const isCurrent = pathname === href;
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={isCurrent ? "page" : undefined}
                  className={`text-xs tracking-[0.12em] uppercase underline-offset-[6px] transition-colors hover:text-verdigris hover:underline hover:decoration-verdigris ${
                    isCurrent
                      ? "text-verdigris underline decoration-verdigris"
                      : "text-slate-wash"
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
