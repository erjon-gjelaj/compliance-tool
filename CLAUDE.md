# Project: CertLoop (working name — may still change)

## What this is
A landing page and intake tool that helps small industrial subcontractors
figure out what safety compliance paperwork they're missing for
ISNetworld/Avetta prequalification. Read `business-model.md` for full
context on the problem, audience, and positioning before writing any copy.

Scope A is finished and deployed: a real, SEO-indexable landing page with
working lead capture, on certloop.net.

We are now on SCOPE B. A submitted intake produces an automated, emailed
preliminary gap analysis, and captures enough information to quote an
indicative price. This deliberately supersedes the earlier "no gap-checking
logic, no smart compliance logic" rule — that restriction no longer applies.
See "Scope B" below for what it does and does not permit.

There is no prior mockup to follow for design — build the page fresh
based on business-model.md and the Visual identity section below.

## Scope B
In scope:
- A multi-step intake form (trade/client/platform/deadline, company profile,
  a document checklist, optional uploads plus contact details). Every step
  after the first is skippable and partial submissions are persisted, so an
  abandoned form is still a lead.
- Document uploads into a private Supabase Storage bucket, signed URLs only,
  server-side MIME and size validation, explicit consent recorded at upload,
  and a hard-delete path so a deletion request can be honoured.
- A server-side analysis pipeline: extract text from uploads with libraries
  (never a language model), diff it against the reference data, validate the
  result against a schema, and fall back to a safe generic explainer email if
  validation fails.
- An automated response email to the client plus an internal copy.
- `lib/requirements/` — a typed, versioned reference data file of known
  requirements by trade x platform, hand-editable by a non-developer. It is
  the only source of what a document is called and how it is recognised; if
  it is silent, the output is a question rather than a claim.
- Internal ops: notification on every submission, an internal-only
  submissions page behind a shared secret in env, and a log of every review
  produced to the DB, sent or not.

Still out of scope: billing, auth, user accounts, and any redesign of the
existing visual identity.

Abuse: a submission no longer costs an API call, but it does cost storage,
an email and a person's attention. Keep the submission endpoint rate-limited
and keep basic spam protection on it.

## Language models — one use, fenced
This rule previously read "no LLM is used anywhere in this project, and none
should be added without an explicit decision to reverse this." That decision
was taken deliberately on 2026-07-29 and is recorded here rather than removed,
because the reasoning it gave still governs everything except the one use it
was reversed for.

**Still deterministic, and not open for a model:** text extraction, the gap
analysis, and the review. Libraries pull the text out; the review is a text
search against `lib/requirements/`. The same submission must produce the same
answer twice, every claim must point at a file and a phrase a person can
check, and nothing may be invented. Do not put a model anywhere in that path.

**The one exception — revision analysis** (`lib/programs/revise-analysis.ts`).
When a hiring client sends a document back, a model reads the existing
document and the reviewer's wording and either applies that one change or
returns clarification questions. This could not be done deterministically:
acting on free text is exactly the thing a text search cannot do, and the
honest alternatives were a human or nothing.

What makes it acceptable is that the model is fenced rather than trusted:

- It never sees a blank page. It is given the document that exists and asked
  for the smallest change that satisfies one request.
- It never sees `sourceRef`, and one is never accepted back from it. Our
  regulatory mapping is re-attached by heading afterwards.
- A revision may change at most one section, may not add a section, and may
  not introduce a CFR citation anywhere (`checkRevision`). All three are
  refusals, not warnings.
- The result then passes `validateDocument` — the same gate every assembled
  document passes — before anything is written.
- Ambiguity produces questions for the customer, never an assumption.
- Nothing is stored unless every gate passes. A refused revision leaves the
  existing version untouched.

The provider is a free tier and is treated as untrusted and unreliable by
design. The call requires strict JSON Schema output, and the reply is still
re-validated field by field with zod and then put through the gates above:
constrained decoding guarantees shape, not fidelity. A weak provider degrades
into "refused more often" and never into "bad document accepted". Expect more
clarification questions than a frontier model would produce — that is the
fence working, not failing.

Because the document goes to a third party, do not widen what is sent. The
prompt carries the document's headings and prose, the reviewer's wording, and
any clarification answers — nothing else. No email address, no company profile
row, no uploaded file, no `sourceRef`.

That is not the same as anonymous: the company's own name is written into the
programme's prose by the template, so it goes with the document. That is
unavoidable while the document is the thing being edited, but it is worth
knowing rather than discovering — a free tier is free because of what the
provider may do with what you send it. If a customer ever asks what leaves
this system, the answer is "your safety programme, your company name, and what
your hiring client wrote", and that answer should stay short.

