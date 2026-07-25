import { SITE_NAME } from "@/lib/constants";

/**
 * Wordmark: a crop of the tape-measure rule used elsewhere on the page,
 * standing in as the mark — a baseline with two major ticks and two
 * minor ones between, the way a steel tape graduates.
 *
 * Kept name-agnostic on purpose — the working name may change.
 */
export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 24 24"
        className="h-6 w-6 text-verdigris"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="butt"
      >
        <line x1="2" y1="8" x2="22" y2="8" />
        <line x1="3" y1="8" x2="3" y2="17" />
        <line x1="9" y1="8" x2="9" y2="13" />
        <line x1="15" y1="8" x2="15" y2="13" />
        <line x1="21" y1="8" x2="21" y2="17" />
      </svg>
      <span className="font-display text-xl font-semibold tracking-tight">
        {SITE_NAME}
      </span>
    </span>
  );
}
