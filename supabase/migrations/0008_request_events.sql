-- Phase A: request state, derived from an event log.
--
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- It is written to be safe to run more than once.
--
-- Depends on 0007_plans_and_requests.sql.
--
-- The bug this fixes: a request still read "Waiting on us" after a reply had
-- been sent. `service_requests.status` was a stored label, set by hand, and
-- replies were sent from a mail client - outside the product entirely - so
-- nothing ever updated it.
--
-- Widening that column would not have fixed it. The fault is that the state
-- was STORED rather than DERIVED. Any stored label is a claim about the world
-- that goes stale the moment somebody acts outside the app.
--
-- So: an append-only log of things that happened, and a state computed from
-- it (src/lib/requests/state.ts). Nothing can go stale without an event being
-- missing, which is a visible bug rather than a silent wrong answer.

create table if not exists public.request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null
    references public.service_requests (id) on delete cascade,
  created_at timestamptz not null default now(),

  -- Who caused this. 'system' is for events nothing human triggered.
  actor text not null,

  kind text not null,

  -- Present on message events. This is the conversation.
  body text,

  /*
   * Only meaningful on a certloop_message: does this reply need something back
   * from the customer?
   *
   * It is the one judgement in the model that cannot be inferred. "We've sent
   * you a draft, no action needed" and "we need your EMR before we can carry
   * on" are both replies from us, and they leave the request in opposite
   * states. Asking the person writing the reply is more honest than guessing
   * from the text.
   */
  awaits_reply boolean not null default false,

  constraint request_events_actor check (actor in ('customer', 'certloop', 'system')),
  constraint request_events_kind check (kind in (
    'submitted',          -- they asked for something
    'customer_message',   -- they said something more
    'certloop_message',   -- we replied
    'in_review',          -- we picked it up
    'draft_ready',        -- something is ready for them to look at
    'completed',          -- the work is done
    'reopened',           -- it was not done after all
    'closed'              -- no further action, not necessarily delivered
  )),
  constraint request_events_body_len
    check (body is null or char_length(body) <= 4000)
);

comment on table public.request_events is
  'Append-only. The displayed status of a request is computed from these, '
  'never stored - see src/lib/requests/state.ts. Do not add an UPDATE path.';

create index if not exists request_events_request_id_idx
  on public.request_events (request_id, created_at);

alter table public.request_events enable row level security;
alter table public.request_events force row level security;

revoke all on public.request_events from anon, authenticated;
grant all on public.request_events to service_role;

-- ---------------------------------------------------------------------
-- Backfilling the requests that already exist
-- ---------------------------------------------------------------------

-- Every existing request was submitted, and that is the only thing we can say
-- about it for certain. Anything since happened over email, where this
-- database cannot see it.
--
-- Deliberately NOT inventing a reply event for rows whose old status was
-- 'in_progress'. That column was set by hand and is exactly the unreliable
-- thing being replaced; seeding the new log from it would carry the same bad
-- data forward wearing a better shape. A request that was genuinely replied to
-- will show as waiting on us until someone records the reply, which is a
-- visible, fixable wrong - and the honest starting point.
insert into public.request_events (request_id, created_at, actor, kind, body)
select r.id, r.created_at, 'customer', 'submitted', r.note
from public.service_requests r
where not exists (
  select 1 from public.request_events e where e.request_id = r.id
);

-- The old column stays for now, unread, rather than being dropped in the same
-- migration that stops using it. Dropping it would make rolling back this
-- deploy lossy for no benefit.
comment on column public.service_requests.status is
  'NO LONGER READ. State is derived from request_events. Kept only so this '
  'migration is reversible; remove once 0008 has been live for a while.';
