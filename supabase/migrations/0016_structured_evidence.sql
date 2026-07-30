-- Structured parser outputs. Source page evidence remains in each record.

create table if not exists public.insurance_coverages (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.submission_documents(id) on delete cascade,
  coverage_type text not null,
  carrier text,
  policy_number text,
  eff_date date,
  exp_date date,
  each_occurrence numeric,
  general_aggregate numeric,
  products_comp_op numeric,
  additional_insured boolean,
  waiver_of_subrogation boolean,
  primary_noncontributory boolean,
  notice_of_cancellation_days integer,
  evidence jsonb not null,
  unique(document_id, coverage_type, policy_number)
);

create table if not exists public.safety_statistics (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.submission_documents(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  report_year integer not null,
  hours_worked numeric,
  recordable_incidents integer,
  dart_cases integer,
  lost_time_cases integer,
  fatalities integer,
  trir numeric,
  dart numeric,
  ltir numeric,
  reported_trir numeric,
  reported_dart numeric,
  reported_ltir numeric,
  reconciliation jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  unique(company_id, report_year)
);

create table if not exists public.training_records (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.submission_documents(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  program_key text,
  training_date date,
  instructor_name text,
  instructor_signature boolean,
  attendees jsonb not null default '[]'::jsonb,
  source text,
  evidence jsonb not null,
  constraint training_records_source check
    (source is null or source in ('toolbox_talk','formal','vendor'))
);

create table if not exists public.employee_credentials (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_name text not null,
  credential_key text not null,
  certificate_number text,
  issued_date date,
  expiry_date date,
  document_id uuid references public.submission_documents(id) on delete set null
);

alter table public.insurance_coverages enable row level security;
alter table public.insurance_coverages force row level security;
alter table public.safety_statistics enable row level security;
alter table public.safety_statistics force row level security;
alter table public.training_records enable row level security;
alter table public.training_records force row level security;
alter table public.employee_credentials enable row level security;
alter table public.employee_credentials force row level security;
revoke all on public.insurance_coverages, public.safety_statistics,
  public.training_records, public.employee_credentials from anon, authenticated;
grant all on public.insurance_coverages, public.safety_statistics,
  public.training_records, public.employee_credentials to service_role;
