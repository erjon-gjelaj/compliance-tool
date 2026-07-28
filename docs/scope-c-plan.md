# Scope C — from "free document review" to a compliance workspace

Written 2026-07-27, at the point where Scope B is shipped and working:
multi-step intake, uploads, deterministic analysis, response email, internal
ops, magic-link sign-in and a per-submission dashboard.

Scope C does not replace any of that. Every stage below is built on the
existing primitives — `submissions`, `submission_documents`, `analyses`,
`lib/requirements`, the citation cache, the session cookie. Nothing here
reverses the no-LLM decision or the regulatory output rules; those get
stricter as the output moves from "what might be missing" towards documents a
contractor hands to a hiring client.

## The problem, stated plainly

The product answers one question — "what is my file missing?" — and asks the
visitor to already know that this is their question. The four ways people
actually arrive are:

1. A document was rejected.
2. A client told them to register in ISNetworld or Avetta.
3. They do not know what they are missing.
4. They need a safety manual or a written program.

Only (3) has a door. The other three have to work out that the gap check is
also for them.

## The one thing that is actually wrong today

The public copy describes a process this repo stopped running in task 027.

- `how-it-works.tsx` — "Someone reads it… a person on our side does the
  comparison by hand rather than a script guessing at it."
- `about/page.tsx` — "there is no dashboard behind this page and nothing is
  scoring your file. The comparison is done by hand."
- `faq/page.tsx` — "An email written by a person", "a person reads every one",
  "we aim to come back within a few business days".

All false since Scope B. The analysis is deterministic and server-side, the
reply is immediate, and there has been a dashboard since task 039. This is
worse than the tone problem in the same copy: a visitor is told to expect a
handwritten reply in a few days and gets an automated one in a minute.

Alongside it, the same pages narrate the company's smallness as a virtue at
length ("A small and genuinely early operation — early enough that a person
still reads every submission by hand. There is no team page here because
inventing one would be the first dishonest thing on the site."). Honest, but
defensive, and it buys nothing the reader wanted. Accuracy about limits stays.
Commentary on our own sincerity goes.

## Stages

Each stage ships on its own branch, passes `npm run build`, `npm run lint`
and `npm test`, and leaves the product working.

### Stage 1 — Copy truth and trust (task 046)

Correct every description of how the review is produced, and strip the
defensive self-narration from the homepage, About, FAQ, sign-in, dashboard
and form copy. Limitations stay, stated once, where they apply. This is
first because it is currently misleading, and because every later stage adds
copy that would inherit the same voice.

### Stage 2 — Entry points (task 047)

Four doors into one workspace, not four products:

| Door | Route | Produces |
| --- | --- | --- |
| A document was rejected | `/rejection` | a rejection request |
| Setting up ISN/Avetta | `/setup` | a gap check, platform-first |
| Check what I have | `/#gap-check` (today's) | a gap check |
| I need programs or a manual | `/documents` | a document-preparation request |

All four land in `submissions` with a new `entry_reason` column, so a rejection
is a submission with rejection context attached, not a separate table. The
rejection path accepts pasted reviewer comments, a deficiency notice, a
screenshot or the rejected file itself, and its output separates: what appears
to have been rejected, what the reviewer appears to be asking for, what we
found in the file, what needs confirming, what to send next. No claim about
what the portal says — we only ever see what they paste.

### Stage 3 — Company profile (task 048)

A `companies` table keyed by email, so trade, states, headcount, platforms,
hiring clients and hazards are entered once and reused by every later request.
Anything inferred rather than entered is stored with its source and rendered
for confirmation — never silently treated as fact. A company name reveals
nothing about how a crew actually works, and the profile must not pretend
otherwise.

### Stage 4 — Dashboard as workspace (task 049)

Replaces the list of past submissions. Answers, in order: what do I do next,
what is blocking me, what is done, what needs confirming, what documents do I
have, what expires soon. Built from data that already exists plus the profile
from Stage 3. Direct actions, not charts.

### Stage 5 — Review hierarchy (task 050)

`review-panel.tsx` gives equal weight to everything. Re-rank to: conclusion,
blockers, next actions, what looks present, questions, then standards and
reasoning behind progressive disclosure. Citations and traceability are
preserved exactly — moved down, never dropped.

### Stage 6 — Plans and service requests (task 051)

An entitlement seam that Stripe can later attach to without a rewrite: plan
state on the company (`free`, `contractor`, `consultant`, `admin`), a
capability check in one module, and a `service_requests` table capturing what
someone asked for. No checkout, no fake buttons. Where money will eventually
change hands, the button records intent and says so.

### Stage 7 — Document generation (task 040, still blocked)

Unchanged in status. The human picked the shape implicitly in this brief —
"controlled, reviewed source material and conditional sections rather than
unrestricted AI generation", which is option (a) from task 040's note — but
the source prose still has to be written by a person. This repo can build the
assembly engine, the section model, the confirmed-vs-draft separation and the
export, and cannot author the safety programme text. Stage 7 starts when
reviewed prose exists for at least one program.

### Stage 8 — Consultant workspace (task 052, later)

Schema-level preparation only for now: company rows already carry an owner, so
a consultant becomes a role holding many companies rather than a second
product. The contractor dashboard must not grow a workspace switcher it does
not need.

### Stage 9 — Maintenance (task 053, later)

Revision dates, expiries, annual review reminders, version history. The rule
that constrains it: we do not know that a platform requirement changed unless
the customer tells us or a real source says so. Reminders are about dates we
were given, never about changes we are guessing at.

## What does not change

- No language model, anywhere.
- No invented regulation, citation, deadline or platform requirement.
- Citations are retrieved at build time by `npm run verify:citations`, never
  in the request path.
- Hiring-client requirements default to `unknown`.
- Nothing asserts that a contractor is or is not compliant.
- Uploaded documents stay in the private bucket, signed URLs only, with the
  hard-delete path intact.
