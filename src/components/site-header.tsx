"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/wordmark";
import { NAV_LINKS, SIGN_IN_LINK } from "@/lib/nav";
import { SESSION_HINT_COOKIE } from "@/lib/auth/cookie-names";
import { signOut } from "@/app/sign-in/actions";
import { SubmitButton } from "@/components/submit-button";

/**
 * Four pages total, so the nav is a flat row that stays visible at every
 * width — no hamburger, no dropdowns. Three short labels fit on a phone.
 *
 * Sits on the dark chrome surface and sticks to the top of the viewport, so
 * it stays legible over whatever scrolls past underneath. `html` carries a
 * matching scroll-padding-top so in-page anchors don't land behind it.
 *
 * Client component for the current-page underline and, now, for the sign
 * in/out swap. Everything else here is static.
 */

/**
 * Shared by the sign in link and the sign out button so a <button> and an <a>
 * sitting side by side in the same row cannot drift apart.
 */
const LINK_CLASS =
  "cursor-pointer text-xs tracking-[0.12em] uppercase text-zinc-dust underline-offset-[6px] transition-colors hover:text-verdigris-pale hover:underline hover:decoration-verdigris-pale";

function hintPresent(): boolean {
  return document.cookie
    .split(";")
    .some((entry) => entry.trim().startsWith(`${SESSION_HINT_COOKIE}=`));
}

/**
 * The cookie jar is an external store, so this reads it as one.
 *
 * useSyncExternalStore rather than useState-plus-useEffect: the cookie is not
 * React state, and setting state from an effect to mirror it is the cascading
 * render this API exists to replace. It also takes the server snapshot as an
 * argument, which is what keeps the prerendered markup and the first client
 * render in agreement.
 *
 * `subscribe` is a no-op because nothing emits an event when a cookie
 * changes. It does not need to: the snapshot is re-read on every render, and
 * the only things that change this cookie — signing in, signing out — both
 * end in a navigation that renders the header again.
 */
function useSignedInHint(): boolean {
  return useSyncExternalStore(
    () => () => {},
    hintPresent,
    // Prerendered HTML cannot know who is asking, so it always says "Sign in"
    // and the client corrects it. A signed-in visitor sees the wrong word for
    // one paint; the alternative is making the whole marketing site dynamic.
    () => false,
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const signedIn = useSignedInHint();

  // The dashboard has its own bar with the account's email and a sign-out
  // beside it, rendered on the server from the real session rather than from
  // a hint. Two sign-out buttons on one page is clutter, and the reliable one
  // should be the one that stays.
  const onDashboard = pathname.startsWith("/dashboard");

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

          {/*
            Set apart by a rule rather than sitting as a fourth peer: the
            three above are for someone deciding, this one is for someone who
            already sent us their paperwork and wants it back.
          */}
          {onDashboard ? null : (
            <li className="border-l border-slate-wash/40 pl-5 sm:pl-7">
              {signedIn ? (
                /*
                  A form and not a link, because signing out changes state and
                  a GET that mutates is something a prefetcher or a scanner can
                  trigger by looking at the page. The button is styled to match
                  the links beside it rather than looking like a control.
                */
                <form action={signOut}>
                  <SubmitButton
                    pendingLabel="Signing out…"
                    className={`inline-flex items-center gap-2 ${LINK_CLASS}`}
                  >
                    Sign out
                  </SubmitButton>
                </form>
              ) : (
                <Link
                  href={SIGN_IN_LINK.href}
                  aria-current={
                    pathname === SIGN_IN_LINK.href ? "page" : undefined
                  }
                  className={
                    pathname === SIGN_IN_LINK.href
                      ? `${LINK_CLASS} text-verdigris-pale underline decoration-verdigris-pale`
                      : LINK_CLASS
                  }
                >
                  {SIGN_IN_LINK.label}
                </Link>
              )}
            </li>
          )}
        </ul>
      </nav>
    </header>
  );
}
