-- Scope B document uploads.
--
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- It is written to be safe to run more than once.
--
-- Depends on 0002_submissions.sql.
--
-- Two things live here: a private storage bucket for the files themselves,
-- and a table recording what was uploaded against which submission. Like
-- `submissions`, both are closed to anon and authenticated entirely and are
-- only reached server-side with the service role key.
--
-- Uploaded documents are the most sensitive thing this project holds. They
-- are a contractor's own safety paperwork, handed over on the understanding
-- that we use them to prepare their review and nothing else. Everything
-- below follows from that.

-- ---------------------------------------------------------------------
-- Consent, recorded on the submission
-- ---------------------------------------------------------------------

-- A timestamp rather than a boolean, so the record says when they agreed and
-- not merely that they did. Null means no documents were uploaded — consent
-- is only asked for when there is something to consent to.
alter table public.submissions
  add column if not exists documents_consent_at timestamptz;

comment on column public.submissions.documents_consent_at is
  'When the uploader ticked the consent box on the upload step. Null when no '
  'documents were uploaded.';

-- ---------------------------------------------------------------------
-- The uploaded files
-- ---------------------------------------------------------------------

create table if not exists public.submission_documents (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null
    references public.submissions (id) on delete cascade,
  created_at timestamptz not null default now(),

  -- Path within the bucket. Unique so a replayed confirmation cannot record
  -- the same object twice.
  storage_path text not null unique,

  -- The name as it arrived, kept only so the review can refer to the file the
  -- way its owner does. It is never used to build the storage path.
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null,

  constraint submission_documents_file_name_len
    check (char_length(file_name) between 1 and 255),
  constraint submission_documents_size
    check (size_bytes between 1 and 10485760)
);

comment on table public.submission_documents is
  'Documents uploaded against a gap-check intake. The files themselves are in '
  'the private submission-documents storage bucket; this table records what '
  'is there. Deleting a submission cascades to these rows, but NOT to the '
  'storage objects - see deleteSubmission in src/lib/documents.ts.';

create index if not exists submission_documents_submission_id_idx
  on public.submission_documents (submission_id);

alter table public.submission_documents enable row level security;
alter table public.submission_documents force row level security;

-- No policies, deliberately: under RLS an unpolicied operation is denied, so
-- anon and authenticated can do nothing here.
revoke all on public.submission_documents from anon, authenticated;

-- Granted explicitly rather than left to default privileges, for the reason
-- recorded in 0002: service_role bypassing RLS does not mean it bypasses
-- grants, and a missing grant fails with a message that reads like a
-- misconfigured key.
grant all on public.submission_documents to service_role;

-- ---------------------------------------------------------------------
-- The storage bucket
-- ---------------------------------------------------------------------

-- Private. `public` false means there is no readable URL for an object in
-- here at all; the only way to read one is a signed URL minted server-side
-- with a short expiry.
--
-- The size and MIME limits are set on the bucket as well as checked in the
-- application. That matters because uploads go straight from the browser to
-- Supabase rather than through our server (see requestUploadSlots), so the
-- bucket is the last line that a client cannot talk its way past.
--
-- The allow-list is documents and photographs only. Anything not named here
-- is refused by storage itself, which is what keeps executables and archives
-- out.
insert into storage.buckets
  (id, name, public, file_size_limit, allowed_mime_types)
values (
  'submission-documents',
  'submission-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'image/png',
    'image/jpeg',
    'image/heic',
    'image/heif'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No storage policies are created for anon or authenticated, so no browser
-- session can list, read, write or delete objects in this bucket on its own.
-- Every upload uses a signed upload URL minted server-side for one specific
-- path, and every read uses a short-lived signed URL.
