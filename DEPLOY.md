# Deploying to Vercel

**Status: deployed and verified.** The site is live on `certloop.net`, the
environment variables are set, and a real form submission on production was
confirmed landing in the Supabase `leads` table. The steps below are kept as
the runbook for redeploying or rebuilding the project from scratch.

Two things the live check turned up are recorded at the bottom under
*Post-deploy findings* — neither blocks anything, both are config rather
than code.

> **Scope B needs two manual steps before the next deploy.** Both are things
> only a human with dashboard access can do, and the intake form is dead
> without them — it replaces the old single-screen lead form, so there is no
> fallback path.
>
> 1. Run `supabase/migrations/0002_submissions.sql` in the Supabase SQL
>    editor. It creates the `submissions` table.
> 2. Add `SUPABASE_SERVICE_ROLE_KEY` to the environment, locally in
>    `.env.local` and in Vercel's project settings (all environments). It is
>    under Dashboard > Project Settings > API, labelled `service_role`. It
>    bypasses row level security, so it must never take a `NEXT_PUBLIC_`
>    prefix and must never be committed.
>
> If a submission fails with `permission denied for table submissions`, that
> is a table-privilege error rather than an RLS one, and it means one of two
> things. Check which with:
>
> ```sql
> select
>   has_table_privilege('service_role', 'public.submissions', 'INSERT') as service_role_ok,
>   has_table_privilege('anon',         'public.submissions', 'INSERT') as anon_ok;
> ```
>
> `service_role_ok` false means the grant is missing — re-run migration 0002,
> which is safe to run again. `service_role_ok` true means the configured key
> is not the service-role key; the publishable key produces exactly this
> message, because the migration revokes everything from `anon`.
>
> Until both are done, submitting the form shows the generic "something went
> wrong" panel — the failure is caught and logged rather than crashing, but
> nothing is saved. The old `leads` table is untouched and keeps its history;
> nothing writes to it any more.

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

A submission sends two emails, as well as being stored in Supabase, which
stays the record of truth:

- **To `info@certloop.net`** — so nobody has to watch the table editor to
  notice a lead arrived. Reply-to is the contractor, so replying answers them.
- **To the contractor** — a receipt confirming it arrived, what happens next,
  and a copy of what they submitted. Reply-to is `info@certloop.net`, so
  replying reaches you.

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

4. Redeploy and submit the form once. You should get the internal copy, and
   the address you submitted with should get the confirmation.

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

- **One email failing can't suppress the other.** The two sends are settled
  independently, so a confirmation that bounces on a mistyped address still
  leaves you with the internal copy — the one that tells you the lead exists
  at all.

### A note on the confirmation email

The form is public and unauthenticated, and it now sends mail to an address
the submitter types in. That makes it a small spam-amplification vector:
someone could submit repeatedly with a third party's address and have this
site mail them. The volume ceiling is whatever your SMTP provider allows.

Nothing is needed today at current traffic, and rate limiting was out of
scope here. If the site starts getting real traffic — or if you see repeat
submissions for addresses that never reply — the fix is a rate limit on the
server action, keyed by IP.

### The contact form

The contact page has its own form, separate from the gap check, and it works
differently in one way that matters operationally: **there is no database
behind it.** A gap check is written to Supabase before any mail is attempted,
so a failed send costs you a notification, not the lead. A contact message
exists only as an email.

That drives two deliberate choices:

- **A failed send is reported to the visitor**, rather than swallowed the way
  a gap-check notification failure is. If SMTP is misconfigured or down, the
  form says so and hands them the mailto link instead of showing a success
  panel for a message that went nowhere. Watch for this after any SMTP
  credential change — a broken mailer is now visible on the contact page
  rather than silent.
- **No auto-reply to the sender.** The message goes to your inbox only, with
  reply-to set to whoever wrote it. Sending a receipt would extend the
  spam-amplification vector described above to a second form, and unlike the
  gap check there is no stored record for the receipt to confirm.

A hidden honeypot field catches the ordinary form-filling bots: anything
arriving with it completed is discarded server-side and shown a normal
success panel, so there is nothing to tune against. That is not rate
limiting, and the note above still applies — the fix, if real traffic
arrives, is a rate limit on the server action keyed by IP.
