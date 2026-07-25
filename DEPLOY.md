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
| `SMTP_HOST` | optional — see *Lead notification emails* |
| `SMTP_PORT` | optional — `587`, or `465` for implicit TLS |
| `SMTP_USER` | optional — see *Lead notification emails* |
| `SMTP_PASSWORD` | optional — see *Lead notification emails* |
| `LEAD_NOTIFY_FROM` | optional — defaults to `SMTP_USER` |
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

Sent over plain SMTP with nodemailer, so it works with whatever mailbox
provider hosts `info@certloop.net` — no third-party sending service, no extra
account, and no API key to manage.

**It stays off until the SMTP variables are set.** Without them, submissions
still save exactly as before and the server logs a warning saying
notifications are skipped. Nothing breaks; you just don't get the mail.

### Setting it up

1. Get the outgoing SMTP details from whoever hosts `info@certloop.net`.
   You need the server hostname, the port, the username (usually the full
   address), and the password.
2. **Use an app-specific password if your provider offers one.** Most do.
   It can be revoked on its own without changing the password you log in
   with, which matters when the value is sitting in a deployment platform.
3. Set these in Vercel, for Production at minimum:

   | Variable | Example |
   | --- | --- |
   | `SMTP_HOST` | `smtp.zoho.eu` |
   | `SMTP_PORT` | `587` |
   | `SMTP_USER` | `info@certloop.net` |
   | `SMTP_PASSWORD` | the mailbox or app password |
   | `LEAD_NOTIFY_FROM` | `CertLoop <info@certloop.net>` (optional) |
   | `LEAD_NOTIFY_TO` | `info@certloop.net` (optional) |

   **None of these may take a `NEXT_PUBLIC_` prefix.** That would publish the
   SMTP password to every visitor's browser, handing out the ability to send
   mail as this domain.

4. Redeploy and submit the form once. The email's reply-to is the
   contractor's address, so replying answers them directly rather than
   coming back to you.

The same keys are in `.env.local.example`, and blank ones are already in
`.env.local` for local testing.

### Notes on the implementation

`src/lib/notify.ts`, and three properties are deliberate:

- **It can never fail a submission.** The send is attempted only after the row
  is safely inserted, and every failure path is caught and logged rather than
  surfaced. A lead that saved but whose notification bounced is still a saved
  lead — showing the visitor an error would just invite a retry that
  duplicates the row. Verified by pointing it at a dead port: the submission
  is unaffected and the error goes to the server log.
- **Config is all-or-nothing.** A half-filled config is treated as absent
  rather than attempted, so a missing password can't produce an auth failure
  on every single submission.
- **TLS is not optional.** Port 465 is treated as implicit TLS; every other
  port is required to upgrade via STARTTLS before authenticating, so the
  password is never sent over a plaintext session.

### Still unverified

Actual delivery. There are no working credentials in the development
environment, so what's been proven is the configuration handling, the TLS
selection, and the failure behaviour — not that your provider accepts the
message. The first submission after you set the variables is the real test.
