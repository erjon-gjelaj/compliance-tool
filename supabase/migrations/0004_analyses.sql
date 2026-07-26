-- Scope B analysis pipeline.
--
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- It is written to be safe to run more than once.
--
-- Depends on 0002_submissions.sql and 0003_documents.sql.

-- ---------------------------------------------------------------------
-- Extracted document text
-- ---------------------------------------------------------------------

-- The text pulled out of an uploaded file, and how that went.
--
-- text_status is the important column. A scan with no text layer is not an
-- error and is not an empty document — it is a file we could not read, and
-- the response email has to say so out loud. Letting "unreadable" and
-- "nothing found" collapse into the same null is how silence ends up
-- implying "reviewed and fine".
alter table public.submission_documents
  add column if not exists extracted_text text,
  add column if not exists text_status text,
  add column if not exists extracted_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'submission_documents_text_status'
  ) then
    alter table public.submission_documents
      add constraint submission_documents_text_status
      check (text_status is null or text_status in (
        'ok',          -- text extracted normally
        'ocr',         -- no text layer; read by OCR, so treat with caution
        'unreadable',  -- no text layer and OCR could not read it either
        'unsupported', -- a format we have no extractor for
        'error'        -- extraction threw
      ));
  end if;
end $$;

comment on column public.submission_documents.text_status is
  'How extraction went. unreadable means the file was NOT assessed and must '
  'be listed as such in the response - never let silence imply it was fine.';

-- ---------------------------------------------------------------------
-- Model runs
-- ---------------------------------------------------------------------

-- Every model input and output, kept whether it succeeded or not.
--
-- This is the audit trail. The failure mode of an automated review is being
-- wrong instantly, at scale, and the only way to find out whether the
-- guardrails hold is to read what actually went out. A row here is written
-- before the email is sent, not after, so an output that broke the sender is
-- still on record.
create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null
    references public.submissions (id) on delete cascade,
  created_at timestamptz not null default now(),

  status text not null,
  model text not null,

  -- Verbatim, both directions. The prompt is stored per run rather than
  -- referenced by version, because the prompt is the thing under review and
  -- a run has to be readable without checking out the code that produced it.
  system_prompt text,
  user_prompt text,
  raw_output text,

  -- The validated object, or null when validation failed.
  result jsonb,

  error text,
  input_tokens integer,
  output_tokens integer,
  duration_ms integer,

  constraint analyses_status check (status in (
    'ok',              -- valid output, email sent from it
    'invalid_output',  -- model replied but the JSON failed the schema
    'model_error',     -- the API call itself failed
    'skipped'          -- not attempted (no API key configured)
  ))
);

comment on table public.analyses is
  'One row per model run against a submission, successful or not. This is '
  'the record of what the model was asked and what it said - read the first '
  'thirty closely.';

create index if not exists analyses_submission_id_idx
  on public.analyses (submission_id, created_at desc);

alter table public.analyses enable row level security;
alter table public.analyses force row level security;

-- No policies: anon and authenticated can do nothing here.
revoke all on public.analyses from anon, authenticated;
grant all on public.analyses to service_role;

-- ---------------------------------------------------------------------
-- Submission analysis state
-- ---------------------------------------------------------------------

alter table public.submissions
  add column if not exists analysis_status text,
  add column if not exists analysed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'submissions_analysis_status'
  ) then
    alter table public.submissions
      add constraint submissions_analysis_status
      check (analysis_status is null or analysis_status in (
        'pending', 'ok', 'fallback'
      ));
  end if;
end $$;

comment on column public.submissions.analysis_status is
  'fallback means the generic explainer email was sent instead of an '
  'analysis - the run is in the analyses table with the reason.';
