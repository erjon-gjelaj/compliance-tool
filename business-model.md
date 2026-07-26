# Business model & context

This file exists so the landing page copy is specific and grounded, not
generic. Read this before writing any page content.

## The problem
Small industrial subcontractors (roughly 5-25 employees — electrical,
scaffolding, welding/fabrication, insulation, industrial cleaning crews)
get told by a hiring client (a refinery, plant, or similar industrial
site) that they must register and get approved in ISNetworld or Avetta
before they're allowed to work. These platforms require submitting
written safety programs, training records, insurance documentation, and
more, tailored to the contractor's trade and the specific hiring client's
requirements.

Most of these companies have no dedicated safety staff — often it's the
owner or an office manager handling this. Their only current options are:
- Hire a compliance consultant (roughly $1,500-$4,000, per early
  research — TODO-VERIFY current market rates), 30-45 day turnaround
- Muddle through generic templates that don't match their specific
  trade or hiring client's requirements

There is no cheap, fast, self-serve tool that just tells them exactly
what they're missing. TODO-VERIFY: confirm this gap still holds at
build time — check for new entrants before writing copy that claims
"no one else does this."

## Who we're building for
Primary buyer persona: owner or office manager at a small industrial
subcontractor, non-technical, just received an urgent compliance
deadline from a client. Trigger event: "register in ISNetworld/Avetta
or you don't get the work." Urgent, externally imposed, tied directly
to revenue — this is the reason they'd act now rather than "someday."

## What we built first (Scope A — done)
A landing page that states the problem in language this exact buyer would
recognize, offers a free "tell us your trade and hiring client, we'll show
you what you're missing" intake, and captures the lead. Deployed on
certloop.net with leads landing in Supabase. Follow-up was manual.

## What we're building now (Scope B)
The intake becomes the product. A submitted intake produces an automated,
emailed preliminary gap analysis, and captures enough to quote a price.
1. A multi-step intake (trade, hiring client, platform, deadline; then
   company profile; then a checklist of documents they already have; then
   optional document uploads plus contact details). Steps after the first
   are skippable and partials are persisted — a partial submission with an
   email address is still a lead worth calling.
2. Uploaded documents are read server-side — with ordinary libraries, not a
   language model — and diffed against a reference list of known requirements
   by trade and platform. The same submission produces the same answer every
   time, and every finding names the file and the phrase it came from.
3. An emailed preliminary review goes back automatically, plus a full copy
   to us.

Why uploads. Uploading your safety documents is a high-trust action and the
best qualifying signal available — someone who uploads six PDFs is a real
buyer, someone who types an email is a browser. It also flips the accuracy
problem: with documents in hand, much of the job is reading what's there and
diffing it against a list, rather than recalling requirements from memory.
Note the asymmetry — "you have a written LOTO program, here it is" is
verifiable from the upload; "you need one" is not. Output leans on what the
documents prove and what the client told us, and keeps everything else as
questions.

The friction tradeoff is accepted deliberately. A four-step form converts
worse than a four-field form, and that is fine right now: we cannot service
hundreds of leads by hand, and a longer form filters for urgency.

The failure mode has moved. Manual follow-up was slow; automated output can
be wrong instantly, at scale. The mitigations are that the review is
deterministic and reproducible rather than generated, that every finding
names the file and phrase behind it, confidence labelling, questions rather
than assertions, honest framing as preliminary, retrieved rather than
hand-written citations, and logging every review so we can audit what
actually went out. Read the first ~30 closely.

## Draft pricing model (for later — do not build billing yet)
- Free: intake + automated preliminary gap review
- ~$299 one-time: get "submission ready" (human-assisted in this phase)
- ~$39/month: ongoing renewal/deadline tracking
TODO-VERIFY: pricing is a first guess from early research, not tested.
Do not present this as fixed/final in copy — frame as indicative if
shown at all (and per CLAUDE.md, don't build a pricing section yet).

Quoting in the automated email: never a fixed number. Quote a band tied to
observable inputs — number of missing document categories, headcount, number
of platforms, deadline urgency — marked explicitly non-binding and confirmed
after a short call. A firm number generated from an unverified analysis is a
commitment we may not want to honour, and a band converts nearly as well.

## Regulatory content rules (important)
Any specific claim about what programs/certifications/deadlines are
required must be marked TODO-VERIFY and sourced to an actual regulation
(e.g. OSHA 29 CFR citation) where possible — never invented or presented
as certain. This is safety-adjacent content; getting it wrong misleads
small business owners about real compliance risk. When in doubt, keep
copy about *the process and value* (we help you find gaps fast, cheap,
without a consultant) rather than specific regulatory claims.

Under Scope B this extends to generated output. Two rules matter most, and
both are spelled out in CLAUDE.md under "Regulatory output rules":
- OSHA citations are retrieved from the eCFR API at generation time and
  confirmed to support the claim, never written from memory. A wrong CFR
  cite is worse than none — it looks authoritative and anyone in the industry
  can check it in a minute.
- OSHA and ISNetworld are not the same thing. ISN and Avetta requirements are
  contractual, set by the platform and the hiring client. Much of what ISN
  asks for — written program formats, EMR thresholds, insurance limits,
  client-specific questionnaires — has no OSHA basis at all. Never imply a
  citation proves an ISN requirement, or that satisfying ISN means OSHA
  compliance.

## How we're validating this (for context, not a build task)
Plan is to drive real people to this landing page (targeted search ads,
relevant LinkedIn/Facebook groups for EHS and contractors, direct
outreach) and watch for: form completions, document uploads (a high-trust
action, and now a built-in step rather than a manual one), replies to the
automated review, and eventually actual paid signups.
Kill criteria if signal is weak: revisit whether this niche is worth
pursuing before building further.

## Competitors / landscape (context, not exhaustive)
Existing options are mostly human consultants (e.g. OccuPros, JobQualified,
SafetyPro Resources — TODO-VERIFY names/positioning still accurate) and
some software players providing written-program templates or COI
tracking. None of the early research found a cheap, fast, self-serve gap
finder. Do not name specific competitors in the landing page copy.
