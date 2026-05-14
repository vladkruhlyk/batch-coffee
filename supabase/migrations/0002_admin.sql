-- BATCH Coffee — admin role
--
-- Adds an owner/staff tier so the people who actually fulfil orders
-- can see every row in `orders` + `order_items` + `profiles`, not
-- just their own. Regular customers see no change.
--
-- Bootstrapping: after running this migration, flip the flag manually
-- for your own profile in the Supabase SQL Editor:
--
--     update public.profiles
--        set is_admin = true
--      where id = '<your-auth-user-uuid>';
--
-- The UUID is visible in Authentication → Users (the "ID" column).
-- We deliberately keep this out of any UI — admin status is set once
-- by the owner directly in the database. Adding more staff later =
-- another `update`.

-- ---------------------------------------------------------------
-- 1. is_admin column
-- ---------------------------------------------------------------

alter table public.profiles
  add column if not exists is_admin boolean default false not null;

-- ---------------------------------------------------------------
-- 2. Helper — true iff the calling user is an admin.
--
-- security definer + a pinned search_path so we can call this from
-- RLS policies without tripping over recursion (an admin policy on
-- `orders` calling back into a regular-user policy on `profiles`).
-- ---------------------------------------------------------------

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ---------------------------------------------------------------
-- 3. Admin RLS policies
--
-- Orders & order_items: admins see + update everything. Updates on
-- order_items aren't needed — line items are immutable snapshots —
-- so we only grant read there.
--
-- Profiles: admins see every profile (so the order detail page can
-- show the customer's name + email). They do NOT get update —
-- editing customer data should go through customer support flows,
-- not a free-for-all admin UI.
-- ---------------------------------------------------------------

drop policy if exists "orders: admin read all" on public.orders;
create policy "orders: admin read all" on public.orders
  for select using (public.is_current_user_admin());

drop policy if exists "orders: admin update all" on public.orders;
create policy "orders: admin update all" on public.orders
  for update using (public.is_current_user_admin());

drop policy if exists "order_items: admin read all" on public.order_items;
create policy "order_items: admin read all" on public.order_items
  for select using (public.is_current_user_admin());

drop policy if exists "profiles: admin read all" on public.profiles;
create policy "profiles: admin read all" on public.profiles
  for select using (public.is_current_user_admin());

-- ---------------------------------------------------------------
-- 4. Subscription visibility for admins
--
-- Same shape as orders — admins read everything so they can spot a
-- failing recurring charge. No update — subscription state belongs
-- to the customer (pause/cancel) or the cron job (status changes).
-- ---------------------------------------------------------------

drop policy if exists "subscriptions: admin read all" on public.subscriptions;
create policy "subscriptions: admin read all" on public.subscriptions
  for select using (public.is_current_user_admin());

drop policy if exists "subscription_cycles: admin read all"
  on public.subscription_cycles;
create policy "subscription_cycles: admin read all"
  on public.subscription_cycles
  for select using (public.is_current_user_admin());
