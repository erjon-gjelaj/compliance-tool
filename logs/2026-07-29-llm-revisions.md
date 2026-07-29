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

---

# Amendment — the provider is a free tier, not Anthropic

Changed the same day, before merge. The requirement is that revisions cost
nothing to run, because they are promised free to the customer.

`lib/ai/anthropic.ts` is gone and `@anthropic-ai/sdk` is uninstalled. The
replacement is `lib/ai/openai-compatible.ts`, written against the OpenAI
chat-completions shape rather than against a vendor, because every free
provider worth using speaks it. Groq by default; Groq, OpenRouter, Together, a
local llama.cpp or Ollama server are three environment variables apart with no
code change and no deploy.

`lib/ai/model.ts` did not change at all, and `revise-analysis.ts` changed only
in how it phrases the schema. That was the point of the seam, and it held.

Plain `fetch`, no SDK: the protocol is one POST, an SDK would be a dependency
that has to be swapped whenever the provider is, and 063 is a recent reminder
that every dependency is a bundling problem waiting to happen.

## What changes when the model gets weaker

Two things, both handled in code rather than hoped about.

**Schema enforcement is now a hint.** Free providers vary from full
`json_schema` with `strict` to ignoring the field entirely. So the request asks
for JSON, sends the schema as guidance, and treats the reply as untrusted
text. The real contract was always `revisionResultSchema` plus `checkRevision`
plus `validateDocument`, and those are unchanged — which means a weak provider
degrades into "refused more often", never into "bad document accepted". That
property is the only reason a free tier is usable for this at all.

The schema was also restructured from a top-level `anyOf` of two alternatives
into one flat object with a `status` discriminator. Same contract, but root
`anyOf` is the construct providers implement least consistently and the one a
small model most often resolves by emitting fields from both branches at once.

**Replies arrive wrapped.** A strict provider returns bare JSON; free ones
routinely return a markdown fence, or a sentence of preamble, or both.
`extractJson` takes the outermost braced span, with nine tests covering the
cases that a naive `JSON.parse` would have thrown on — turning "answered
correctly, wrapped in a fence" into "revision failed", with a logged reason
blaming the model. Lenient there, strict immediately after.

Expect more clarification questions than a frontier model would produce. That
is the fence working.

## Correction

An earlier draft of the CLAUDE.md note claimed the prompt carries no company
identifiers. That was wrong: `hazcom.ts` interpolates `context.companyName`
into the programme's prose, so the company name travels with the document.
Unavoidable while the document is the thing being edited, but it is the sort
of thing to know rather than discover, and the note now says so.

## Still not verified

No call has been made. There is no `LLM_API_KEY` in this checkout, so the
request shape typechecks and the parsing is tested against canned replies, but
nothing has spoken to a real provider. `LLM_MODEL` has no default on purpose —
free-tier model names churn, and a stale default fails at request time rather
than at boot.
