-- BATCH Coffee — order_status_events: add the guest read branch
--
-- The read policy from 0003 only matched `o.user_id = auth.uid()`,
-- missing the guest variant `(o.user_id is null and auth.uid() is null)`
-- that order_items has (0001_init.sql). So a guest reading their own
-- order's status timeline via plain RLS got nothing — they fell back
-- entirely to the view_token RPC. This makes the policy symmetric with
-- order_items and the comment that claimed it "mirrors the parent".
--
-- Low-risk: widens read access only to a guest viewing a guest order
-- (both user_id and auth.uid() null), which is the same surface
-- order_items already exposes. Safe to run multiple times.

drop policy if exists "order_status_events: read own"
  on public.order_status_events;

create policy "order_status_events: read own"
  on public.order_status_events
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_status_events.order_id
        and (
          o.user_id = auth.uid()
          or (o.user_id is null and auth.uid() is null)
        )
    )
  );
