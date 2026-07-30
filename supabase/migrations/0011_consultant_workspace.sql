-- Task 052: consultant workspaces and client invitations.
--
-- Depends on 0007_plans_and_requests.sql.
-- Safe to run more than once.

alter table public.companies
  add column if not exists consultant_brand_name text,
  add column if not exists invited_at timestamptz,
  add column if not exists accepted_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'companies_consultant_brand_name_len'
  ) then
    alter table public.companies
      add constraint companies_consultant_brand_name_len
      check (
        consultant_brand_name is null
        or char_length(consultant_brand_name) between 1 and 120
      );
  end if;
end $$;

comment on column public.companies.consultant_brand_name is
  'Optional consultancy name printed as Prepared by on generated exports. '
  'Only read when the managing account has white_label capability.';

comment on column public.companies.invited_at is
  'When the managing consultant most recently sent the owner an invitation.';

comment on column public.companies.accepted_at is
  'When the owner first opened a valid invitation and established a session.';
