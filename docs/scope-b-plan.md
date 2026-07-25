# CertLoop — Scope B plan: automated gap response, intake redesign, go-to-market
 
Three parts: (1) the prompt to hand Claude Code, (2) the flow redesign reasoning,
(3) distribution and positioning.
 
---
 
## PART 1 — Prompt for Claude Code
 
Paste everything between the lines.
 
---
 
**Context:** You are working in the CertLoop repo. Read `CLAUDE.md`,
`business-model.md`, `AGENTS.md`, and `tasks.json` before doing anything.
 
**Important — this expands documented scope.** `CLAUDE.md` currently says
"SCOPE A ONLY … do not attempt to build smart compliance logic." We are
deliberately moving to Scope B. Your FIRST task is to update `CLAUDE.md`
and `business-model.md` to reflect the new scope, in a separate commit,
so the repo docs and the code don't contradict each other. Do not silently
build against instructions the repo still forbids.
 
**Goal:** Extend the existing landing page so that a submitted intake produces
an automated, emailed preliminary gap analysis, and captures enough information
to quote a price.
 
### Scope B deliverables
 
1. **Expanded intake form** (multi-step, not one long page — this audience is
   non-technical and on mobile at a job site):
   - Step 1: trade (select), hiring client name (free text), platform
     (ISNetworld / Avetta / both / not sure), deadline (date or "unknown")
   - Step 2: headcount band, states of operation, EMR and TRIR if known
     (both optional, with "don't know" as a first-class answer), whether they
     have ever been registered before
   - Step 3: checklist — which written programs / documents they already have
     (checkbox list, plus "not sure")
   - Step 4: optional document upload (PDF/DOCX/images, max ~10 files, size
     capped), plus email and name
   - Every step after step 1 must be skippable. Email capture must happen even
     if they abandon later steps — persist partial submissions.
2. **Document handling** (uploads carry real obligations — treat as sensitive):
   - Store in Supabase Storage in a private bucket, never public URLs
   - Signed URLs only, short expiry
   - Server-side validation of MIME type and size; reject executables/archives
   - Record consent explicitly at upload: a checkbox stating documents are used
     only to prepare their review, plus a retention statement
   - Implement a hard-delete path (`deleteSubmission(id)`) that removes rows and
     storage objects, so a deletion request can be honoured
   - Add a short privacy page and link it from the upload step
3. **Analysis pipeline** (server-side, on submission):
   - Extract text from uploaded documents (pdf parsing + docx parsing; if a file
     is a scan with no text layer, mark it "unreadable — not assessed" rather
     than guessing)
   - Call the Anthropic API with a structured prompt (see constraints below)
   - Require **structured JSON output**, not prose. Schema roughly:
     `{ summary, items: [{ requirement, status: "present"|"likely_missing"|"unknown",
     confidence: "high"|"medium"|"low", basis, action }], questionsForClient[],
     priceBand, unreadableFiles[] }`
   - Validate the JSON against the schema; on validation failure, fall back to
     the safe generic explainer email rather than sending malformed output
4. **Response email** (auto-sent to the client; also send a full copy to the
   internal address):
   - Render the JSON into a clean, readable HTML email
   - Header must state plainly: this is a **preliminary automated review**, not
     a certified audit, and items should be confirmed with their hiring client
   - Group items by confidence. Low-confidence items render as *questions*
     ("Confirm whether X applies to you"), never as assertions
   - List unreadable/unassessed files explicitly — never let silence imply
     "reviewed and fine"
   - End with a single CTA to book a call / reply to proceed
   - Price shown as an **indicative band**, explicitly non-binding
5. **Guardrails in the model prompt — non-negotiable:**
   - Never invent a regulation, CFR citation, platform requirement, or deadline.
     If unsure, emit the item with `status: "unknown"` and put it in
     `questionsForClient`
   - Never state what a *specific named hiring client* requires unless it is
     present in the reference data; client-specific requirements default to
     `unknown`
   - Never assert that a contractor IS or IS NOT compliant, or that they will
     pass or fail
   - Prefer omission over speculation; an empty section is acceptable
   - Cite the basis for each item (document reviewed, or the client's own
     checkbox answer). Items with no basis must be low confidence
6. **Reference data seam:** create `lib/requirements/` with a typed, versioned
   data file (start nearly empty, with clear TODO-VERIFY markers) representing
   known requirements by trade × platform. The model prompt must be instructed
   to prefer this data over its own knowledge. This file is the long-term moat —
   design it to be hand-edited by a non-developer.
