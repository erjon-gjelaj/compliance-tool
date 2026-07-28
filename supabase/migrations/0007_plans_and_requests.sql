-- Scope C: plan states and service requests.
--
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- It is written to be safe to run more than once.
--
-- Depends on 0006_companies.sql.
--
-- Two things, both preparation rather than product.
--
-- There is no billing here and no Stripe. This exists so that adding one later
-- is a matter of writing to a column that already governs behaviour, rather
-- than retrofitting a permission model into a product that never had one.
-- Everything is 'free' until a person changes it by hand in the dashboard.

-- ---------------------------------------------------------------------
-- Plan state on the company
-- ---------------------------------------------------------------------

alter table public.companies
  add column if not exists plan text not null default 'free';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'companies_plan'
  ) then
    alter table public.companies
      add constraint companies_plan check (plan in (
        'free',        -- everything shipped today
        'contractor',  -- paid, one company
        'consultant',  -- paid, many companies (see below)
        'admin'        -- us
      ));
  end if;
end $$;

comment on column public.companies.plan is
  'Set by hand today. No payment path exists and none is implied anywhere in '
  'the UI. See src/lib/entitlements.ts for what each state may do.';

-- ---------------------------------------------------------------------
-- Consultants: prepared, not built
-- ---------------------------------------------------------------------

-- A consultant is a person who manages several contractors' files. The whole
-- of that feature reduces to "one account, many companies", so the only thing
-- needed now is somewhere to record which account a company belongs to.
--
-- Null means the company belongs to the address on it, which is every row
-- today and every contractor thereafter. A contractor must never be shown a
-- workspace switcher for a workspace they do not have, so nothing reads this
-- column yet.
alter table public.companies
  add column if not exists managed_by_email text;

create index if not exists companies_managed_by_email_idx
  on public.companies (lower(managed_by_email));

comment on column public.companies.managed_by_email is
  'The consultant managing this company, if any. Null means the company is '
  'its own - which is every row today. Nothing reads this yet; it exists so '
  'that adding consultants is not a migration of live data.';

-- ---------------------------------------------------------------------
-- Service requests
-- ---------------------------------------------------------------------

-- Somebody asking for work that a person currently does by hand: a programme
-- prepared, a rejection corrected, a second opinion.
--
-- The honest version of a paywall. Rather than a checkout that does not exist
-- or a button that lies about what happens next, the intent is recorded, the
-- inbox is notified, and the person is told plainly that someone will reply.
create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- The address is the identity, as everywhere. company_id and submission_id
  -- are context and may be absent.
  email text not null,
  company_id uuid references public.companies (id),
  submission_id uuid references public.submissions (id) on delete set null,

  kind text not null,
  -- What they typed. The only place their own words about the job are kept.
  note text,

  status text not null default 'new',

  constraint service_requests_kind check (kind in (
    'document_preparation',  -- write or rewrite a programme for us
    'rejection_help',        -- help fixing something that came back
    'professional_review',   -- a qualified person to look at it
    'other'
  )),
  constraint service_requests_status check (status in (
    'new', 'in_progress', 'closed'
  )),
  constraint service_requests_email_len check (char_length(email) between 3 and 254),
  constraint service_requests_note_len
    check (note is null or char_length(note) <= 2000)
);

comment on table public.service_requests is
  'Work someone has asked for that is currently done by hand. No payment is '
  'taken and none is implied - this is a record of intent so a person can '
  'follow it up.';

create index if not exists service_requests_email_idx
  on public.service_requests (lower(email), created_at desc);

alter table public.service_requests enable row level security;
alter table public.service_requests force row level security;

revoke all on public.service_requests from anon, authenticated;
grant all on public.service_requests to service_role;
