import { Spinner } from "@/components/spinner";

/**
 * The fallback for the workspace and anything under it without one of its own.
 *
 * Next uses the nearest `loading.tsx` above a route, so this file is what
 * Documents, Programs, Company and Help show while they fetch — which is why
 * the copy is about the workspace in general. It used to say "Opening your
 * file", from when /dashboard was a list of submissions and its only child
 * was one submission; that wording now lives in [id]/loading.tsx, the one
 * route it describes.
 *
 * The outer padding is gone as well. This predates the workspace chrome, and
 * `mx-auto max-w-4xl px-6` on top of the layout's own centred, padded column
 * indented the spinner further than the content it stood in for — the page
 * visibly stepped left when it loaded.
 */
export default function DashboardLoading() {
  return (
    <main className="flex items-center gap-3 py-16">
      <Spinner className="h-5 w-5 text-verdigris" />
      {/*
        The live region is the announcement; the spinner is aria-hidden, so
        without this a screen reader would be told nothing at all while the
        page is fetching.
      */}
      <p role="status" className="type-body">
        Loading&hellip;
      </p>
    </main>
  );
}
