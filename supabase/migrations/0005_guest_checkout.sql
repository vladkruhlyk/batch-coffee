-- BATCH Coffee — guest checkout: order view tokens + RPC.
--
-- The existing RLS policy `orders: read own` lets a logged-in customer
-- see their own orders via auth.uid() = user_id. Guests have no user_id,
-- so any read-by-anon would either need to expose all anon orders
-- (`null = null` enumeration) or piggyback on a per-order secret.
--
-- We go with the secret. Every order gets a random hex view_token at
-- creation time and the URL we hand back becomes /order/BAT-1234?token=…
-- A SECURITY DEFINER function exchanges (number + token) for the row,
-- bypassing RLS in a controlled way: only when the secret matches.
--
-- Side-effects: the RPCs also serve owners (auth.uid match) and admins
-- (is_current_user_admin), so the customer-facing /order/[number] page
-- can use one path regardless of who's logged in.

-- ---------------------------------------------------------------
-- 1. view_token column on orders
-- ---------------------------------------------------------------

alter table public.orders
  add column if not exists view_token text;

-- Backfill — old test orders need tokens too, otherwise the new RPC
-- would refuse to serve them even with the right URL.
update public.orders
   set view_token = encode(gen_random_bytes(16), 'hex')
 where view_token is null;

alter table public.orders
  alter column view_token set default encode(gen_random_bytes(16), 'hex');
alter table public.orders
  alter column view_token set not null;

-- ---------------------------------------------------------------
-- 2. RPCs for /order/[number] viewing
--
-- Three small functions — order header, line items, status events —
-- each accepting an optional token. SECURITY DEFINER bypasses table
-- RLS but the WHERE clause inside still enforces "must be owner OR
-- admin OR token matches". Search_path pinned to public to keep the
-- functions safe to grant EXECUTE on the anon role.
-- ---------------------------------------------------------------

create or replace function public.get_order_for_view(
  p_number text,
  p_token text default null
) returns setof public.orders
language sql
stable
security definer
set search_path = public
as $$
  select *
    from public.orders
   where number = p_number
     and (
       user_id = auth.uid()
       or public.is_current_user_admin()
       or (p_token is not null and view_token = p_token)
     )
   limit 1;
$$;

create or replace function public.get_order_items_for_view(
  p_order_id uuid,
  p_token text default null
) returns setof public.order_items
language sql
stable
security definer
set search_path = public
as $$
  select oi.*
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
   where oi.order_id = p_order_id
     and (
       o.user_id = auth.uid()
       or public.is_current_user_admin()
       or (p_token is not null and o.view_token = p_token)
     )
   order by oi.created_at asc;
$$;

create or replace function public.get_order_events_for_view(
  p_order_id uuid,
  p_token text default null
) returns setof public.order_status_events
language sql
stable
security definer
set search_path = public
as $$
  select e.*
    from public.order_status_events e
    join public.orders o on o.id = e.order_id
   where e.order_id = p_order_id
     and (
       o.user_id = auth.uid()
       or public.is_current_user_admin()
       or (p_token is not null and o.view_token = p_token)
     )
   order by e.created_at asc;
$$;

-- Anon role needs EXECUTE so non-logged-in customers can hit the RPCs
-- via supabase-js. The SECURITY DEFINER body remains the actual gate.
grant execute on function public.get_order_for_view(text, text) to anon, authenticated;
grant execute on function public.get_order_items_for_view(uuid, text) to anon, authenticated;
grant execute on function public.get_order_events_for_view(uuid, text) to anon, authenticated;
