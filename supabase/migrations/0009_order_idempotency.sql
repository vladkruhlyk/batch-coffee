-- BATCH Coffee — idempotent order creation
--
-- Problem: POST /api/orders/create had no idempotency. A network retry,
-- double-click, or page reload mid-submit created 2-5 duplicate orders
-- with duplicate charges and burned sequence numbers.
--
-- Fix: the checkout client generates a random key per order intent and
-- sends it with the request. The server stores it on the order row; this
-- partial UNIQUE index makes a replayed insert fail with 23505, which the
-- route catches and answers with the ORIGINAL order instead of creating a
-- duplicate.
--
-- Safe to run any time: the column is nullable, and the API degrades
-- gracefully (inserts without the key) until this migration is applied.

alter table public.orders
  add column if not exists idempotency_key text;

create unique index if not exists orders_idempotency_key_uniq
  on public.orders (idempotency_key)
  where idempotency_key is not null;
