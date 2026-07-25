# Deploying to Vercel

Task 005. The repo is verified deploy-ready; the steps below need a human
because they require signing into a Vercel account, which an agent can't do.

## Before you start

Nothing to change in the code. `main` builds clean, is fully static, and the
only runtime dependency is Supabase.

## 1. Import the repo

Vercel Dashboard → Add New → Project → import `erjon-gjelaj/compliance-tool`.

Framework preset should auto-detect as **Next.js**. Leave build command,
output directory, and install command on their defaults — this is a stock
Next.js 16 App Router project with no custom build steps.

Production branch: **main**.

## 2. Set environment variables

Set all three for **Production, Preview, and Development**. Values for the
first two are in your local `.env.local` — copy them across; they are not in
git and never should be.

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | from `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from `.env.local` |
| `NEXT_PUBLIC_SITE_URL` | the deployed origin, no trailing slash |

Notes:

- The anon key is the publishable one and is safe to expose to the browser.
  The `leads` table is insert-only for that role, so it can't read anything
  back out. There is no service-role key in this project and nothing needs one.
- `NEXT_PUBLIC_SITE_URL` drives `sitemap.xml`, `robots.txt`, the canonical
  link, the Open Graph tags, and the JSON-LD `url`. Verified: setting it
  changes all five. If you leave it unset the code falls back to
  `https://certloop.vercel.app` (see `src/lib/constants.ts`), which is right
  only if that happens to be the assigned domain — set it explicitly.
- Set it to the Vercel-assigned `*.vercel.app` origin for now. It has to be
  updated again when a custom domain is attached, because a canonical URL
  pointing at the wrong origin is worse for SEO than none.

**Watch out:** the build succeeds even with the Supabase variables missing —
verified locally. The page is fully static, so nothing touches Supabase until
someone submits the form. A misconfigured deploy therefore goes green and
looks perfectly healthy, and only fails at submit time. Don't treat a
successful build as proof the form works; do step 3.

## 3. Verify the deployment

1. Load the deployed URL — the page should render identically to local.
2. **Submit the form once with a real address.** Confirm the success panel
   appears, then confirm the row landed in Supabase → Table Editor → `leads`.
   This is the only check that proves the env vars are actually right.
3. Check `/robots.txt` and `/sitemap.xml` show the deployed origin, not
   `localhost` and not the fallback.
4. View source and confirm the canonical link matches the deployed origin.

## 4. Custom domain — STOP

Do not attach a custom domain yet. The working name "CertLoop" is not final
(see `CLAUDE.md`), and the domain choice depends on it. Attaching one now
means redoing the canonical URL, the sitemap, `SITE_URL`, and the JSON-LD.

When a name is settled, the order is: register the domain → attach it in
Vercel → update `NEXT_PUBLIC_SITE_URL` → redeploy → re-run step 3.

## Still open, unrelated to deploying

- No Open Graph image. Deferred in task 004 because it would bake the
  working name into an image. Worth doing once the name is final.
- `CONTACT_EMAIL` in `src/lib/constants.ts` is `hello@certloop.com`, a domain
  nobody owns yet. The footer links to it. Needs to become a real mailbox
  before the page gets meaningful traffic.
- `npm audit` reports advisories in Next.js transitive dependencies
  (postcss, sharp). Noted in task 001; no fix available that doesn't
  downgrade Next.js.
