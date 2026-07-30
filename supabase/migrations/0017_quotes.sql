-- Stored quote versions and explicit acceptance. No payment data or processor.

alter table public.request_events drop constraint if exists request_events_kind;
alter table public.request_events add constraint request_events_kind check (kind in (
  'submitted','customer_message','certloop_message','quoted','quote_accepted',
  'in_review','draft_ready','completed','delivered','reopened','closed'
));

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  version integer not null,
  currency text not null,
  total_minor integer not null,
  line_items jsonb not null,
  terms text not null,
  expires_at timestamptz not null,
  sent_at timestamptz,
  supersedes_id uuid references public.quotes(id) on delete set null,
  accepted_at timestamptz,
  accepted_by_email text,
  accepted_terms_hash text,
  unique(request_id, version),
  constraint quotes_total_nonnegative check (total_minor >= 0),
  constraint quotes_currency check (currency ~ '^[A-Z]{3}$')
);

create unique index if not exists quotes_one_acceptance_per_request
  on public.quotes(request_id) where accepted_at is not null;

alter table public.quotes enable row level security;
alter table public.quotes force row level security;
revoke all on public.quotes from anon, authenticated;
grant all on public.quotes to service_role;

comment on table public.quotes is
  'Versioned scope and price records ending in stored acceptance. This table '
  'contains no checkout, payment credential, processor id, or charge state.';
