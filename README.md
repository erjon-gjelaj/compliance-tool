# CertLoop

Lead-generation landing page for a tool that helps small industrial
subcontractors find the safety compliance paperwork missing from their
ISNetworld / Avetta prequalification file.

Working name only — the brand string lives in `src/lib/constants.ts`.

## Scope

Scope A: a deployed, SEO-indexable landing page with lead capture. The
gap-checking logic itself is not built here. See `CLAUDE.md` for ground
rules and `business-model.md` for audience and positioning.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS v4
- Supabase for lead storage (task 003, not wired yet)
- Deploy target: Vercel

## Getting started

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

## Checks

```bash
npm run build
npm run lint
```

## Layout

```
src/app/          routes, layout, metadata
src/components/   page sections and UI pieces
src/lib/          shared constants and helpers
```
