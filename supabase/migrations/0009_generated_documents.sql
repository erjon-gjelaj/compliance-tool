-- Phase D: generated safety programs.
--
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- It is written to be safe to run more than once.
--
-- Depends on 0006_companies.sql and 0007_plans_and_requests.sql.
--
-- Two tables, because a document and a version of a document are different
-- things. `generated_documents` is "this company has a Hazard Communication
-- program"; `generated_document_versions` is "here is edition 3 of it, made
-- on this date from these answers".
--
-- Splitting them is what makes revision honest. When a hiring client rejects
-- version 2 and we issue version 3, version 2 does not disappear - the
-- contractor may have already submitted it somewhere else, and being able to
-- say exactly what was sent and when is the point of keeping history at all.

create table if not exists public.generated_documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Identity is the email, as everywhere in this project.
  email text not null,
  company_id uuid references public.companies (id),

  -- Which template. Matches a ProgramTemplate id in src/lib/programs.
  program_id text not null,

  -- Where it came from, when it came from somewhere. Both nullable: a
  -- contractor may simply decide they need a program.
  submission_id uuid references public.submissions (id) on delete set null,
  request_id uuid references public.service_requests (id) on delete set null,

  -- Context worth keeping on the document rather than only on the company,
  -- because a company's platform can change after a document is issued and
  -- the document should still say what it was prepared for.
  platform text,
  hiring_client text,

  constraint generated_documents_email_len
    check (char_length(email) between 3 and 254),
  constraint generated_documents_program_len
    check (char_length(program_id) between 1 and 60)
);

comment on table public.generated_documents is
  'One row per program a company holds. The files live in versions.';

create index if not exists generated_documents_email_idx
  on public.generated_documents (lower(email), created_at desc);

-- One live program of each kind per company. A second Hazard Communication
-- program for the same company is a new VERSION, never a second document -
-- otherwise a contractor ends up with two and no way to know which is current.
create unique index if not exists generated_documents_one_per_program
  on public.generated_documents (lower(email), program_id);

alter table public.generated_documents enable row level security;
alter table public.generated_documents force row level security;
revoke all on public.generated_documents from anon, authenticated;
grant all on public.generated_documents to service_role;

drop trigger if exists generated_documents_touch on public.generated_documents;
create trigger generated_documents_touch
  before update on public.generated_documents
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Versions
-- ---------------------------------------------------------------------

create table if not exists public.generated_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null
    references public.generated_documents (id) on delete cascade,
  created_at timestamptz not null default now(),

  -- 1, 2, 3 - what the customer sees on the cover.
  version integer not null,

  -- Which edition of the template produced this. A correction to our prose
  -- means finding every version generated from the old one, which is not
  -- possible without recording it.
  template_version text not null,

  -- Exactly what was answered. This is what makes a regeneration reproducible
  -- and what a revision starts from, rather than asking everything again.
  answers jsonb not null,

  -- Paths in the private documents bucket. Both are written before the row is,
  -- so a version row always has files behind it.
  docx_path text not null,
  pdf_path text not null,

  effective_date date not null,

  -- Set when a later version supersedes this one. Kept rather than deleted:
  -- the contractor may already have submitted it, and history is the point.
  superseded_at timestamptz,

  -- Why a revision was made. Null on a first issue.
  revision_reason text,

  constraint generated_versions_version check (version >= 1),
  constraint generated_versions_reason_len
    check (revision_reason is null or char_length(revision_reason) <= 4000)
);

comment on table public.generated_document_versions is
  'Every edition ever issued. Superseded rows are kept - a contractor may '
  'have already submitted one, and being able to say what was sent is the '
  'whole reason for history.';

create unique index if not exists generated_versions_unique
  on public.generated_document_versions (document_id, version);

create index if not exists generated_versions_document_idx
  on public.generated_document_versions (document_id, version desc);

alter table public.generated_document_versions enable row level security;
alter table public.generated_document_versions force row level security;
revoke all on public.generated_document_versions from anon, authenticated;
grant all on public.generated_document_versions to service_role;

-- ---------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------

-- A separate bucket from submission-documents. Those are the customer's own
-- uploads, held under a consent they gave for a stated purpose; these are
-- files we produced for them. Different origin, different retention story,
-- and mixing them would make a deletion request harder to reason about.
--
-- Private, like the other one. Every read is a short-lived signed URL minted
-- server-side after ownership has been checked.
insert into storage.buckets
  (id, name, public, file_size_limit, allowed_mime_types)
values (
  'generated-documents',
  'generated-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No policies for anon or authenticated, deliberately. Nothing in a browser
-- session can list or read this bucket on its own.
