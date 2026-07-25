-- Lead capture for the free gap check.
--
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- It is written to be safe to run more than once.
--
-- Security model: anyone on the internet may INSERT a lead through the
-- public API, and nobody may read, change, or delete one. Leads are read
-- from the Supabase dashboard, which bypasses RLS as the service role.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  trade text not null,
  hiring_client text not null,
  employee_count text not null,
  email text not null,
  created_at timestamptz not null default now(),

  -- Length caps: this table is writable by anonymous callers, so the
  -- database enforces its own limits rather than trusting the form.
  constraint leads_trade_len check (char_length(trade) between 1 and 100),
  constraint leads_hiring_client_len check (char_length(hiring_client) between 1 and 200),
  constraint leads_employee_count_len check (char_length(employee_count) between 1 and 20),
  constraint leads_email_len check (char_length(email) between 3 and 254),
  constraint leads_email_shape check (email like '%_@_%.__%')
);

comment on table public.leads is
  'Free gap-check requests from the landing page. Insert-only for public callers.';

-- ---------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------

alter table public.leads enable row level security;

-- Force RLS so it also applies to the table owner. Without this, a future
-- connection as the owning role would quietly bypass every policy below.
alter table public.leads force row level security;

drop policy if exists "Anyone can submit a lead" on public.leads;

create policy "Anyone can submit a lead"
  on public.leads
  for insert
  to anon, authenticated
  with check (true);

-- No SELECT, UPDATE, or DELETE policy exists, and that is deliberate.
-- Under RLS, an operation with no matching policy is denied, so those
-- three are already blocked for anon and authenticated callers.

-- Belt and braces: drop the underlying grants too. RLS alone is enough
-- today, but if someone later adds a broad "for all" policy by mistake,
-- the missing grants still keep reads and edits out.
revoke select, update, delete on public.leads from anon, authenticated;
grant insert on public.leads to anon, authenticated;

-- Note for whoever wires up code against this table: an insert cannot ask
-- for the row back, because that would require SELECT. Keep inserts at
-- "return nothing" (supabase-js does this by default unless .select() is
-- chained).