If you are adding a model anywhere else, this section is not precedent. It is
one use, chosen because the deterministic path was not "harder" but absent,
and it is bounded by code rather than by prompt wording.

## Regulatory output rules (Scope B — non-negotiable)
These bind generated output, not just page copy — including anything a model
proposes during a revision, which is checked against them in code before it is
saved rather than merely asked for in a prompt.
- Never invent a regulation, CFR citation, platform requirement, or
  deadline. If unsure, emit the item as `status: "unknown"` and put it in
  `questionsForClient`.
- Never state what a specific named hiring client requires unless it is
  present in the reference data. Client-specific requirements default to
  `unknown`.
- Never assert that a contractor is or is not compliant, or that they will
  pass or fail. Prefer omission over speculation.
- Every item cites its basis (a document reviewed, or the client's own
  checkbox answer). An item with no basis must be low confidence.
- OSHA citations are retrieved, never written by hand. Any CFR reference must
  be fetched from the eCFR API (`https://www.ecfr.gov`, public, no key) and
  confirmed to exist and to match its subject. Anything that fails is dropped,
  never shown with a caveat: an unverified citation is worse than none,
  because it looks equally official and anyone in this industry can check it.

  IMPLEMENTED AT BUILD TIME, NOT PER SUBMISSION, and deliberately so — do not
  "fix" this by moving the fetch into the request path. Retrieval happens in
  `npm run verify:citations`, which writes a committed cache that the app
  reads. Fetching per submission would make an identical submission produce
  different output depending on eCFR's uptime, put a third-party outage
  between a contractor and their email, and add seconds to a function that has
  already died twice on its wall clock. Re-run the script when candidates
  change or to pick up amendments.
- Where a mapping is refused, say so in data rather than leaving an empty
  array. `CITATION_GAPS` records the requirement, the work context, a stable
  code and a reason. An empty list cannot distinguish "not researched" from
  "deliberately not mapped", and those need opposite responses. Refusing to
  over-map is a feature: 1910.147 excludes construction, and no Part 1926
  section has been verified as a universal counterpart, so construction
  lockout/tagout returns nothing at all rather than the nearest guess.
- Keep retrieved facts separate from mapping decisions. That a standard
  excludes construction is retrieved from its own text. That no counterpart
  exists is a judgement made in this repo, and a weaker claim than it looks —
  it says no validated one-to-one mapping exists, not that construction has no
  rules on the subject.
- Do not conflate OSHA with ISNetworld. ISN and Avetta requirements are
  contractual, set by the platform and the hiring client; they overlap with
  OSHA but plenty of what ISN asks for has no OSHA basis at all. Output must
  separate "required by OSHA" (verified citation attached), "commonly
  requested by ISNetworld/Avetta" (from our reference data, marked as our
  understanding, not law), and "specific to your hiring client" (default
  `unknown`, ask them to confirm).
- The response email must state plainly that it is a preliminary automated
  review, not a certified audit, and that items should be confirmed with the
  hiring client. Low-confidence items render as questions, never assertions.
  Unreadable or unassessed files are listed explicitly — silence must never
  imply "reviewed and fine".

## Stack
- Next.js (App Router), TypeScript
- Deploy target: Vercel
- Lead and submission storage: Supabase (free tier); uploaded documents go
  in a private Supabase Storage bucket
- Analysis: deterministic, server-side. No language model in the gap-check or
  review path. The single model use is revision analysis, on a free tier,
  behind `lib/ai/model.ts`; see "Language models" above.
- Transactional email: SMTP via nodemailer (see `src/lib/notify.ts`)
- No auth, no user accounts, no payments in this phase

Secrets: the Supabase service key, `ADMIN_SECRET` and `LLM_API_KEY` live in
`.env.local` only, are used server-side only, and must never take a
`NEXT_PUBLIC_` prefix. A missing `LLM_API_KEY` or `LLM_MODEL` disables
revisions and nothing else — every other page works without them, by design.

The model provider is configured, not coded:

    LLM_API_KEY=...        # required
    LLM_MODEL=...          # required; no default, see below
    LLM_BASE_URL=...       # optional, defaults to Groq
    LLM_MAX_TOKENS=8192    # optional; caps completion size for the chosen model/tier

Any OpenAI-compatible chat-completions endpoint works — Groq, OpenRouter,
Together, a local llama.cpp or Ollama server — so moving between free tiers is
three variables and no deploy. `LLM_MODEL` has no default on purpose: free-tier
model names are renamed and retired far faster than paid ones, and a stale
default fails at request time with "model not found" instead of at boot.

