-- Scope B intake submissions.
--
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- It is written to be safe to run more than once.
--
-- Security model, and how it differs from `leads`.
--
-- `leads` is insert-only for anonymous callers: one form, one row, nothing
-- read back. That works because a lead is written once and never touched
-- again. An intake is different — it is written across four steps, so the
-- server has to UPDATE a row it created earlier, and read it back to send
-- an analysis. Handing anonymous callers UPDATE on this table would let
-- anyone rewrite anyone else's submission by guessing an id.
--
-- So this table is closed to anon and authenticated entirely, and is only
-- ever touched server-side with the service role key, which bypasses RLS.
-- SUPABASE_SERVICE_ROLE_KEY is server-only and must never take a
-- NEXT_PUBLIC_ prefix.

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 'partial' until the last step is sent. A partial submission with an
  -- email address is still a lead worth calling, which is the whole reason
  -- each step is persisted as it is completed rather than at the end.
  status text not null default 'partial',
  last_step smallint not null default 1,

  -- Step 1. Captured first so an abandoned intake still leaves a contact.
  trade text not null,
  hiring_client text not null,
  platform text not null,
  deadline date,
  deadline_unknown boolean not null default false,
  contact_name text not null,
  email text not null,

  -- Step 2. All optional; "don't know" is a real answer, stored as such
  -- rather than as null, so a blank means "not reached" and not "unknown".
  headcount_band text,
  states text[],
  emr text,
  trir text,
  previously_registered text,

  -- Step 3. documents_held is the checklist; documents_unsure records the
  -- "not sure" answer, which is not the same as an empty list.
  documents_held text[],
  documents_unsure boolean not null default false,

  constraint submissions_status check (status in ('partial', 'complete')),
  constraint submissions_last_step check (last_step between 1 and 4),
  constraint submissions_trade_len check (char_length(trade) between 1 and 100),
  constraint submissions_hiring_client_len check (char_length(hiring_client) between 1 and 200),
  constraint submissions_platform_len check (char_length(platform) between 1 and 40),
  constraint submissions_contact_name_len check (char_length(contact_name) between 1 and 120),
  constraint submissions_email_len check (char_length(email) between 3 and 254),
  constraint submissions_email_shape check (email like '%_@_%.__%')
);

comment on table public.submissions is
  'Scope B gap-check intakes. Server-side only, via the service role key. '
  'Rows are written per step, so status = partial is expected and useful.';

create index if not exists submissions_created_at_idx
  on public.submissions (created_at desc);

-- ---------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------

alter table public.submissions enable row level security;
alter table public.submissions force row level security;

-- No policies at all, deliberately. Under RLS an operation with no matching
-- policy is denied, so anon and authenticated can do nothing here. The
-- service role bypasses RLS and is the only way in.

revoke all on public.submissions from anon, authenticated;

-- And granted explicitly to the service role rather than left to Supabase's
-- default privileges. Those normally cover it, but they depend on which role
-- created the table, and a missing grant here fails with "permission denied
-- for table submissions" — a privilege error, not an RLS one, which is easy
-- to misread as the wrong key being configured.
--
-- Note that service_role bypassing RLS does NOT mean it bypasses grants.
-- Those are separate mechanisms and the table privilege still has to exist.
grant all on public.submissions to service_role;

-- ---------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists submissions_touch_updated_at on public.submissions;

create trigger submissions_touch_updated_at
  before update on public.submissions
  for each row execute function public.touch_updated_at();
