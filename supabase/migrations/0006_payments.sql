-- BATCH Coffee — payments table for WayForPay (and any future providers).
--
-- Every attempt to pay creates its own row. An order can have multiple
-- payment rows if the customer retries after a decline, abandons and
-- restarts, etc. The row's status tracks the provider's verdict:
--
--   pending   — created locally, customer hasn't completed the form
--   approved  — provider confirmed funds captured
--   declined  — provider rejected (insufficient funds, 3DS fail, etc)
--   expired   — provider abandoned (customer didn't finish in time)
--   refunded  — initiated by us via a refund API call
--
-- Webhook writes happen from the API route running with the service-role
-- key, bypassing RLS. Customer-facing reads are gated by the same
-- "own order" rule as the orders table.

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  -- Provider name — keeps the schema open if we add LiqPay / Monobank
  -- later. Indexed for analytics queries.
  provider text not null default 'wayforpay',
  -- Reference WE send to the provider as `orderReference`. Provider
  -- enforces uniqueness, so two attempts for the same order get a
  -- fresh suffix (e.g. BAT-1042-3f9c…). Unique here too as belt-and-
  -- braces.
  provider_order_ref text not null unique,
  status text not null default 'pending'
    check (status in ('pending','approved','declined','expired','refunded')),
  amount integer not null,
  currency text not null default 'UAH',
  -- Last raw payload the provider returned (callback or status query).
  -- jsonb so we can dig out card_pan / authCode etc without re-parsing.
  raw_response jsonb,
  -- Human-readable failure reason from the provider when status != approved.
  failure_reason text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists payments_order_id_idx on public.payments(order_id);
create index if not exists payments_status_idx on public.payments(status);
create index if not exists payments_provider_idx on public.payments(provider);

-- updated_at trigger — same shape as the other tables.
drop trigger if exists payments_touch on public.payments;
create trigger payments_touch
  before update on public.payments
  for each row execute function public.touch_updated_at();

alter table public.payments enable row level security;

-- Customers read payments tied to orders they own.
drop policy if exists "payments: read own" on public.payments;
create policy "payments: read own" on public.payments
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = payments.order_id
        and o.user_id = auth.uid()
    )
  );

-- Admins read every payment.
drop policy if exists "payments: admin read all" on public.payments;
create policy "payments: admin read all" on public.payments
  for select using (public.is_current_user_admin());

-- No insert/update policies for anyone — payments are written only by
-- the service-role key inside our API routes. RLS blocks every other
-- path by design.
