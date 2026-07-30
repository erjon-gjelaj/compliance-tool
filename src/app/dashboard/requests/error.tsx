"use client";

import { useEffect } from "react";
import { RotateCw, TriangleAlert } from "lucide-react";

/**
 * Shown when the requests list could not be read.
 *
 * This route used to have no error state and could not have used one: the
 * store swallowed a failed query and returned an empty array, so a database
 * outage rendered as "No requests yet"; a calm, confident, wrong answer, and
 * the worst thing this page could tell somebody with work in flight. The
 * store's throwing variant exists to reach this file.
 *
 * `reset()` re-runs the server component. That is the right retry for what
 * actually goes wrong here; a dropped connection, a cold database, a
 * timeout; none of which need a full reload to clear, and a reload would
 * cost the whole workspace shell to retry one query.
 *
 * The copy does not guess at a cause. We know the list could not be read and
 * we do not know why, so it says that and stops. What it does say plainly is
 * that the requests still exist, because the fear this screen creates is that
 * they do not.
 */
export default function RequestsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The server logs the throw; this is the client half, and the digest is
    // what ties the two together in Vercel's logs.
    console.error("Requests page failed to render", error);
  }, [error]);

  return (
    <main className="max-w-3xl">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="type-h2 text-millscale">Requests</h1>
      </div>

      {/*
        The same card as the empty state; border, paper, p-8, icon above the
        heading. The four states of this page are meant to be recognisably the
        same page, so what changes between them is the icon's colour and the
        words, not the layout.
      */}
      <div role="alert" className="mt-8 border border-zinc-dust bg-paper p-8">
        <TriangleAlert aria-hidden className="mb-4 h-5 w-5 text-rust-flag" />
        <h2 className="type-h3 text-millscale">We couldn&rsquo;t load your requests</h2>
        <p className="type-body mt-3 max-w-xl">
          Something went wrong reading them just now. Nothing has been lost
          &mdash; your requests and everything said about them are still there.
          Try again, and if it keeps happening, email us and we&rsquo;ll sort
          it out.
        </p>

        <button
          type="button"
          onClick={reset}
          className="btn-primary mt-6 cursor-pointer"
        >
          <RotateCw aria-hidden className="h-4 w-4" />
          Try again
        </button>

        {/*
          The digest is the only thing that makes a support email actionable,
          and it is not always present; Next only attaches one to errors
          thrown on the server.
        */}
        {error.digest ? (
          <p className="tag mt-4">Reference {error.digest}</p>
        ) : null}
      </div>
    </main>
  );
}
