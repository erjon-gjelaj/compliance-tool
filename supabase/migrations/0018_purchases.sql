-- Self-serve payment.
--
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- It is written to be safe to run more than once.
--
-- Depends on 0006_companies.sql.
--
-- Until now the money path ran through a person: a quote was written by hand,
-- a payment was recorded by hand, and a plan was granted by hand. This table
-- is what replaces all three. Stripe takes the money, tells us once, and the
-- entitlement follows from the row written here.
--
-- ## Why a table rather than a column
--
-- `companies.plan` says what somebody may do *now*. It cannot say what they
-- paid, when, for what, or against which Stripe object — and every one of
-- those is needed the first time somebody disputes a charge or asks for a
-- receipt. The plan stays as the thing the application reads on every
-- request; this is the record it is derived from.
--
-- ## Idempotency is the whole design
--
-- Stripe delivers a webhook at least once, and will redeliver on any non-2xx
-- response, on a timeout, and sometimes for no reason at all. So the unique
-- constraint on the Stripe session id is load bearing: a replayed event
-- writes nothing the second time, and fulfilment is safe to run again.

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Identity is the email, as everywhere in this project. Taken from the
  -- session metadata we set, never from what the buyer typed into Stripe:
  -- the entitlement must land on the account that started the checkout, not
  -- on whatever address they happened to pay with.
  email text not null,
  company_id uuid references public.companies (id),

  -- What they bought. Matches an id in src/lib/billing/catalog.ts.
  product_id text not null,

  -- Stripe's own identifiers, so any row here can be reconciled against the
  -- dashboard without guessing.
  stripe_session_id text not null unique,
  stripe_payment_intent text,
  stripe_customer_id text,

  -- Recorded in the smallest currency unit, exactly as Stripe reports it.
  -- Storing dollars as a float is how a total ends up at 198.99999999.
  amount_cents integer not null,
  currency text not null default 'usd',

  -- 'paid' is the only state that grants anything. 'refunded' is written by
  -- the refund webhook and deliberately keeps the row: a refunded purchase is
  -- part of the history, and deleting it would make the ledger disagree with
  -- Stripe.
  status text not null default 'paid',

  constraint purchases_email_len check (char_length(email) between 3 and 254),
  constraint purchases_product_len check (char_length(product_id) between 1 and 60),
  constraint purchases_amount check (amount_cents >= 0),
  constraint purchases_status check (status in ('paid', 'refunded'))
);

comment on table public.purchases is
  'Completed Stripe payments. companies.plan is derived from these rows; '
  'this is the record, that is the cache.';

comment on column public.purchases.stripe_session_id is
  'Unique. Stripe delivers webhooks at least once, and this is what makes '
  'replaying one a no-op rather than a second entitlement.';

create index if not exists purchases_email_idx
  on public.purchases (lower(email), created_at desc);

-- Closed to the browser entirely, like everything else that matters here.
-- Only the service role, server-side, ever touches it.
alter table public.purchases enable row level security;
alter table public.purchases force row level security;
revoke all on public.purchases from anon, authenticated;
grant all on public.purchases to service_role;