## Naming
Working name is "CertLoop" — not final, may still change. Store it in a
single constant (e.g. `lib/constants.ts` exporting `SITE_NAME = "CertLoop"`)
and reference that constant everywhere a brand name would appear (page
titles, headers, metadata, form copy, config) rather than hardcoding the
string in multiple places. Swapping the real name later should be a
one-line change, not a find-and-replace across the codebase.

## Icons
No emoji anywhere in the UI — not as icons, not as bullet markers, not
in copy. Use a real icon library (e.g. lucide-react or Heroicons) or
clean inline SVG for anything that needs an icon, including buttons,
list markers, and status indicators. Emoji read as unpolished and
inconsistent across platforms — this product needs to look like
professional tooling, not a consumer app.

## Ground rules for autonomous work
- Always check `tasks.json` for the current task before doing anything else.
- Stay within this repo. Never touch other projects or system config.
- Never commit secrets (API keys, DB credentials) to git. Use `.env.local`
  and confirm it's in `.gitignore` before the first commit.
- Work on a branch per task (`task/<id>-short-name`), open a PR against
  `main` rather than committing directly to main.
- After finishing a task: run `npm run build` and `npm run lint` (or the
  project's equivalent) and only mark the task "done" if both pass clean.
- If something fails twice in a row, mark the task "blocked" with a clear
  note and STOP — don't guess further or skip ahead to the next task.
- Do not write or claim any compliance/regulatory content as fact. Any
  placeholder copy about OSHA/ISNetworld requirements must be marked
  TODO-VERIFY and use only the general example already in the mockup,
  not invented specifics. This applies to hand-written page copy and to
  the `lib/requirements/` reference data alike; for generated output, see
  "Regulatory output rules" above.
- After each task, append a short plain-English summary to logs/<date>.md.

## SEO requirements (apply to every page)
- Use Next.js Metadata API for title/description per page — no generic
  boilerplate, write copy specific to the page's purpose.
- Generate sitemap.xml and robots.txt via Next.js conventions.
- Semantic HTML (proper heading hierarchy, one h1 per page).
- Add JSON-LD structured data for Organization on the homepage.
- Images need descriptive alt text; no image-only content.
- Target Core Web Vitals: use next/image, avoid layout shift, keep JS
  bundle lean — check with npm run build output size.

## Visual identity — real creative freedom, not a template
Do not reuse the navy/safety-yellow palette from the reference mockup —
that was a placeholder, not a directive. Come up with an original,
distinctive palette and typography pairing specific to this subject
(industrial compliance, safety, blue-collar trades) — something sleek,
unique, and easy on the eyes. Take an actual point of view: pick 4-6
named colors that feel considered together, pair a characterful display
typeface with a clean body face (not the same fonts you'd reach for on
any generic SaaS page), and choose one small signature visual detail
that makes the page memorable. Spend real effort here — this is not a
"just make it functional" page, it should look genuinely nice.

The only hard constraints (things to avoid, not a palette to follow):
- No cream (#F4F1EA-ish) + terracotta/orange — this is a well-known
  "AI generated this" tell
- No near-black background with a single neon accent — same problem
- No gradients, drop shadows, glassmorphism, or glowing buttons
- No decorative 01/02/03 numbering unless the content is truly sequential
- No generic corporate copy: avoid "unlock," "seamless," "empower,"
  "leverage," "revolutionize," "game-changing"
- Ground copy in specific, real details of the industry (regulation
  names, actual pain points) rather than generic value-prop language

Keep the page lean regardless of visual direction: hero + how-it-works +
single clear CTA. Hold off on a pricing section for this phase — lead
with the free gap-check offer only, don't show pricing until told to
add it back. The Scope B response email carries an indicative price band,
explicitly non-binding and confirmed on a call — that is a quote, not a
pricing section, and it does not license one on the site.

## Definition of done (per task)
- Code committed on a task branch, PR opened
- `npm run build`, `npm run lint` and `npm test` all pass
- Manually described in logs/<date>.md
- tasks.json updated

Tests are `node:test` run through `tsx` — there is no framework and none is
needed. Prefer negative tests: the failures worth catching here are the ones
that look correct, like a real regulation shown to a contractor it does not
cover.

## Framework notes
This project runs Next.js 16, which has breaking changes from earlier
versions. See `AGENTS.md` and the bundled docs in `node_modules/next/dist/docs/`.
