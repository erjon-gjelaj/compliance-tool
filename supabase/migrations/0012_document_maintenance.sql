-- Task 053: customer-supplied expiry and review reminders.
--
-- Depends on 0003_documents.sql and 0009_generated_documents.sql.
-- Safe to run more than once.

create table if not exists public.document_maintenance (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Copied from the authorized active workspace. It is the access-control
  -- filter used by every read and write.
  email text not null,

  uploaded_document_id uuid
    references public.submission_documents (id) on delete cascade,
  generated_document_id uuid
    references public.generated_documents (id) on delete cascade,

  -- Snapshot for a useful reminder even if a source filename changes.
  document_name text not null,
  kind text not null,
  due_date date not null,
  note text,

  constraint document_maintenance_one_target check (
    (uploaded_document_id is not null)::integer
    + (generated_document_id is not null)::integer = 1
  ),
  constraint document_maintenance_kind check (
    kind in ('expiry', 'review')
  ),
  constraint document_maintenance_email_len
    check (char_length(email) between 3 and 254),
  constraint document_maintenance_name_len
    check (char_length(document_name) between 1 and 255),
  constraint document_maintenance_note_len
    check (note is null or char_length(note) <= 500)
);

create unique index if not exists document_maintenance_uploaded_kind
  on public.document_maintenance (uploaded_document_id, kind)
  where uploaded_document_id is not null;

create unique index if not exists document_maintenance_generated_kind
  on public.document_maintenance (generated_document_id, kind)
  where generated_document_id is not null;

create index if not exists document_maintenance_email_due
  on public.document_maintenance (lower(email), due_date);

alter table public.document_maintenance enable row level security;
alter table public.document_maintenance force row level security;
revoke all on public.document_maintenance from anon, authenticated;
grant all on public.document_maintenance to service_role;

drop trigger if exists document_maintenance_touch
  on public.document_maintenance;
create trigger document_maintenance_touch
  before update on public.document_maintenance
  for each row execute function public.touch_updated_at();

comment on table public.document_maintenance is
  'Expiry and review dates supplied by the customer. No date in this table '
  'is inferred from a document, platform, or regulation.';
