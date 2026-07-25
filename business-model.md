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

## What we're building right now (Scope A only)
NOT the actual compliance-checking tool yet. Just a landing page that:
1. States the problem in language this exact buyer would recognize
2. Offers a free "tell us your trade and hiring client, we'll show you
   what you're missing" intake form
3. Captures the lead (email + trade + hiring client + company size)
No automated gap-analysis logic exists yet — leads collected here will
be followed up with manually (see "how we validate" below).

## Draft pricing model (for later — do not build billing yet)
- Free: intake + general gap overview
- ~$299 one-time: get "submission ready" (human-assisted in this phase)
- ~$39/month: ongoing renewal/deadline tracking
TODO-VERIFY: pricing is a first guess from early research, not tested.
Do not present this as fixed/final in copy — frame as indicative if
shown at all (and per CLAUDE.md, don't build a pricing section yet).

## Regulatory content rules (important)
Any specific claim about what programs/certifications/deadlines are
required must be marked TODO-VERIFY and sourced to an actual regulation
(e.g. OSHA 29 CFR citation) where possible — never invented or presented
as certain. This is safety-adjacent content; getting it wrong misleads
small business owners about real compliance risk. When in doubt, keep
copy about *the process and value* (we help you find gaps fast, cheap,
without a consultant) rather than specific regulatory claims.

## How we're validating this (for context, not a build task)
Plan is to drive real people to this landing page (targeted search ads,
relevant LinkedIn/Facebook groups for EHS and contractors, direct
outreach) and watch for: form completions, manual safety-document
uploads (a high-trust action), and eventually actual paid signups.
Kill criteria if signal is weak: revisit whether this niche is worth
pursuing before building further.

## Competitors / landscape (context, not exhaustive)
Existing options are mostly human consultants (e.g. OccuPros, JobQualified,
SafetyPro Resources — TODO-VERIFY names/positioning still accurate) and
some software players providing written-program templates or COI
tracking. None of the early research found a cheap, fast, self-serve gap
finder. Do not name specific competitors in the landing page copy.
