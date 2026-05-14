-- BATCH Coffee — admin UX enhancements
--
-- Two additions to support the richer order detail page + customer
-- timeline:
--   1. orders.internal_note — staff-only field that never leaves the
--      admin UI. Useful for things like "called customer, wants pickup
--      on Saturday" without polluting the customer-visible comment.
--   2. order_status_events — append-only log of every status change.
--      Filled automatically by a trigger so we can't forget. Visible
--      to the customer (so the order tracking page can show progress)
--      and to admins.

-- ---------------------------------------------------------------
-- 1. internal_note column
-- ---------------------------------------------------------------

alter table public.orders
  add column if not exists internal_note text;

-- ---------------------------------------------------------------
-- 2. order_status_events
-- ---------------------------------------------------------------

create table if not exists public.order_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  -- Nullable because the very first event has no "from" — the order was
  -- just created. We use null for that case rather than e.g. 'pending'
  -- so the UI can render "Створено" instead of "pending → pending".
  from_status public.order_status,
  to_status public.order_status not null,
  -- Whoever flipped it. Null for system-driven changes (cron job,
  -- webhook). Set-null on profile delete so we don't lose the event.
  changed_by uuid references public.profiles(id) on delete set null,
  -- Optional human note attached to the change, e.g. "delayed —
  -- waiting for restock". Reserved for the future; UI doesn't ask
  -- for it yet.
  note text,
  created_at timestamptz default now() not null
);

create index if not exists order_status_events_order_id_idx
  on public.order_status_events(order_id);

-- ---------------------------------------------------------------
-- 3. Trigger — log every status change automatically.
--
-- Fires after UPDATE on orders when `status` changes. Also covers the
-- "created" row by listening on INSERT and recording a null → status
-- pair (useful for the timeline's first item).
-- ---------------------------------------------------------------

create or replace function public.log_order_status_change()
returns trigger language plpgsql
security definer set search_path = public
as $$
begin
  if (TG_OP = 'INSERT') then
    insert into public.order_status_events (
      order_id, from_status, to_status, changed_by
    ) values (new.id, null, new.status, auth.uid());
    return new;
  end if;

  -- UPDATE — only log if status actually moved.
  if new.status is distinct from old.status then
    insert into public.order_status_events (
      order_id, from_status, to_status, changed_by
    ) values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists log_order_status_change on public.orders;
create trigger log_order_status_change
  after insert or update on public.orders
  for each row execute function public.log_order_status_change();

-- ---------------------------------------------------------------
-- 4. RLS for order_status_events
-- ---------------------------------------------------------------

alter table public.order_status_events enable row level security;

-- Customers see events for orders they own. Mirrors the read-own
-- policy on the parent orders table.
drop policy if exists "order_status_events: read own"
  on public.order_status_events;
create policy "order_status_events: read own"
  on public.order_status_events
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_status_events.order_id
        and o.user_id = auth.uid()
    )
  );

-- Admins see every event — feeds the timeline on /admin/orders/[id].
drop policy if exists "order_status_events: admin read all"
  on public.order_status_events;
create policy "order_status_events: admin read all"
  on public.order_status_events
  for select using (public.is_current_user_admin());

-- Inserts are trigger-only (the trigger runs as SECURITY DEFINER so
-- it bypasses RLS anyway). We deliberately don't expose any insert
-- policy here — staff can't fabricate fake events from the UI.
