-- Payments that did not come from a card processor.
--
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- It is written to be safe to run more than once, and safe to run whether or
-- not 0018 has already been applied.
--
-- ## Why
--
-- 0018 assumed Stripe. Every US card processor has to verify the identity of
-- whoever receives the money — that is the Bank Secrecy Act's customer
-- identification rules, not a Stripe policy — and an operator who cannot
-- complete that verification cannot take cards at all.
--
-- They can still be paid. A bank transfer, a check, or any other arrangement
-- between two businesses needs no processor and no verification beyond having
-- a bank account, and invoicing is how most B2B work is paid for anyway. What
-- the product needs is a way to record that the money arrived, so the
-- entitlement follows from the ledger exactly as it does for a card.
--
-- So the table stops being Stripe-shaped: a payment has a source and a
-- reference, and Stripe is one source among others.

alter table public.purchases
  add column if not exists source text not null default 'stripe';

do $$
begin
  -- Renamed rather than duplicated: a column called stripe_session_id holding
  -- a bank-transfer reference is the kind of thing that misleads whoever
  -- reads this table next, and the unique constraint on it is exactly what
  -- makes a manual payment safe to record twice by mistake.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'purchases'
      and column_name = 'stripe_session_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'purchases'
      and column_name = 'payment_reference'
  ) then
    alter table public.purchases rename column stripe_session_id to payment_reference;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'purchases_source'
  ) then
    alter table public.purchases
      add constraint purchases_source check (source in ('stripe', 'manual'));
  end if;
end $$;

comment on column public.purchases.source is
  'Where the money came from. ''manual'' is a payment an operator confirmed '
  'by hand - a bank transfer or a check - and it grants exactly what a card '
  'payment grants.';

comment on column public.purchases.payment_reference is
  'Unique. For Stripe, the checkout session id. For a manual payment, an '
  'operator-supplied reference such as a bank transfer id. Unique either way, '
  'because recording the same payment twice is the mistake worth preventing.';
