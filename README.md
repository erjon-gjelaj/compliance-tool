# CertLoop

Lead-generation site for a tool that helps small industrial subcontractors
find the safety compliance paperwork missing from their ISNetworld / Avetta
prequalification file.

Working name only — the brand string lives in `src/lib/constants.ts`.

## Where this is up to

**Scope A is done and deployed** on `certloop.net`: landing page, SEO, lead
capture.

**Scope B is mostly done.** A four-step intake replaced the old single-screen
form, uploads go to a private Supabase bucket, and a submission produces an
automated review by email. Read `logs/` newest-first for how each piece got
here and, more usefully, why several things are deliberately *not* built.

Read `CLAUDE.md` before writing code, and `business-model.md` for audience
and positioning.

## The one idea worth understanding first

The review is a **diff, not a judgement**. Everything it reports is a fact
about a file the contractor sent or an answer they gave:

| status | means |
| --- | --- |
| `present` | the words turned up in a document they sent |
| `likely_missing` | they sent readable documents, and the words are in none |
| `unknown` | nothing to go on either way |

"We searched your four documents for the words a lockout/tagout programme is
written in and did not find them" is checkable and reproducible. "You need a
lockout/tagout programme" is a different kind of claim, and this code is not
in a position to make it. Several rules that look like over-caution exist to
hold that line — see `src/lib/analysis/match.ts` and `src/lib/requirements/`.

There is **no language model anywhere in this project**, by decision. See the
section in `CLAUDE.md`.

## Stack

- Next.js 16 (App Router) + TypeScript, Tailwind v4
- Supabase: Postgres and a private Storage bucket
- Vercel, Hobby plan — the 60s function ceiling has bitten twice, see `logs/`
- Nodemailer over SMTP

## Getting started

```bash
npm install
cp .env.local.example .env.local   # Supabase, SMTP, ADMIN_SECRET
npm run dev
```

## Checks

All three must pass before anything is marked done.

```bash
npm run build
npm run lint
npm test
```

`npm test` uses `node:test` through `tsx`. There is no test framework and it
does not need one. The tests that exist are mostly *negative*: they assert
that a wrong-but-plausible citation never reaches a contractor.

## Database

Migrations live in `supabase/migrations/` and are run in order by hand in the
Supabase SQL editor. `DEPLOY.md` has the runbook.

Every table has RLS enabled with **no policies**, deliberately: under RLS an
unpolicied operation is denied, so that is the locked-down state rather than
an unfinished one. All access is server-side through the service role key.

## Citations

OSHA citations are **retrieved, never recalled**. Candidates are proposed in
`src/lib/requirements/citations.ts`; `npm run verify:citations` fetches each
from the eCFR API and keeps it only if the real published heading matches.
The committed cache is what the application reads, so the request path never
touches the network.

Re-run it when candidates change, or to pick up amendments:

```bash
npm run verify:citations
```

## Internal

`/internal/submissions` lists every submission behind `ADMIN_SECRET`. It is
read-only; deletion stays behind `DELETE /api/submissions/<id>`.

## Layout

```
src/app/                routes, layout, metadata, server actions
src/components/         page sections and UI
src/lib/analysis/       extraction, matching, the review itself
src/lib/requirements/   reference data and its citations
scripts/                dev tools (eCFR verification)
supabase/migrations/    schema, run by hand
logs/                   one file per working day
```
