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
- A server-side analysis pipeline: extract text from uploads, call the
  Anthropic API, require structured JSON output validated against a schema,
  and fall back to a safe generic explainer email if validation fails.
- An automated response email to the client plus an internal copy.
- `lib/requirements/` — a typed, versioned reference data file of known
  requirements by trade x platform, hand-editable by a non-developer. The
  model prompt must prefer this data over its own knowledge.
- Internal ops: notification on every submission, an internal-only
  submissions page behind a shared secret in env, and a log of every model
  input and output to the DB.

Still out of scope: billing, auth, user accounts, and any redesign of the
existing visual identity.

Cost and abuse: every submission costs money. Rate-limit the submission
endpoint and keep basic spam protection on it.

## Regulatory output rules (Scope B — non-negotiable)
These bind anything the model emits, not just page copy.
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
- OSHA citations are retrieved, never recalled. Any CFR reference must be
  fetched from the eCFR API (`https://www.ecfr.gov`, public, no key) at
  generation time and confirmed to exist and to support the stated claim.
  If it does not resolve or does not support the claim, strip the citation
  and downgrade the item to `unknown`. This check runs on every submission,
  automatically — it is not a stand-in for manual review of early drafts.
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
- Analysis: the Anthropic API, server-side only
- Transactional email: SMTP via nodemailer (see `src/lib/notify.ts`)
- No auth, no user accounts, no payments in this phase

Secrets: `ANTHROPIC_API_KEY` and the Supabase service key live in
`.env.local` only, are used server-side only, and must never take a
`NEXT_PUBLIC_` prefix.

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
- Build and lint pass
- Manually described in logs/<date>.md
- tasks.json updated

## Framework notes
This project runs Next.js 16, which has breaking changes from earlier
versions. See `AGENTS.md` and the bundled docs in `node_modules/next/dist/docs/`.
