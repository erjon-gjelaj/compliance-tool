# Deploying to Vercel

**Status: deployed and verified.** The site is live on `certloop.net`, the
environment variables are set, and a real form submission on production was
confirmed landing in the Supabase `leads` table. The steps below are kept as
the runbook for redeploying or rebuilding the project from scratch.

Two things the live check turned up are recorded at the bottom under
*Post-deploy findings* — neither blocks anything, both are config rather
than code.

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
| `NEXT_PUBLIC_SITE_URL` | the deployed origin — set to `certloop.net` |
| `RESEND_API_KEY` | optional — see *Lead notification emails* |
| `LEAD_NOTIFY_FROM` | optional — see *Lead notification emails* |
| `LEAD_NOTIFY_TO` | optional — defaults to `CONTACT_EMAIL` |

Notes:

- The anon key is the publishable one and is safe to expose to the browser.
  The `leads` table is insert-only for that role, so it can't read anything
  back out. There is no service-role key in this project and nothing needs one.
- `NEXT_PUBLIC_SITE_URL` drives `sitemap.xml`, `robots.txt`, the canonical
  link, the Open Graph tags, and the JSON-LD `url`. Verified: setting it
  changes all five.
- The value is normalised in `src/lib/constants.ts`, so `certloop.net`,
  `https://certloop.net`, and a trailing slash all resolve to the same
  origin. Worth knowing why: the raw value used to be passed straight to
  `new URL()` for `metadataBase`, and a bare hostname throws there — which
  would have failed the Vercel build outright rather than degrading.
- It is currently `https://certloop.net`. See *Post-deploy findings* below:
  the apex redirects to `www`, so this value and the origin that actually
  serves disagree.

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

**Done — attached and serving.** Kept for reference if the domain is ever
moved or rebuilt. Order matters, because each step is only correct once the
previous one has taken effect:

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

- ~~A real mailbox~~ — done. `info@certloop.net` is registered and live, and
  is what the site now shows. Worth one manual check after deploying: send a
  message to it from outside and confirm it arrives, since the Contact page,
  the FAQ, the footer, and the form's success panel all point people there.
- `npm audit` reports advisories in Next.js transitive dependencies
  (postcss, sharp). Noted in task 001; no fix available that doesn't
  downgrade Next.js.

## Post-deploy findings

Both found by checking the live site rather than the build. Neither is a code
change; both are settings.

### 1. The apex redirects to `www`, but the canonical says apex

`https://certloop.net` returns a 308 to `https://www.certloop.net`, which is
what actually serves. Meanwhile `NEXT_PUBLIC_SITE_URL` is set to the apex, so
every page's canonical link, every `og:url`, and all four sitemap entries name
`certloop.net` — a hostname that immediately redirects somewhere else.

It isn't fatal. Google generally follows the redirect and settles on the
target. But you are telling crawlers the authoritative copy lives at a URL
that doesn't serve it, which is the kind of thing that gets a canonical
ignored, and it means your sitemap and your served origin disagree.

Pick one and make everything agree:

- **Apex canonical** (matches `SITE_URL` and the brand as registered): in
  Vercel → Domains, make `certloop.net` the primary and set `www` to redirect
  to it. No redeploy needed, nothing in the repo changes.
- **`www` canonical**: leave the redirect as it is and change
  `NEXT_PUBLIC_SITE_URL` to `https://www.certloop.net`, then redeploy so the
  canonical, OG tags and sitemap regenerate.

Either is fine. Doing neither leaves the disagreement in place.

### 2. Cloudflare is in front of Vercel and is rewriting `robots.txt`

The domain is proxied through Cloudflare (`server: cloudflare` on every
response). Cloudflare's managed `robots.txt` feature is prepending a
`Content-Signal` block to what `src/app/robots.ts` generates, and that block
disallows a list of AI crawlers outright:

`Amazonbot`, `Applebot-Extended`, `Bytespider`, `CCBot`, `ClaudeBot`,
`Google-Extended`, `GPTBot`, `meta-externalagent`, and Cloudflare's own
rendering crawler.

Worth knowing because **it is not coming from this repo** — nothing in
`src/app/robots.ts` blocks anyone, so reading the source would tell you the
opposite of what crawlers actually see. It is a Cloudflare default, not a
decision anyone here made.

Ordinary search is unaffected: the managed block sets `search=yes` and
`Allow: /`, so Googlebot and Bingbot index normally. If you *want* to be
included in AI training and AI-answer surfaces, that is a Cloudflare
dashboard setting, not a code change.

One side effect worth fixing: `https://certloop.net/robots.txt` (apex) serves
only Cloudflare's block and drops the `Sitemap:` line, while the `www` version
keeps it. Resolving finding 1 makes this consistent too.

## Lead notification emails

Form submissions are emailed to `info@certloop.net` as well as being stored
in Supabase. Supabase stays the record of truth; the email is so nobody has
to watch the table editor to notice a lead arrived.

**This is not switched on until you add a Resend account and key.** Without
one, submissions still save exactly as before and the server logs a warning
saying notifications are skipped. Nothing breaks, you just don't get the mail.

To turn it on:

1. Create a Resend account and verify `certloop.net` as a sending domain
   (this means adding the DKIM/SPF records they give you at your registrar).
   The sending domain has to be one you control — a free-mail address won't
   be accepted as the sender.
2. Create an API key.
3. Set these three in Vercel, for Production at minimum:

   | Variable | Example |
   | --- | --- |
   | `RESEND_API_KEY` | `re_...` |
   | `LEAD_NOTIFY_FROM` | `CertLoop <notifications@certloop.net>` |
   | `LEAD_NOTIFY_TO` | `info@certloop.net` (optional; defaults to `CONTACT_EMAIL`) |

   **None of these may take a `NEXT_PUBLIC_` prefix.** That would publish the
   API key to every visitor's browser.

4. Redeploy and submit the form once. You should get an email whose reply-to
   is the contractor's address, so replying answers them directly rather than
   coming back to you.

Two deliberate properties of the implementation, in `src/lib/notify.ts`:

- **It can never fail a submission.** The email is attempted only after the
  row is safely inserted, and every failure path is caught and logged rather
  than surfaced. A lead that saved but whose notification bounced is still a
  saved lead, and showing the visitor an error would just invite a retry that
  duplicates the row.
- **It's a plain `fetch` to one endpoint,** not an SDK, so there's no
  dependency to keep current. Switching providers means rewriting one
  function.

Swapping to a different provider (Postmark, SendGrid, SES) is a change to
`notifyNewLead` alone — nothing else imports it.
