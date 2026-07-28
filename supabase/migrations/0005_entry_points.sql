-- Scope C: which door a submission came in through.
--
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- It is written to be safe to run more than once.
--
-- Depends on 0002_submissions.sql.
--
-- Four ways people arrive: a rejected document, a client telling them to
-- register, not knowing what they hold, or needing a safety manual. They were
-- all funnelled through one form that assumed the third. This records which
-- one it actually was, so the review and the dashboard can lead with what the
-- person came for.
--
-- Deliberately a column and not a table. A rejection is a submission with
-- rejection context on it — same documents, same analysis, same ownership
-- rules. Splitting it out would have duplicated all four.

alter table public.submissions
  add column if not exists entry_reason text not null default 'gap_check',
  add column if not exists rejection_notes text;

-- The slugs are the contract between the database and src/lib/entry-points.ts.
-- Constrained rather than free text so a typo in a route fails at the insert
-- instead of quietly creating a fifth kind of submission nothing handles.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'submissions_entry_reason'
  ) then
    alter table public.submissions
      add constraint submissions_entry_reason
      check (entry_reason in ('rejection', 'setup', 'gap_check', 'documents'));
  end if;
end $$;

-- Length capped in the database as well as the form. Everything on this table
-- arrives from a public endpoint, so the limit lives where it cannot be
-- talked past. 5000 fits a whole pasted reviewer comment block.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'submissions_rejection_notes_len'
  ) then
    alter table public.submissions
      add constraint submissions_rejection_notes_len
      check (rejection_notes is null or char_length(rejection_notes) <= 5000);
  end if;
end $$;

comment on column public.submissions.entry_reason is
  'Which entry point this came from. Existing rows default to gap_check, '
  'which is what they were - the single form that predated the other three.';

comment on column public.submissions.rejection_notes is
  'What the reviewer sent back, pasted by the contractor. This is the ONLY '
  'account of a rejection we have: nothing here reads a private ISNetworld or '
  'Avetta portal, and no output may imply otherwise.';

-- Rows existing before this migration came through the single gap-check form,
-- so the default is accurate rather than a placeholder. No backfill needed.
