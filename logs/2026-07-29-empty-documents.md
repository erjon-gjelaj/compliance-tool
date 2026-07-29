# Task 064 — the document that said Ready and answered 404

## What was reported

`/dashboard/documents/[id]` returned 404 — for a document that was listed, in
the customer's own archive, under a green "Ready" chip.

## What was actually wrong

This is the tail of 063 rather than a separate fault.

`generateVersion` writes the `generated_documents` row before rendering the
files, because the version rows need something to hang off. The version row is
written last, only after both files render and upload. So a failure between
those two writes leaves a document row with no version — a library entry with
nothing in it. The pdfkit bug put every generation on that path for days.

Nothing checked for it, and three screens then disagreed about what that row
meant:

- The archive rendered `Version {entry.current?.version ?? 1} · ready to
  download` with a "Ready" chip. The `?? 1` invented a version number for a
  document that had none.
- The programs page counted the row as proof the program was already prepared,
  replaced "generate this" with "Ready", and pointed at the same URL. That was
  the worst part: the one route back to generating the document was gone, so
  the customer was locked out of it entirely.
- The detail page checked `!document?.current` and answered 404, which was the
  only one of the three telling the truth.

Both screens made the same mistake in the same shape, which is the tell that
the type was wrong rather than the pages.

## The fix

`listDocumentsForEmail` drops rows with no version, and
`DocumentWithVersions.current` becomes `VersionRow` instead of `VersionRow |
null`. The filter is what makes the narrowing honest, and the narrowing is
what stops this coming back: `entry.current?.version ?? 1` no longer compiles.
One change in the reader every screen goes through, rather than a guard added
to each page.

Dropping rather than displaying them is deliberate. An empty row records that
our rendering broke — not anything the customer did, and nothing they can act
on. The honest repair is to generate the program, which they can now do again.

The mapping moved into an exported `toDocuments()` so it could be tested
without a database; the store has never had a Supabase mock and this did not
seem the moment to build one.

## No data cleanup needed

`generateVersion` looks up the existing document row by email and program id
and reuses it. So an orphaned row is picked up by the next successful
generation and finally gets its version — the row heals rather than needing to
be deleted. Since the programs page now offers the program again, the customer
walks the same path they would have anyway.

## Tests

Seven, in `documents.test.mts`, mostly negative. Checked by commenting out the
guard: three fail, including the one asserting a failed generation leaves its
program free to be generated again.

The comments in this file were part of the problem, so two were corrected. The
header claimed the row is written only after both files render — true of the
version row, false of the document row, and the gap between those is the bug.
It now says which row it means and what depends on the filter.

## Not verified

Same gap as 062: the browser pane was not displayed, so no screenshots and no
runtime check of the three pages. There are no Supabase credentials in this
checkout either, so the query path could not be exercised at all — only the
pure mapping, which is why it was extracted. Worth loading the documents page
against real data once before trusting this.
