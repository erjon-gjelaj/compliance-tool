import { SITE_NAME } from "@/lib/constants";

/**
 * Wordmark: a stamped inspection ring with an open segment, next to the
 * site name. Kept name-agnostic on purpose — the working name may change.
 */
export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 24 24"
        className="h-6 w-6 text-verdigris"
      >
        <path
          d="M12 3.5a8.5 8.5 0 1 1-6.01 2.49"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="square"
        />
        <path
          d="M8.5 12.2l2.6 2.6 4.6-5.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="square"
        />
      </svg>
      <span className="font-display text-xl font-semibold tracking-tight">
        {SITE_NAME}
      </span>
    </span>
  );
}