7. **Internal ops:**
   - Notify internal email/Slack on every submission
   - Simple internal-only page listing submissions with their generated analysis,
     protected by a shared secret in env (no auth system)
   - Log every model input/output to the DB for later review — this is how we
     learn what the model gets wrong
8. **OSHA citation verification (retrieval, not recall):**
   Any OSHA reference in the output must be **retrieved from the eCFR API at
   generation time**, never produced from the model's memory. Base URL
   `https://www.ecfr.gov` — public, no API key, no auth. Relevant scope is
   29 CFR 1910 (general industry) and 29 CFR 1926 (construction).
   Pipeline for every item the model wants to attach a citation to:
   - Model proposes a citation (e.g. `29 CFR 1910.147`)
   - Server fetches that section from eCFR and confirms it exists and is current
   - Server passes the **retrieved text** back and asks the model to confirm the
     section actually supports the stated requirement
   - If the section does not exist, does not resolve, or does not support the
     claim → **strip the citation and downgrade the item to `status: "unknown"`**.
     Never send an unverified citation. A wrong CFR cite is worse than none —
     it looks authoritative and is trivially checkable by anyone in the industry.
   - Cache retrieved sections locally; the CFR changes rarely and the API should
     not be hit per-submission for the same section
   Add to the JSON schema: `items[].citations: [{ cfr, title, verifiedAt,
   supportsClaim: boolean }]`. Render only verified citations in the email.
   **Important framing constraint — do not conflate OSHA with ISNetworld.**
   ISNetworld and Avetta requirements are *contractual*, set by the platform and
   the hiring client. They overlap with OSHA but are not the same thing, and
   plenty of what ISN asks for (written program formats, EMR thresholds, insurance
   limits, client-specific questionnaires) has no OSHA basis at all. The email
   must therefore separate:
   - "Required by OSHA" — verified citation attached
   - "Commonly requested by ISNetworld/Avetta" — from our reference data,
     marked as our understanding, not law
   - "Specific to your hiring client" — default `unknown`, ask them to confirm
   Never imply an OSHA citation proves an ISN requirement. Conversely, never
   imply satisfying ISN means OSHA compliance.
   This verification must run on **every** submission, automatically. It is not
   a stand-in for manual review of early drafts — manual review will stop, the
   retrieval check must not.
### Constraints
- Follow all existing `CLAUDE.md` ground rules: branch per task, PR against
  main, `npm run build` and `npm run lint` clean before marking done, log to
  `logs/<date>.md`, update `tasks.json`, no emoji, `SITE_NAME` constant, no
  secrets committed. `ANTHROPIC_API_KEY` and Supabase service keys go in
  `.env.local` only, and must only ever be used server-side.
- Keep the existing visual identity — do not redesign the page.
- Do not build billing, auth, or user accounts.
- Rate-limit the submission endpoint and add basic spam protection; each
  submission costs money.
- If anything fails twice, mark the task blocked with a note and stop.
### Definition of done
Working end-to-end locally with a test submission (with and without uploads),
graceful degradation when the model call fails, build and lint clean, PR opened,
docs and `tasks.json` updated.
 
---
 
## PART 2 — Should the flow change? Yes.
 
**Short answer: uploads are the right call, mainly for a reason other than accuracy.**
 
Uploading your safety documents is a high-trust action. It is the single best
qualifying signal you can collect — someone who uploads six PDFs is a real buyer;
someone who types an email is a browser. Your own `business-model.md` already
names manual document uploads as a validation signal. So the upload step earns
its place even before the analysis is any good.
 
**Accuracy-wise it also flips the problem.** Without documents, the model is
guessing what a contractor might be missing. With documents, a large part of the
job becomes *reading what's there and diffing it against a list* — a much more
tractable and defensible task than recalling requirements from memory. Note the
asymmetry, though: "you have a written LOTO program, here it is" is verifiable
from the upload; "you need one" is not. Lean the output toward what the documents
prove and what the client told you, and keep everything else as questions.
 
**On pricing:** don't quote a fixed number automatically. Quote a band tied to
observable inputs — number of missing document categories, headcount, number of
platforms, deadline urgency. A firm number generated from an unverified analysis
is a commitment you may not want to honour. A band plus "confirmed after a
15-minute call" converts nearly as well and costs you nothing.
 
