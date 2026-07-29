import { Spinner } from "@/components/spinner";

/**
 * Shown while one submission is being opened.
 *
 * This copy used to live in /dashboard/loading.tsx and cover the whole
 * section, which was true when the dashboard was a list and a detail page.
 * It is a workspace now, so that file is the fallback for Documents,
 * Programs, Company and Help as well, and "Opening your file" described none
 * of them. The wording moved down here to the one route it is actually about.
 *
 * A spinner rather than a skeleton, unlike the requests list: what this route
 * renders depends on what the submission contains — a review panel, uploaded
 * documents, neither — so there is no single shape to hold, and a skeleton
 * that guesses wrong moves the page twice instead of once.
 *
 * It covers a real wait. This route verifies a JWT, queries a submission with
 * its documents, and on a cold serverless function does all of it after a boot.
 */
export default function SubmissionLoading() {
  return (
    <main className="flex max-w-4xl items-center gap-3 py-16">
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
