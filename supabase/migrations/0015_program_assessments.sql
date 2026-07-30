-- Element scoring and answer keys over versioned document evidence.

create table if not exists public.program_assessments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  document_id uuid not null references public.submission_documents(id) on delete cascade,
  program_key text not null,
  config_release text not null,
  evaluator_version text not null,
  element_results jsonb not null,
  reviewer_corrections jsonb not null default '[]'::jsonb,
  unique(document_id, program_key, config_release, evaluator_version)
);

create table if not exists public.answer_keys (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  assessment_id uuid not null references public.program_assessments(id) on delete cascade,
  program_key text not null,
  question_version text not null,
  verification_state text not null default 'unknown',
  items jsonb not null,
  unique(assessment_id, question_version)
);

alter table public.program_assessments enable row level security;
alter table public.program_assessments force row level security;
alter table public.answer_keys enable row level security;
alter table public.answer_keys force row level security;
revoke all on public.program_assessments, public.answer_keys
  from anon, authenticated;
grant all on public.program_assessments, public.answer_keys to service_role;
