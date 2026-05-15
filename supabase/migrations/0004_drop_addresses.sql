-- BATCH Coffee — drop the addresses book
--
-- Customer "address book" turned out to be the wrong abstraction for
-- the Ukrainian market: customers ship to a Nova Poshta branch /
-- postomat, not to a home street address. When (if) we revisit, the
-- schema will look different — a list of saved NP branches per user,
-- not generic "Дім / Робота / Інше" entries. Easier to drop and
-- design fresh later than to keep stale code + a half-fitting table.
--
-- Safe to run: nothing else references this table. `orders` keeps the
-- delivery address inline as plain text on the order row.

drop policy if exists "addresses: read own" on public.addresses;
drop policy if exists "addresses: insert own" on public.addresses;
drop policy if exists "addresses: update own" on public.addresses;
drop policy if exists "addresses: delete own" on public.addresses;

drop index if exists public.addresses_one_default_per_user;
drop index if exists public.addresses_user_id_idx;

drop table if exists public.addresses;
