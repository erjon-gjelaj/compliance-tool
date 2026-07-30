# Path to a first commercial release

Written 2026-07-28, after Scope C stages 1-6 shipped (tasks 046-051).

## Audit: what is actually finished

Judged by "a subcontractor could rely on it", not by "a route exists".

| Area | State | What is actually missing |
| --- | --- | --- |
| Public website | **Done** | Pricing is absent by decision; needs adding as preliminary. |
| Onboarding | **Partial** | Four doors exist. Nothing connects a first submission to a company profile. |
| Company profile | **Done** | Not yet used by the analysis or by generation. |
| Dashboard | **Partial** | Reads as a landing page: one long scroll, no navigation, no persistent structure. |
| Free gap check | **Done** | — |
| Rejection submission | **Done** | Deterministic reader ships; paid "full analysis" is undefined. |
| Requests for review | **Broken** | Status is a manual label and goes stale. No conversation at all. |
| Messaging / replies | **Missing** | There is no way for either side to reply in the product. |
| Reports | **Done** | Hierarchy fixed in 050. |
| Document library | **Done** | Uploads, generated versions, and customer-supplied maintenance dates. |
| Document generation | **Done** | Controlled Word/PDF programs with revisions and version history. |
| Plans / entitlements | **Partial** | `can()` exists; nothing calls it. No admin way to grant a plan. |
| Pricing presentation | **Missing** | No prices anywhere, public or private. |
| Paid workflow | **Partial** | Intent is captured; no order, no quote, no fulfilment. |
| Consultant support | **Done** | Plan-gated client invitations, workspace switching, and eligible export branding. |
| Admin workflow | **Weak** | Read-only submissions list. No way to reply, set a stage, or grant a plan. |
| Email notifications | **Partial** | Submission and service request only. Nothing on reply or delivery. |
| Empty states | **Done** | — |
| Status handling | **Broken** | See below. This is the reported bug. |
| Mobile | **Partial** | Marketing pages fine; dashboard never checked at width. |

## The status bug, and what causes it

`service_requests.status` is a column with three values, set by hand and never
updated. It said "Waiting on us" after a reply had been sent, because nothing
in the product knows a reply happened — replies are sent from a mail client,
outside the system entirely.

A wider status vocabulary on the same column would not fix it. The fault is
that state is *stored* rather than *derived*: any stored label is a claim about
the world that goes stale the moment someone acts outside the app.

So the fix is an append-only `request_events` log, with the displayed state
computed from it. An event is a fact about something that happened; the state
is a function of those facts. Nothing can go stale without an event being
missing, which is a visible bug rather than a silent one.

## Phases

Each ships on its own branch and leaves the product working.

- **Phase A (task 055) — request state and conversation.** Events table,
  derived state, in-product replies both ways, admin console to act. Fixes the
  reported bug and unblocks everything that shows a status.
- **Phase B (task 056) — dashboard as an application.** Persistent left
  navigation, an operational overview, one status treatment used everywhere,
  mobile checked.
- **Phase C (task 057) — plans, pricing and orders.** Configurable pricing,
  entitlements actually enforced, one-time service orders with a quoted range,
  admin grants access by hand. No Stripe, no fake checkout.
- **Phase D (task 058) — document generation.** Template model, section
  classification, Word and PDF output, versions, library. See the constraint
  below.
- **Phase E (task 053) — maintenance.** Expiry and review dates, but only ones
  the customer gave us.

## The document generation constraint, stated plainly

The brief settles the architecture — controlled templates, conditional
sections, no unrestricted generation — and that removes the question task 040
was blocked on. It does not remove the other one.

Standard policy language for a safety programme *is* regulatory content. This
repo may not author it as fact (CLAUDE.md), and may not generate it with a
model (the no-LLM rule). Both still hold, and a generated manual is the
document a contractor hands their hiring client, so they hold harder here than
anywhere else in the product.

Phase D therefore builds the whole pipeline and ships it behind a flag, with
templates whose prose is explicitly marked as unreviewed draft. The flag is
lifted per programme, by a person, once the prose for that programme has been
written or reviewed by someone qualified. Building the pipeline is not blocked.
Putting its output in front of a customer is, and that gate is in the code
rather than in a note.

## Pricing

Stored as configuration (`src/lib/pricing.ts`), not scattered through logic,
because these numbers are assumptions that will move after real customers.
Presented publicly as early-access pricing. One-time services and a maintenance
plan both, since a contractor with one urgent rejection is not a subscriber.