**The friction tradeoff.** A four-step form will convert lower than a four-field
form. That is fine and probably desirable right now — you cannot manually service
hundreds of leads, and a longer form filters for urgency. But protect against the
downside: capture email early, persist partials, and make every step skippable.
A partial submission with an email address is still a lead you can call.
 
**One thing to watch.** Since the analysis now auto-sends, the failure mode moved
from "slow" to "wrong, instantly, at scale." The mitigations that matter are in
the prompt above: confidence labelling, questions instead of assertions, honest
framing as preliminary, and logging every output so you can audit what went out.
Read the first ~30 logs closely — that is where you'll find out whether the
guardrails hold, and it costs you nothing to look.
 
---
 
## PART 3 — Distribution and positioning
 
### The positioning instinct is right
 
"We're reworking how contractors get approved in ISNetworld, without a
$3,000 consultant" is a strong line because it names a villain the audience
already resents and a process they already find absurd. Keep the mechanism
concrete — *a 24-hour automated review instead of a 30-45 day consultant
engagement* — rather than abstract ("streamlining compliance").
 
Two adjustments. First, be careful about attacking consultants too hard: some of
your best referral sources are adjacent to that world, and plenty of contractors
have a consultant they like. Attack the **cost and the timeline**, not the
people. Second, verify the consultant price range before putting a number in
public copy — `business-model.md` has it marked TODO-VERIFY, and a wrong number
is easy for an insider to call out.
 
### The rule that makes posts not read like marketing
 
Lead with information that is useful whether or not they click. If the post is
only valuable as a gateway to your link, it reads as an ad no matter how it's
worded. Concretely:
 
- Post the **actual answer** in the post. No "link in comments for the full list."
- Write from a **named person**, not a brand account. This audience does not
  trust logos.
- Say what you **don't** know. "I'm building this and I still can't figure out
  why Client X asks for Y" invites correction, and correction is engagement.
- **Answer other people's questions ten times before posting your own thing once.**
  This is the whole game in contractor forums.
- Never post the same text in two places. It gets spotted immediately.
### Where to post
 
**Highest value, lowest volume**
- Facebook groups for industrial contractors, welders, scaffolding, insulation.
  Search for groups with "ISNetworld" in recent posts — they exist and are
  full of exactly this complaint.
- r/safetyprofessionals, r/construction, r/Welding, r/HVAC — Reddit is harsh on
  self-promotion but rewards genuinely detailed answers. Build comment history
  first.
- LinkedIn: EHS managers and contractor-management coordinators are actually
  active here, unlike the contractors themselves.
**Where the buyers actually are**
- Local/regional trade association chapters (ABC, NECA, local contractor
  associations). Offer a free 30-minute talk: "getting through ISNetworld
  without a consultant." Associations are perpetually short of speakers.
- Turnaround and outage season creates a hard seasonal spike in demand — time
  pushes around scheduled turnarounds at large sites in your region.
- Industrial trade shows and safety conferences — expensive, but one afternoon
  of conversations with EHS coordinators is worth a month of cold email.
**Search (run this first, it converts fastest)**
- Bottom-funnel ads and pages on the exact phrases: "ISNetworld requirements for
  [trade]", "how much does ISNetworld cost", "ISNetworld RAVS review", "Avetta
  vs ISNetworld", "ISNetworld grade red what to do".
### Three post formats that work
 
1. **The teardown.** "Here's every document a scaffolding sub was asked for by a
   Gulf Coast refinery, and which ones actually blocked approval." Specific,
   verifiable, immediately useful. Anonymise the contractor.
2. **The correction magnet.** Post your reference list of what a trade needs and
   ask what's wrong with it. Experts cannot resist fixing a public list — you get
   free domain research and credibility simultaneously.
3. **The build-in-public note.** "I'm building a tool to do this in 24 hours
   instead of 30 days. Here's what I've learned about why it takes 30 days."
   Honest, non-salesy, and gives people a reason to follow rather than buy.
### Sequencing
 
1. Ship the Scope B flow and read the first 30 auto-sent analyses closely
2. Turn on bottom-funnel search ads — fastest real leads
3. Start answering questions in groups (no links) while ads run
4. Begin referrer outreach to contractor-management coordinators in parallel
5. Only scale spend once you've seen what the automated output actually says
---
 
*Nothing in this file has been applied to the repo. It's a plan, not a change.*