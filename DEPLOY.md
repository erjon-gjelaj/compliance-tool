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
  changes all five.
- **Set it explicitly to the `*.vercel.app` origin for the first deploy.**
  The fallback in `src/lib/constants.ts` is now `https://certloop.net`, since
  that domain is registered — but until it is actually attached and serving,
  leaving the variable unset means every canonical link, the sitemap, and the
  OG tags all point at a hostname that doesn't answer. That is worse than
  pointing at the ugly Vercel URL.
- Change it to `https://certloop.net` in the same edit that attaches the
  domain (step 4), not before.

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

## 4. Custom domain — certloop.net

`certloop.net` is registered. The code now defaults to it, but nothing has
been attached — that is a Vercel dashboard action needing your account.

Order matters, because each step is only correct once the previous one has
taken effect:

1. Vercel → Project → Settings → Domains → add `certloop.net`.
2. Add the DNS records Vercel gives you at your registrar. Decide whether
   `www` redirects to the apex or the other way round, and set the other as a
   redirect rather than serving both — two hostnames serving identical pages
   splits your search signals.
3. Wait for the certificate to issue and confirm `https://certloop.net`
   actually loads the site.
4. **Only then** change `NEXT_PUBLIC_SITE_URL` to `https://certloop.net` and
   redeploy. Doing this before step 3 publishes canonical URLs and a sitemap
   pointing at a hostname that doesn't resolve.
5. Re-run the step 3 checks against the new origin, and resubmit the form
   once — the Supabase call is same-origin from a server action, so it should
   be unaffected, but it costs one submission to know rather than assume.

## Still open, unrelated to deploying

- **`hello@certloop.net` has to become a real mailbox.** The domain is now
  registered, so this is possible where it wasn't before. It matters more
  than it looks: the Contact page and the FAQ are both built around that
  address reaching a person, and the form's success panel tells people to
  reply to it if their deadline is tight. Set up the mailbox or forwarding
  before driving any traffic here.
- `npm audit` reports advisories in Next.js transitive dependencies
  (postcss, sharp). Noted in task 001; no fix available that doesn't
  downgrade Next.js.
