-- Requirement generation and auditable status transitions.

alter table public.companies
  add column if not exists legal_name text,
  add column if not exists dba text,
  add column if not exists ein text,
  add column if not exists address jsonb,
  add column if not exists employee_count integer,
  add column if not exists naics text[] not null default '{}',
  add column if not exists trade_codes text[] not null default '{}',
  add column if not exists scope_of_work text[] not null default '{}',
  add column if not exists competent_persons jsonb not null default '[]',
  add column if not exists safety_leadership jsonb not null default '[]',
  add column if not exists domain_profile jsonb not null default '{}'::jsonb;

create table if not exists public.company_platforms (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  platform_key text not null,
  subscription_status text not null default 'unknown',
  account_id text,
  next_revalidation_date date,
  unique(company_id, platform_key)
);

create table if not exists public.hiring_clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  platform_key text,
  connection_status text not null default 'unknown',
  grade_current text,
  grade_threshold text,
  grade_weighting jsonb,
  deadline date,
  requirement_source jsonb not null default '{}'::jsonb
);

create table if not exists public.requirement_sets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company_id uuid not null references public.companies(id) on delete cascade,
  hiring_client_id uuid references public.hiring_clients(id) on delete cascade,
  config_release text not null,
  generation_input jsonb not null,
  generation_cause text not null,
  supersedes_id uuid references public.requirement_sets(id) on delete set null
);

create table if not exists public.requirements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  requirement_set_id uuid not null references public.requirement_sets(id) on delete cascade,
  category_key text not null,
  requirement_key text not null,
  title text not null,
  status text not null default 'missing',
  applicability text not null,
  applicability_basis jsonb not null,
  due_date date,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  evidence_ids uuid[] not null default '{}',
  unique(requirement_set_id, requirement_key),
  constraint requirements_status check (status in
    ('missing','draft','submitted','under_review','accepted','rejected','expired')),
  constraint requirements_applicability check (applicability in
    ('included','unknown'))
);

create table if not exists public.requirement_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  requirement_id uuid not null references public.requirements(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_email text,
  note text
);

create index if not exists requirement_sets_company_idx
  on public.requirement_sets(company_id, created_at desc);
create index if not exists requirements_set_category_idx
  on public.requirements(requirement_set_id, category_key);

alter table public.company_platforms enable row level security;
alter table public.company_platforms force row level security;
alter table public.hiring_clients enable row level security;
alter table public.hiring_clients force row level security;
alter table public.requirement_sets enable row level security;
alter table public.requirement_sets force row level security;
alter table public.requirements enable row level security;
alter table public.requirements force row level security;
alter table public.requirement_events enable row level security;
alter table public.requirement_events force row level security;

revoke all on public.company_platforms, public.hiring_clients,
  public.requirement_sets, public.requirements, public.requirement_events
  from anon, authenticated;
grant all on public.company_platforms, public.hiring_clients,
  public.requirement_sets, public.requirements, public.requirement_events
  to service_role;
