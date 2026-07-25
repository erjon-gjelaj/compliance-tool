# Project: CertLoop (working name — may still change)

## What this is
A lead-generation landing page for a future tool that helps small industrial
subcontractors figure out what safety compliance paperwork they're missing
for ISNetworld/Avetta prequalification. Read `business-model.md` for full
context on the problem, audience, and positioning before writing any copy.

Right now we are building SCOPE A ONLY: a real, deployed, SEO-indexable
landing page with working lead capture. We are NOT building the actual
gap-checking logic yet — that requires human domain research first. Do
not attempt to build "smart" compliance logic; static content and a
lead-capture form are the entire scope.

There is no prior mockup to follow for design — build the page fresh
based on business-model.md and the Visual identity section below.

## Stack
- Next.js (App Router), TypeScript
- Deploy target: Vercel
- Lead storage: Supabase (free tier) — a single `leads` table is enough
- No auth, no user accounts, no payments in this phase

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
  not invented specifics.
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
add it back.

## Definition of done (per task)
- Code committed on a task branch, PR opened
- Build and lint pass
- Manually described in logs/<date>.md
- tasks.json updated
