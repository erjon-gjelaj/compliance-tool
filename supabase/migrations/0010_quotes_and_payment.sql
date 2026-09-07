-- The money path, as events rather than as columns.
--
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- It is written to be safe to run more than once.
--
-- Depends on 0008_request_events.sql.
--
-- What was missing: `service_requests` recorded that somebody asked for work
-- and carried no price at all. Nothing in the product knew what a customer
-- had been quoted or what they had agreed to, so every sale lived in one
-- person's head and in a mail client.
--
-- The obvious fix is a `quoted_amount` column and an `accepted` boolean. That
-- would reintroduce exactly the bug 0008 was written to remove: a stored
-- claim about the world that goes stale the moment anyone acts outside the
-- app, and no record of when or how it became true. A quote is not a property
-- of a request. It is something that HAPPENED to a request, on a date, by
-- somebody, possibly more than once - a revised quote is a second quote, not
-- an edit of the first.
--
-- So quoting, accepting, declining and being paid are events like every other
-- event, and the state stays derived (src/lib/requests/state.ts).

-- ---------------------------------------------------------------------
-- 1. The amounts
-- ---------------------------------------------------------------------

-- Whole US dollars, not cents. Every price in this product is a RANGE from
-- src/lib/pricing.ts ("$149-$299"), quoted before the work is scoped, and
-- nothing here ever computes tax or takes a payment - the invoice happens
-- outside. Storing cents would imply a precision this data does not have.
--
-- Both nullable because only a 'quoted' event carries them.
alter table public.request_events
  add column if not exists amount_low integer;

alter table public.request_events
  add column if not exists amount_high integer;

-- ---------------------------------------------------------------------
-- 2. The new kinds
-- ---------------------------------------------------------------------

-- Postgres has no "add value to a check constraint", so the constraint is
-- dropped and rewritten. Safe to re-run: the drop is conditional and the
-- rewrite is the full list.
alter table public.request_events
  drop constraint if exists request_events_kind;

alter table public.request_events
  add constraint request_events_kind check (kind in (
    'submitted',          -- they asked for something
    'customer_message',   -- they said something more
    'certloop_message',   -- we replied
    'in_review',          -- we picked it up
    'draft_ready',        -- something is ready for them to look at
    'completed',          -- the work is done
    'reopened',           -- it was not done after all
    'closed',             -- no further action, not necessarily delivered
    'quoted',             -- we told them a price
    'quote_accepted',     -- they said yes
    'quote_declined',     -- they said no
    'payment_recorded'    -- money arrived, recorded by hand
  ));

-- ---------------------------------------------------------------------
-- 3. Amounts belong to quotes and nowhere else
-- ---------------------------------------------------------------------

-- Without this, a reply could carry a price that no screen would ever show
-- and no state would ever react to - a number sitting in the database looking
-- authoritative and meaning nothing. The low <= high check is here rather
-- than in TypeScript because it has to hold for rows written by hand in the
-- SQL editor too, which is how an operator will fix a mistyped quote.
alter table public.request_events
  drop constraint if exists request_events_amounts;

alter table public.request_events
  add constraint request_events_amounts check (
    case
      when kind = 'quoted' then
        amount_low is not null
        and amount_high is not null
        and amount_low >= 0
        and amount_high >= amount_low
      else
        amount_low is null and amount_high is null
    end
  );

comment on column public.request_events.amount_low is
  'Whole US dollars. Only ever set on a quoted event - see the '
  'request_events_amounts constraint. The pair is a range, not a total.';

-- ---------------------------------------------------------------------
-- 4. The plan column keeps working the way it already does
-- ---------------------------------------------------------------------

-- No change to companies.plan. It already exists from 0007 and is read
-- through lib/entitlements. What changes in this task is only that an
-- operator can set it from a screen instead of from the SQL editor, which
-- needs no schema at all.

comment on table public.request_events is
  'Append-only. The displayed status of a request is computed from these, '
  'never stored - see src/lib/requests/state.ts. Do not add an UPDATE path. '
  'Quotes, acceptance and payment are events here too, for the same reason.';
