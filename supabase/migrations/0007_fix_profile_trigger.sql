-- BATCH Coffee — fix the auto-create-profile trigger
--
-- Symptom: auth.users had 5 rows but public.profiles was empty. New
-- signups (phone OTP) created an auth user but no matching profile,
-- which breaks onboarding (UPDATE hits 0 rows), admin grants (no row
-- to flip is_admin on), and order creation (orders.user_id FKs into
-- profiles).
--
-- Root cause: the on_auth_user_created trigger from 0001_init.sql was
-- not present on auth.users (dropped, or never applied on this hosted
-- project). This migration recreates the function + trigger idempotently
-- and backfills any auth.users that are missing a profile.
--
-- Safe to run multiple times.

-- ---------------------------------------------------------------
-- 1. (Re)create the function
-- ---------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, phone, email)
  values (new.id, new.phone, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------
-- 2. (Re)attach the trigger
-- ---------------------------------------------------------------

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------
-- 3. Backfill — any auth.users without a profile gets one now.
--    (The app already backfilled via the service-role client, but
--     running it here keeps the migration self-sufficient.)
-- ---------------------------------------------------------------

insert into public.profiles (id, phone, email)
select u.id, u.phone, u.email
  from auth.users u
  left join public.profiles p on p.id = u.id
 where p.id is null;
