/**
 * Shown while the requests list is being read.
 *
 * There was no fallback of its own here, so this route fell through to
 * /dashboard/loading.tsx; a centred spinner reading "Opening your file…",
 * which is the copy for a submission and describes nothing that happens on
 * this page. In the gap the workspace chrome stayed put and the content area
 * emptied, which reads less like loading than like a page that broke.
 *
 * A skeleton rather than a spinner, because unlike the dashboard shell this
 * screen is one list of one known row shape. Holding that shape means the
 * heading lands in its final position and the rows arrive in place instead of
 * pushing the page down as they replace a spinner; the wait looks like the
 * page filling in rather than the page changing its mind.
 *
 * Three rows is a deliberate lie of a useful kind: it is the shape of the
 * content, not a claim about how much there is. Matching it to the real count
 * is not possible before the query that this is covering.
 */
function RowSkeleton() {
  return (
    <li className="flex items-start justify-between gap-4 border border-zinc-dust bg-paper p-5">
      <div className="min-w-0 flex-1">
        {/*
          Heights are the line boxes of the text they stand in for, not
          round numbers: type-label at 0.9375rem/1.4 is 21px, the activity
          line at text-sm is 20px, and `mt-1` is the real gap between them.
          Eyeballed values left each row 7px short, which is a row of shift
          on arrival; small, and precisely what a skeleton is for.
        */}
        <div className="skeleton h-[21px] w-48 max-w-full" />
        <div className="skeleton mt-1 h-5 w-32 max-w-full" />
      </div>
      {/* Status chip and chevron. */}
      <div className="skeleton h-6 w-24 shrink-0" />
    </li>
  );
}

export default function RequestsLoading() {
  return (
    <main className="max-w-3xl">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        {/*
          The heading is real text rather than a grey block. It is known
          before the query and it is what tells somebody the click worked, so
          skeletoning it would be withholding the one thing already available.
        */}
        <h1 className="type-h2 text-millscale">Requests</h1>
      </div>

      {/*
        The live region carries the announcement. The skeleton is decorative
        and invisible to a screen reader, so without this the page would
        change and say nothing at all.
      */}
      <p role="status" className="sr-only">
        Loading your requests&hellip;
      </p>

      <ul aria-hidden className="mt-8 grid gap-3">
        <RowSkeleton />
        <RowSkeleton />
        <RowSkeleton />
      </ul>
    </main>
  );
}
