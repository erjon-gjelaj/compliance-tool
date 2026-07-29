-- Task 065: model-assisted revisions.
--
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- It is written to be safe to run more than once.
--
-- Depends on 0009_generated_documents.sql.
--
-- Until now a version was fully described by its answers: the same answers
-- and the same template produced the same sections every time, so there was
-- nothing to store but the inputs. A revision breaks that. The document a
-- customer holds after a revision is not a function of their answers any
-- more, and regenerating from those answers would silently undo the change.
--
-- So the sections themselves are stored from now on. `answers` stays, because
-- it is still what a regeneration and the next revision start from, and
-- because it is the only record of what the customer actually told us.

alter table public.generated_document_versions
  add column if not exists sections jsonb;

comment on column public.generated_document_versions.sections is
  'The document as rendered, section by section. Null on versions issued '
  'before this column existed - those are still reproducible from answers.';

-- How this version came to exist. `assembled` is the deterministic path:
-- template plus answers, no model involved. `revised` means a language model
-- proposed the change - see src/lib/programs/revise-analysis.ts.
--
-- Stored rather than inferred from revision_reason being non-null, because
-- those are different facts: a revision requested before this feature existed
-- has a reason and was still assembled deterministically.
alter table public.generated_document_versions
  add column if not exists source text not null default 'assembled';

alter table public.generated_document_versions
  drop constraint if exists generated_versions_source;

alter table public.generated_document_versions
  add constraint generated_versions_source
  check (source in ('assembled', 'revised'));

-- What the model said it changed, in its own words, one entry per change.
-- Kept for the audit trail rather than for display: if a customer ever asks
-- why their document differs from the one they answered questions for, this
-- and revision_reason are the record.
alter table public.generated_document_versions
  add column if not exists revision_summary jsonb;

-- Which model produced it, so a bad revision can be traced to a model and a
-- date rather than to "the AI". Null on every assembled version.
alter table public.generated_document_versions
  add column if not exists revised_by_model text;

comment on column public.generated_document_versions.revised_by_model is
  'Model id that proposed this revision. Null when source = assembled.';
