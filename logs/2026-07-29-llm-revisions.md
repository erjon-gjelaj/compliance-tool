# Task 065 — revisions, read by a model

## The decision

The project's "No language models" rule was reversed, deliberately and on the
record, for exactly one use: reading a revision request. Every other path —
text extraction, the gap analysis, the review — stays deterministic and is
explicitly still closed to a model. `CLAUDE.md` now says so in those terms,
including why, so the reversal reads as a bounded decision rather than as
permission.

The reason it was the right call here: 064 established that acting on a free
text revision request cannot be done deterministically. A text search cannot
tell what "please remove the responsibilities section" means. The honest
options were a person, nothing, or a model — not "a harder deterministic
version we hadn't written yet".

## What was actually built

The user's spec, with the two problems I flagged before starting resolved
rather than skipped.

**The storage model changed, because it had to.** A document used to be a pure
function of `(template, answers, context)` — nothing persisted the sections,
because they could always be rebuilt. A model-edited document breaks that: the
next revision would start from `answers`, rebuild, and silently discard the
edit. Migration 0010 stores `sections` on every version, plus `source`
(`assembled` / `revised`), `revision_summary`, and `revised_by_model` so a bad
revision traces to a model and a date rather than to "the AI".

**Schema validation is not the fidelity check it reads like.** The spec said
validate against the existing schema before saving, which is done — but
`validateDocument` catches placeholders, empty sections and duplicate
headings. It cannot see that the model rewrote four sections nobody mentioned
or grew a CFR citation. So there are three gates, and none subsumes the others:

1. the API's JSON Schema — shape only
2. `checkRevision` — at most one section changed, none added, no citation
   introduced anywhere, document not emptied
3. `validateDocument` — the same gate every assembled document passes

Nothing is written unless all three pass. A refused revision leaves the
existing version exactly as it was.

`sourceRef` is the detail I am most glad of. It maps each section to the
element of a regulation it covers. The model never sees it and one is never
accepted back — it is re-attached from the original by heading. A model
inventing a `sourceRef` would be inventing a regulatory mapping, and it would
look exactly like a real one.

## Modularity

`lib/ai/model.ts` is the entire seam: system prompt, user prompt, JSON Schema
in; parsed JSON out. No messages, no tools, no streaming, no vendor concepts.
Swapping model or vendor is `lib/ai/anthropic.ts` plus one line. The interface
never throws — a model is a network call to someone else's computer, and the
caller has something better to do with a failure than propagate it out of a
server action.

Claude Haiku 4.5, as asked: cheapest current model that supports structured
outputs, which the whole design rests on. Streaming, despite nothing being
streamed to the browser — a revised programme runs to tens of thousands of
output tokens and a non-streaming request that size risks an SDK timeout where
the answer arrives after the connection has gone.

The JSON Schema is hand-written rather than generated from the zod types. The
SDK's zod helper targets zod 3 and this project is on zod 4, and the output has
to be re-validated with zod on the way in regardless — the API guarantees
shape, not truthfulness. One hand-written schema is a smaller liability than a
version-pinned helper plus a second validation pass that can disagree with it.

## Tests

Seventeen, nearly all negative, against a stub model — no network, so they are
deterministic, which is what the original rule was protecting. Every refusal
case is a reply that satisfies the JSON Schema perfectly and must still be
rejected: the over-broad rewrite, the helpful extra section, the citation
introduced in a table cell, the invented `sourceRef`, the summary-less change.
Two guard against false positives — a citation the document already had is not
"introduced", and one removed section is allowed.

## Not verified

**No call has ever been made to the API.** There is no `ANTHROPIC_API_KEY` in
this checkout, so the request shape — `output_config.format` with a
`json_schema`, on Haiku 4.5, streaming — is written from the current API
reference and typechecks against the SDK, but has not been exercised once. The
first real revision is the first test of it. If the shape is wrong it will fail
closed (`model_error`, no version written), which is the right direction, but
it will fail.

Also unverified: the three-state form was not seen rendering. Browser pane
still not displayed, and the flow needs a signed-in session, a generated
document, and a working model call — none available here.

The migration has not been run. `0010_revised_documents.sql` needs applying in
the Supabase SQL editor before the first revision, or the insert fails on
unknown columns.
