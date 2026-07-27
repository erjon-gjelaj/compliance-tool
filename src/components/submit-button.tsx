"use client";

import { useFormStatus } from "react-dom";

import { Spinner } from "@/components/spinner";

/**
 * A submit button that knows when its own form is in flight.
 *
 * `useFormStatus` reads the status of the nearest enclosing form, which is
 * why this has to be its own component rather than a few lines inside each
 * page: the hook returns nothing useful when called from the component that
 * renders the <form> itself. That constraint is what makes this worth having
 * — it also means a plain server-rendered page can get a pending state by
 * dropping this in, without becoming a client component itself.
 *
 * Everything here also works with JavaScript off. Without it there is no
 * pending state at all, but the form still posts and the button still submits;
 * the spinner is an enhancement on top of something that already worked.
 */
export function SubmitButton({
  children,
  pendingLabel,
  className,
  icon,
}: {
  children: React.ReactNode;
  /**
   * What to say while it is in flight. Required rather than optional: the
   * label change is what a screen reader announces, and the spinner is
   * aria-hidden precisely because this is doing that job.
   */
  pendingLabel: string;
  className?: string;
  /** Shown only at rest, so it never sits next to the spinner. */
  icon?: React.ReactNode;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : children}
      {pending ? <Spinner /> : icon}
    </button>
  );
}
