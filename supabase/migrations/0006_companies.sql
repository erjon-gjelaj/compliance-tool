-- Scope C: the company profile.
--
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- It is written to be safe to run more than once.
--
-- Depends on 0002_submissions.sql.
--
-- Why this exists: trade, states, headcount, platform and hiring client were
-- retyped on every submission, because a submission was the only record this
-- product had. A contractor sending a second request re-entered everything
-- they had already told us.
--
-- Identity here is the same as everywhere else in this project: the email
-- address on a submission. There is still no accounts table and no password —
-- see 039. One profile per address, which is why `email` is unique.
--
-- Closed to anon and authenticated entirely, like submissions. Reached only
-- server-side with the service role key.

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One profile per address. Case-insensitive uniqueness is enforced by the
  -- index below rather than here, since addresses were captured on a public
  -- form and the stored casing is whatever was typed.
  email text not null,

  -- The only field asked for up front. Everything else is optional and can be
  -- filled in later, or never.
  name text not null,

  website text,
  -- Where they are based, and where they actually work. Kept apart: a company
  -- in Texas working three states over is the normal case, not an edge one.
  home_state text,
  operating_states text[],
  trade text,
  headcount_band text,
  -- 'ISNetworld' | 'Avetta' | 'Both' | 'Not sure', same vocabulary as the
  -- intake form.
  platforms text,
  hiring_clients text[],
  -- Free text, in their words. This is NOT a hazard assessment and must never
  -- be presented as one - it is what the contractor told us they do.
  operations text,

  /*
   * Provenance, and why it is a column rather than a convention.
   *
   * Anything not typed by the contractor - a website found by searching, a
   * trade inferred from a company name - is stored with where it came from and
   * whether they have confirmed it. A company name reveals nothing about how a
   * crew actually works, and a profile that quietly promotes a guess to a fact
   * would put invented context underneath a compliance review.
   *
   * Shape: { "field": { "source": "inferred" | "client", "confirmedAt": ts } }
   * Absent means the contractor typed it. See src/lib/companies.ts.
   */
  field_sources jsonb not null default '{}'::jsonb,

  constraint companies_name_len check (char_length(name) between 1 and 200),
  constraint companies_email_len check (char_length(email) between 3 and 254),
  constraint companies_email_shape check (email like '%_@_%.__%'),
  constraint companies_website_len
    check (website is null or char_length(website) <= 300),
  constraint companies_operations_len
    check (operations is null or char_length(operations) <= 2000),
  constraint companies_platforms check (
    platforms is null
    or platforms in ('ISNetworld', 'Avetta', 'Both', 'Not sure')
  )
);

comment on table public.companies is
  'One profile per email address, reused across submissions. Anything not '
  'typed by the contractor is recorded in field_sources and must be shown for '
  'confirmation rather than treated as fact.';

-- Case-insensitive, because mail is. Without this, Sam@example.com and
-- sam@example.com would be two profiles and the dashboard would show one of
-- them arbitrarily.
create unique index if not exists companies_email_key
  on public.companies (lower(email));

alter table public.companies enable row level security;
alter table public.companies force row level security;

-- No policies, deliberately: under RLS an unpolicied operation is denied.
revoke all on public.companies from anon, authenticated;
grant all on public.companies to service_role;

drop trigger if exists companies_touch_updated_at on public.companies;

create trigger companies_touch_updated_at
  before update on public.companies
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Linking submissions to a profile
-- ---------------------------------------------------------------------

-- Nullable, and stays nullable. Every submission before this migration has no
-- profile, and an intake from someone who never fills one in is still a
-- complete, reviewable submission. The email on the row remains the thing that
-- proves ownership - this column is convenience, not identity.
alter table public.submissions
  add column if not exists company_id uuid references public.companies (id);

create index if not exists submissions_company_id_idx
  on public.submissions (company_id);

comment on column public.submissions.company_id is
  'Optional link to the profile. Ownership is still decided by the email on '
  'the submission, never by this column.';
