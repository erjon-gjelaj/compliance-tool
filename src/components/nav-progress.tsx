"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { startsNavigation } from "@/lib/nav-intent";

/**
 * The thin bar across the top of the page during a route transition.
 *
 * Every page under /dashboard is `force-dynamic` and reads live rows, so a
 * navigation is a real server round trip — long enough that without this the
 * only feedback is the link staying where it is. A route's `loading.tsx`
 * covers the wait once the new route is on screen; this covers the gap before
 * that, which is the part that reads as a dead click.
 *
 * Four decisions worth keeping:
 *
 * It is written here rather than pulled in. nprogress is jQuery-era, ships its
 * own stylesheet, and would still have to be wrapped in exactly this component
 * to hear about App Router navigations — the wrapper is the work, and the bar
 * itself is a div and a transform transition.
 *
 * Nothing appears for the first 200ms. A prefetched route often commits well
 * inside that, and a bar that flashes on every click is worse than no bar: it
 * makes instant navigation look like it struggled.
 *
 * The fill is one transition to 90% over eight seconds on a steep ease-out,
 * not a timer stepping a number. It moves quickly and then crawls, which is
 * the honest shape — we do not know how long the server will take, and the
 * bar must never arrive before the page does. It also means no rAF loop and
 * no re-render while a navigation is in flight; the whole animation is three
 * state changes and the compositor.
 *
 * The element is always mounted and animated by class. A bar mounted at the
 * moment it becomes visible has no previous style to transition from, so its
 * first frame is already at the destination — the fill only exists because
 * there is an element sitting at zero for it to grow out of.
 */

// Long enough that a prefetched navigation never shows a bar at all.
const APPEAR_AFTER_MS = 200;
// Fill to 100%, then fade. Both halves of `.is-complete` in globals.css.
const COMPLETE_MS = 400;
/*
 * A navigation that never commits still has to release the bar. This is the
 * backstop for a cancelled transition, a failed fetch, or a click we judged to
 * be a navigation that turned out not to be one. Eight seconds is past any
 * navigation worth waiting for and short of leaving a stuck bar on screen.
 */
const GIVE_UP_AFTER_MS = 8000;

type Phase = "idle" | "running" | "complete";

function NavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [phase, setPhase] = useState<Phase>("idle");

  /*
   * Timers and the in-flight flag live in refs, not state. Each has to be
   * readable and cancellable from an event handler that must not re-render to
   * do it — a second click during a navigation adjusts timers and changes
   * nothing on screen.
   */
  const appearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const giveUpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** True from the click until the new route is on screen. */
  const navigating = useRef(false);
  /** Whether the 200ms delay elapsed and the bar is actually on screen. */
  const shown = useRef(false);

  const clearTimers = useCallback(() => {
    for (const timer of [appearTimer, giveUpTimer, resetTimer]) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  /** Fill to the end, then put the bar back to zero. */
  const finish = useCallback(() => {
    if (!navigating.current) return;
    navigating.current = false;
    clearTimers();

    // The navigation beat the delay and nothing was ever drawn. Staying idle
    // is the point of the delay — completing here is the flicker itself.
    if (!shown.current) return;

    shown.current = false;
    setPhase("complete");
    resetTimer.current = setTimeout(() => setPhase("idle"), COMPLETE_MS);
  }, [clearTimers]);

  const begin = useCallback(() => {
    /*
     * Concurrent navigations share one bar. Clicking a second link while the
     * first is in flight must not restart the fill from zero — from the
     * user's side it is one continuous wait, and the router will only deliver
     * the last destination anyway.
     */
    if (navigating.current) return;
    navigating.current = true;
    clearTimers();

    appearTimer.current = setTimeout(() => {
      shown.current = true;
      setPhase("running");
    }, APPEAR_AFTER_MS);
    giveUpTimer.current = setTimeout(finish, GIVE_UP_AFTER_MS);
  }, [clearTimers, finish]);

  /*
   * The start of a navigation. The App Router publishes no such event —
   * `usePathname` changes when the new route commits, which is the end of the
   * wait — so the click is the only signal available before it begins.
   * Capture phase, so a component that stops propagation on its own links
   * cannot silently switch the bar off.
   */
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!anchor) return;

      const started = startsNavigation(
        {
          href: anchor.getAttribute("href"),
          target: anchor.getAttribute("target"),
          download: anchor.hasAttribute("download"),
          hasModifier:
            event.metaKey || event.ctrlKey || event.shiftKey || event.altKey,
          button: event.button,
          defaultPrevented: event.defaultPrevented,
        },
        window.location.href,
      );

      if (started) begin();
    }

    // Back and forward are navigations too, and they arrive without a click.
    function onPopState() {
      begin();
    }

    document.addEventListener("click", onClick, { capture: true });
    window.addEventListener("popstate", onPopState);

    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener("popstate", onPopState);
    };
  }, [begin]);

  /*
   * The end. The new route has rendered by the time these change, so the bar
   * completes against a page that is on screen rather than a promise of one.
   *
   * The search params are watched as well as the path, because a filter
   * applied in place is a full server render on these routes and leaves the
   * path alone — on pathname only, that bar would run until it gave up.
   */
  useEffect(() => {
    finish();
  }, [pathname, searchParams, finish]);

  // Timers must not outlive the component, even though this one never unmounts.
  useEffect(() => clearTimers, [clearTimers]);

  return (
    /*
     * aria-hidden for the same reason as the spinner: the announcement comes
     * from the route's own loading state, and a progress bar narrating the
     * same wait would say it twice.
     */
    <div aria-hidden className="nav-progress">
      <div
        className={`nav-progress-bar${phase === "idle" ? "" : ` is-${phase}`}`}
      />
    </div>
  );
}

/**
 * `useSearchParams` opts a client component into client rendering, which
 * without a boundary would take the static marketing pages with it. The
 * Suspense wrapper is the documented containment, and it costs nothing here:
 * the fallback is an element that draws nothing anyway.
 */
export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressBar />
    </Suspense>
  );
}
