import { Spinner } from "@/components/spinner";

/**
 * Shown while the dashboard's server work is in flight.
 *
 * A route-level fallback rather than a spinner on the link that got here,
 * which is what Next's own guidance prefers for a dynamic route: the shell
 * appears immediately and the browser is on the new page while the data is
 * still being fetched, instead of sitting on the old page waiting.
 *
 * It covers a real wait. This route verifies a JWT, queries submissions with
 * their documents, and on a cold serverless function does all of it after a
 * boot.
 *
 * `loading.tsx` applies to /dashboard/[id] as well, since a nested route with
 * no fallback of its own uses the nearest one above it — which is why the copy
 * is about the file in general rather than about the list specifically.
 */
export default function DashboardLoading() {
  return (
    <main className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-16">
      <Spinner className="h-5 w-5 text-verdigris" />
      {/*
        The live region is the announcement; the spinner is aria-hidden, so
        without this a screen reader would be told nothing at all while the
        page is fetching.
      */}
      <p role="status" className="type-body">
        Opening your file&hellip;
      </p>
    </main>
  );
}
