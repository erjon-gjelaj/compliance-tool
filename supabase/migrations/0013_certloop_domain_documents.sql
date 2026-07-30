-- CertLoop domain rework: extraction evidence, classification, and versions.
-- Additive and safe to run more than once.

alter table public.submission_documents
  add column if not exists content_hash text,
  add column if not exists detected_mime_type text,
  add column if not exists page_count integer,
  add column if not exists extraction_status text not null default 'pending',
  add column if not exists extraction_method text,
  add column if not exists extraction_confidence numeric,
  add column if not exists extracted_text text,
  add column if not exists page_map jsonb not null default '[]'::jsonb,
  add column if not exists doc_type text not null default 'other',
  add column if not exists effective_date date,
  add column if not exists expiry_date date,
  add column if not exists issuing_party text,
  add column if not exists version_group_id uuid,
  add column if not exists version_n integer not null default 1,
  add column if not exists supersedes_document_id uuid
    references public.submission_documents (id) on delete set null;

update public.submission_documents
set detected_mime_type = mime_type
where detected_mime_type is null;

update public.submission_documents
set version_group_id = id
where version_group_id is null;

alter table public.submission_documents
  alter column detected_mime_type set not null,
  alter column version_group_id set not null,
  alter column version_group_id set default gen_random_uuid();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'submission_documents_hash_format'
  ) then
    alter table public.submission_documents
      add constraint submission_documents_hash_format
      check (content_hash is null or content_hash ~ '^[0-9a-f]{64}$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'submission_documents_extraction_status'
  ) then
    alter table public.submission_documents
      add constraint submission_documents_extraction_status
      check (extraction_status in
        ('pending','processing','ready','needs_review','unsupported','error'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'submission_documents_extraction_method'
  ) then
    alter table public.submission_documents
      add constraint submission_documents_extraction_method
      check (extraction_method is null or extraction_method in
        ('text','ocr','mixed','manual'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'submission_documents_doc_type'
  ) then
    alter table public.submission_documents
      add constraint submission_documents_doc_type
      check (doc_type in
        ('program','coi','osha_300','osha_300a','emr_letter',
         'training_roster','cert','license','msq_export','other'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'submission_documents_confidence'
  ) then
    alter table public.submission_documents
      add constraint submission_documents_confidence
      check (extraction_confidence is null or
        extraction_confidence between 0 and 1);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'submission_documents_page_count'
  ) then
    alter table public.submission_documents
      add constraint submission_documents_page_count
      check (page_count is null or page_count > 0);
  end if;
end $$;

create unique index if not exists submission_documents_submission_hash_unique
  on public.submission_documents (submission_id, content_hash)
  where content_hash is not null;

create unique index if not exists submission_documents_version_unique
  on public.submission_documents (version_group_id, version_n);

create index if not exists submission_documents_doc_type_idx
  on public.submission_documents (doc_type);

create index if not exists submission_documents_extraction_status_idx
  on public.submission_documents (extraction_status);

comment on column public.submission_documents.page_map is
  'Ordered extraction evidence per source page/image. Each item retains text, '
  'method, confidence, and review state for answer keys and parsers.';
