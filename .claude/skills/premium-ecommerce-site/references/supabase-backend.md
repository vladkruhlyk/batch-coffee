# Supabase Backend — BATCH Coffee (Next.js 16) Reference Digest

Source root: `/Users/vladkruhlyk/Documents/GitHub/git-batch-coffee/web`. Migrations in `supabase/migrations/0001–0009`, clients in `src/lib/supabase/`, auth store `src/lib/auth-store.ts`, SMS hook `src/app/api/auth/send-sms/route.ts` + `src/lib/smsclub.ts`, scripts in `scripts/`.

## Env vars (exact names)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (browser-safe, RLS-protected), `SUPABASE_SERVICE_ROLE_KEY` (server-only, optional export — admin client throws if missing), `SUPABASE_SMS_HOOK_SECRET` (`whsec_…` from Supabase hook UI), `SMSCLUB_API_TOKEN`, `SMSCLUB_SENDER_ID`, `SUPABASE_DB_URL` (direct Postgres for migration runner). `src/lib/supabase/env.ts` validates once at import via a `required(name, value)` thrower and re-exports typed constants.

## Schema by migration

**0001_init.sql**
- Enums: `order_status` (`pending|paid|packing|shipped|delivered|cancelled`), `delivery_method` (`novaposhta-branch|novaposhta-postomat|pickup`), `payment_method` (`card|cod`), `subscription_status` (`active|paused|cancelled`).
- `profiles`: `id uuid PK references auth.users(id) on delete cascade`, `phone text`, `first_name`, `last_name`, `email`, `newsletter boolean default true not null`, `created_at/updated_at timestamptz default now()`. Index on `phone`.
- `orders`: `id uuid default gen_random_uuid()`, `number text not null unique` (human "BAT-0142", trigger-generated), `user_id uuid references profiles(id) on delete set null` (nullable → guest), `status order_status default 'pending'`, money as **integer** (`subtotal`, `delivery_fee default 0`, `discount default 0`, `total`), `delivery_method`, `delivery_address text not null` (inline text, no address book), `delivery_city`, `payment_method`, `recipient_first_name/last_name/phone not null`, `recipient_email`, `comment`, `tracking_number`. Indexes: `user_id`, `status`, `created_at desc`.
- `order_items`: snapshot of product at purchase time (why: rename/price change keeps history correct): `order_id on delete cascade`, `product_slug`, `product_name`, `thumb`, `weight_label`, `weight_grams int`, `roast`, `grind`, `unit_price int`, `quantity int check (quantity > 0)`, `line_total int`.
- `subscriptions` / `subscription_cycles`: `interval_days check (>= 7)`, `next_date timestamptz`, `payment_token` (provider recurring token), partial index `on subscriptions(next_date) where status = 'active'`.
- Order number trigger (sequence-backed so concurrent inserts don't collide):
```sql
create sequence if not exists public.order_number_seq start 1000;
create or replace function public.set_order_number() returns trigger language plpgsql as $$
begin
  if new.number is null then
    new.number := 'BAT-' || lpad(nextval('public.order_number_seq')::text, 4, '0');
  end if;
  return new;
end; $$;
create trigger set_order_number before insert on public.orders for each row execute function public.set_order_number();
```
- `touch_updated_at()` trigger fn (`new.updated_at := now()`), attached `before update` on profiles, orders, subscriptions (and payments in 0006).
- `handle_new_user` — auto-create profile on signup:
```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql
security definer set search_path = public as $$
begin
  insert into public.profiles (id, phone, email)
  values (new.id, new.phone, new.email)
  on conflict (id) do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
```

**0002_admin.sql** — `profiles.is_admin boolean default false not null`. Helper (SECURITY DEFINER + pinned search_path explicitly to avoid RLS recursion when an orders policy reads profiles):
```sql
create or replace function public.is_current_user_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;
```
Admin policies: `orders: admin read all` + `orders: admin update all` (`for update using (public.is_current_user_admin())`), read-only admin policies on `order_items`, `profiles`, `subscriptions`, `subscription_cycles`. Deliberately no admin update on profiles/order_items. All `drop policy if exists` then `create` (idempotency convention for every migration).

**0003_admin_enhancements.sql** — `orders.internal_note text` (staff-only). `order_status_events`: `order_id cascade`, `from_status order_status` (**nullable**: first event is null→status so UI renders "Створено" not "pending→pending"), `to_status not null`, `changed_by uuid references profiles on delete set null` (null = system/webhook), `note text`, `created_at`. Append-only via trigger:
```sql
create or replace function public.log_order_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (TG_OP = 'INSERT') then
    insert into public.order_status_events (order_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, auth.uid());
    return new;
  end if;
  if new.status is distinct from old.status then
    insert into public.order_status_events (order_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end; $$;
create trigger log_order_status_change after insert or update on public.orders
  for each row execute function public.log_order_status_change();
```
No INSERT policy at all on events — trigger is SECURITY DEFINER so bypasses RLS; staff can't fabricate events.

**0004_drop_addresses.sql** — drops the address book. Lesson: wrong abstraction for Ukrainian market (ship to Nova Poshta branch/postomat, not street address); orders keep delivery address inline as text. "Easier to drop and design fresh later than to keep stale code."

**0005_guest_checkout.sql** — view-token pattern. Why: guest read via RLS would either expose all anon orders (`null = null` enumeration) or need a secret → secret wins.
```sql
alter table public.orders add column if not exists view_token text;
update public.orders set view_token = encode(gen_random_bytes(16), 'hex') where view_token is null; -- backfill BEFORE not-null
alter table public.orders alter column view_token set default encode(gen_random_bytes(16), 'hex');
alter table public.orders alter column view_token set not null;
```
Three SECURITY DEFINER RPCs (`get_order_for_view(p_number text, p_token text default null)`, `get_order_items_for_view(p_order_id uuid, p_token)`, `get_order_events_for_view(p_order_id uuid, p_token)`), all `language sql stable security definer set search_path = public`, each gated inside the body:
```sql
select * from public.orders
 where number = p_number
   and (user_id = auth.uid()
        or public.is_current_user_admin()
        or (p_token is not null and view_token = p_token))
 limit 1;
```
Then `grant execute on function ... to anon, authenticated;` — anon needs EXECUTE; the WHERE clause is the actual gate. URL shape: `/order/BAT-1234?token=<hex>`. RPCs also serve owner + admin so one code path works for everyone.

**0006_payments.sql** — `payments`: `order_id cascade`, `provider text default 'wayforpay'`, `provider_order_ref text not null unique` (ref WE send as `orderReference`; retries get fresh suffix `BAT-1042-3f9c…`), `status text default 'pending' check (status in ('pending','approved','declined','expired','refunded'))`, `amount int`, `currency text default 'UAH'`, `raw_response jsonb` (last raw provider payload), `failure_reason text`. RLS: customer read via own-order EXISTS, admin read via `is_current_user_admin()`, **zero insert/update policies** — writes only from service-role inside API routes.

**0007_fix_profile_trigger.sql** — hard-won lesson: `auth.users` had 5 rows, `profiles` empty — `on_auth_user_created` trigger was never applied on the hosted project. Breaks onboarding (UPDATE hits 0 rows), admin grants, order FK. Fix: re-create function + trigger idempotently AND backfill:
```sql
insert into public.profiles (id, phone, email)
select u.id, u.phone, u.email from auth.users u
left join public.profiles p on p.id = u.id where p.id is null;
```

**0008_order_events_guest_read.sql** — lesson: 0003's events read policy only had `o.user_id = auth.uid()`, missing the guest branch, so guests got an empty timeline via plain RLS. Fixed to mirror order_items:
```sql
... and (o.user_id = auth.uid() or (o.user_id is null and auth.uid() is null))
```

**0009_order_idempotency.sql** — lesson: POST /api/orders/create had no idempotency; network retries/double-clicks made 2–5 duplicate orders with duplicate charges. Fix: client generates random key per intent; `orders.idempotency_key text` (nullable) +
```sql
create unique index if not exists orders_idempotency_key_uniq
  on public.orders (idempotency_key) where idempotency_key is not null;
```
Route (`src/app/api/orders/create/route.ts`): validates key with `/^[A-Za-z0-9-]{8,64}$/`, pre-checks for existing order, inserts with key, catches Postgres `23505` → re-fetch and return ORIGINAL order; catches `42703` (column missing → migration not yet applied) → degrade by inserting without the key.

## Core RLS policies (0001), verbatim shapes
```sql
-- own-row trio on profiles
for select using (auth.uid() = id);  -- + insert with check / update using

-- orders read own:  for select using (auth.uid() = user_id);
-- orders insert (the guest-checkout pattern):
create policy "orders: insert own" on public.orders
  for insert with check (
    (auth.uid() = user_id)
    or (user_id is null and auth.uid() is null)   -- guest checkout
  );
-- NO customer update policy on orders → customers can't flip status to 'paid'

-- order_items: visible iff parent order visible (same EXISTS for insert):
for select using (exists (
  select 1 from public.orders o where o.id = order_items.order_id
    and (o.user_id = auth.uid() or (o.user_id is null and auth.uid() is null))));
```
Policy naming convention: `"table: verb scope"` (e.g. `"orders: admin read all"`). Everything default-deny; service role bypasses RLS for cron/webhooks/scripts.

## Client factories (`src/lib/supabase/`)
1. **Browser** (`client.ts`, `"use client"`): `createBrowserClient(supabaseUrl, supabaseAnonKey)` from `@supabase/ssr`. No memoization — SDK dedupes internally.
2. **Server cookie-bound** (`server.ts`): `createSupabaseServerClient()` is async; `const cookieStore = await cookies()` (Next 16), passes `cookies: { getAll, setAll }` where `setAll` wraps `cookieStore.set` in try-catch — `cookies().set` **throws in pure Server Components** (no response to attach to); safe to swallow because middleware/route handlers own the refresh path. "Always create a fresh client per request — sharing one across requests leaks session state between users."
3. **Admin service-role** (`server.ts`, `createSupabaseAdminClient()`): throws if `SUPABASE_SERVICE_ROLE_KEY` unset; `createServerClient(supabaseUrl, supabaseServiceRoleKey, { cookies: { getAll: () => [], setAll: () => {} } })` — never touches user cookies.

## Middleware session refresh
`src/lib/supabase/middleware.ts` → `updateSupabaseSession(request)`: `let response = NextResponse.next({ request })`; createServerClient with `setAll` that writes cookies into both `request.cookies` and a re-created `response`. Then:
```ts
// Wrapped in try-catch: this middleware matches nearly every route, so
// a transient Supabase/network failure throwing here would 500 the ENTIRE site.
try { await supabase.auth.getUser(); }
catch (err) { console.error("updateSupabaseSession: getUser failed, skipping refresh", err); }
```
Why getUser at all: JWT rotates ~hourly; without it an idle tab 401s. No route gating here — RLS authorizes at DB layer. `src/middleware.ts` matcher:
```ts
"/((?!_next/static|_next/image|favicon.ico|studio|api/revalidate|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico|ttf|woff|woff2)).*)"
```
(`studio` excluded — Sanity Studio is its own auth realm and shouldn't touch Supabase cookies.)

## Phone OTP flow end-to-end (`src/lib/auth-store.ts`, Zustand + persist, key `"batch-auth"`)
1. `requestCode(phone)`: `normalizePhone` (keep digits + leading "+"), validate `/^\+\d{7,15}$/`, then `supabase.auth.signInWithOtp({ phone, options: { shouldCreateUser: true } })` — auto-provision on first login; profile row materializes via `on_auth_user_created`. Sets `step: "code-sent"`, `pendingPhone`.
2. Supabase generates the OTP and POSTs the **Send SMS Hook** (configured at Authentication → Hooks) to `/api/auth/send-sms`. Payload: `{ user: { id, phone }, sms: { otp } }`. Handler is `runtime = "nodejs"`, reads `req.text()` raw, verifies **Standard Webhooks** signature before parsing:
```ts
// headers: webhook-id, webhook-timestamp, webhook-signature
// Replay protection: signature alone accepts a CAPTURED request forever.
const skewSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
if (skewSeconds > 300) return false;  // ±5 min window
const stripped = secretEnv.replace(/^v1,/, "").replace(/^whsec_/, ""); // accept either prefix
const key = Buffer.from(stripped, "base64");
const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest("base64");
// header = "v1,<sig> v1,<sig>" — split on space, strip "v1,", timingSafeEqual against any
```
On valid: SMS text `` `${otp} — твiй код для входу у BATCH Coffee` `` (kept ≤70 Cyrillic chars = 1 segment). 401 on bad sig (Supabase retries with backoff), 500 if secret unset.
3. **SMS Club client** (`src/lib/smsclub.ts`): POST `https://api.smsclub.mobi/sms-v3`, `Authorization: Bearer ${SMSCLUB_API_TOKEN}`, body `{ sms: { from, text, lifetime: 600 }, recipients: [{ phone: Number(digits) }] }`. Phone normalized to digits-only — **SMS Club rejects E.164 with leading "+"; their phone field is an integer**. `AbortSignal.timeout(8000)` so a flaky gateway can't hang the auth flow. Success = `res.ok && data.status === "success"`; otherwise throw with joined `errors[].field: description`. Rate cap 9 req/s. Sender ID must be pre-approved by SMS Club.
4. `verifyCode(code)`: regex `/^\d{6}$/` (6 digits, matches Supabase Phone provider setting; email OTP configured to 6 too for consistency), then `supabase.auth.verifyOtp({ phone: pendingPhone, token, type: "sms" })`. On success fetch profile (`first_name, last_name, phone, email, newsletter, is_admin`) with `.maybeSingle()`; if name/phone missing → `step: "needs-profile"` (onboarding screen).
5. `syncFromSupabase()` on rehydrate reconciles localStorage mirror against `getSession()`. Fail-closed lesson: gate clearing on **user presence, not flow step** — gating on `step === "idle"` left revoked/deleted accounts with a working cabinet UI. Cross-tab sync: `window.addEventListener("storage", e => e.key === "batch-auth" && useAuth.persist.rehydrate())`, guarded by `window.__batchAuthStorageBound` flag (HMR re-evaluation would stack listeners). `partialize: (s) => ({ user: s.user, method: s.method })` — flow state must reset on reload.

## Phone "+" invariant (hard-won)
Supabase stores phones in E.164 **WITHOUT** leading "+" (`auth.users.phone = "380999663346"`); `handle_new_user` copies it as-is, so `profiles.phone` is bare digits too. Every read path re-pluses via `ensurePlus(raw)` (`"+" + digits`, idempotent); display formats via `formatPhone` ("+380 50 123 45 67" for 13-char +380 numbers). Onboarding upsert writes `phone: phone.replace(/^\+/, "")` — writing "+380…" would diverge `profiles.phone` from `auth.users.phone` and break any query assuming bare digits. Onboarding uses **upsert with `{ onConflict: "id" }`, not update** — if the trigger ever failed, plain UPDATE silently affects 0 rows and the name never saves. Phone is required at onboarding: upserting `phone: null` keeps `needsProfile` true forever → infinite onboarding loop.

## Scripts
- **`scripts/grant-admin.ts`**: `npx tsx scripts/grant-admin.ts <phone-or-email> [--revoke] | --list`. `dotenv` loads `.env.local`; `createClient(url, serviceKey, { auth: { persistSession: false } })` bypasses RLS; auto-detects email ("@") vs phone; updates `profiles.is_admin` by `.eq(column, value).select(...).maybeSingle()`, errors helpfully if no profile ("user must sign up first"). Note: its `asPhone()` re-adds "+" before lookup, which conflicts with the bare-digits storage invariant — verify lookups when porting.
- **`scripts/run-migration.ts`**: `npx tsx scripts/run-migration.ts supabase/migrations/000N_*.sql` — raw `pg` Client over `SUPABASE_DB_URL` (direct Postgres, no RLS/RPC limits). No `schema_migrations` tracking; relies on the convention that every migration file is idempotent (`if not exists`, `drop policy if exists`, `create or replace`).

## Conventions worth copying
- Migrations: numbered `000N_name.sql`, idempotent, with long prose headers documenting the bug/decision they encode (0004 drop, 0007 trigger fix, 0008 policy asymmetry, 0009 duplicates).
- All SECURITY DEFINER functions pin `set search_path = public`.
- Money in integer minor-or-whole units; product data snapshotted onto order_items.
- Status mutation paths: customer never updates orders; admins via RLS policy; webhooks/cron via service role; every change auto-logged by trigger with `auth.uid()` as `changed_by` (null = system).
- Bootstrapping admin documented in-migration: `update public.profiles set is_admin = true where id = '<uuid>';`.
