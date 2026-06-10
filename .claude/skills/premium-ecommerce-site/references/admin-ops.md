# Admin Panel + Ops Digest — BATCH Coffee (Next.js 16 + Supabase + Sanity)

Root: `/Users/vladkruhlyk/Documents/GitHub/git-batch-coffee/web`. Locale: Ukrainian (`uk-UA`), currency UAH (integer grivnas). Order numbers: `BAT-NNNN` (DB-generated).

## 1. Admin route structure

```
src/app/admin/
  layout.tsx              # server component — auth gate + admin shell
  page.tsx                # dashboard (client component, KPIs + charts)
  orders/page.tsx         # orders table (filter/search/sort)
  orders/[id]/page.tsx    # order detail (status, tracking, note, timeline)
  customers/page.tsx      # customers list w/ client-side join to orders
  customers/[id]/page.tsx # customer detail
```

### Server-side guard (layout.tsx) — the load-bearing pattern
Layout is a **server component** so the check runs before any HTML ships; RLS backstops it (`is_current_user_admin()` policies mean a bypassed guard sees empty data anyway).

```tsx
const supabase = await createSupabaseServerClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) redirect("/login?next=/admin");
const { data: profile } = await supabase
  .from("profiles").select("is_admin, first_name, last_name, email")
  .eq("id", user.id).maybeSingle();
if (!profile?.is_admin) redirect("/");   // silent — don't advertise the route
```
Shell: compact utilitarian header (`BATCH · Admin`), nav links Огляд `/admin` / Замовлення `/admin/orders` / Клієнти `/admin/customers` (lucide icons `LayoutDashboard/PackageOpen/Users`, `strokeWidth={1.6}`), "На сайт" exit link, content in `<Container size="wide" className="py-10 lg:py-14">`. No site nav/cart/search.

All admin **pages** are `"use client"` and query Supabase directly via browser client — RLS does the authorization; the layout guard is only UX.

## 2. Dashboard (`admin/page.tsx`)

**Data strategy** (documented in file header): one nested-FK query (orders + items) for the selected range + one forever-open "needs attention" query; both fit a 2000-row limit at small-shop scale; **all aggregation client-side** so range switching doesn't refetch. No chart lib — hand-rolled SVG `LineChart`/`BarChart` in `src/components/admin/charts.tsx` (~200 lines, inherit brand tokens, no tooltips/legends: "admin metrics are scannable, not interactive").

```ts
type RangeKey = "7d" | "30d" | "90d" | "all";
const RANGES = [
  { key: "7d", label: "7 днів", days: 7 },
  { key: "30d", label: "30 днів", days: 30 },
  { key: "90d", label: "90 днів", days: 90 },
  { key: "all", label: "Весь час", days: null },
];
const ACTIVE_STATUSES: OrderStatus[] = ["pending", "paid", "packing"]; // fulfilment queue
```

"Since" timestamp — days inclusive ("7д" = today + previous 6 full days):
```ts
const d = new Date();
d.setDate(d.getDate() - (cfg.days - 1));
d.setHours(0, 0, 0, 0);
return d.toISOString();
```

KPIs: Виручка, Замовлень, Середній чек (AOV = `Math.round(revenue/count)`), Скасовано (% with `inverse` flag — red when cancelRate > 0.1). Revenue/count exclude `cancelled`; cancel-rate denominator includes them. Delta-vs-previous-period is **stubbed null** (comment: previous window not fetched; UI hides badge when `delta == null`).

**Bucketing**: ≤60 days → per day (`за днями`), 90d → per week (`за тижнями`), "all" → inspects span: >365d → month (`за місяцями`), >60d → week. Buckets built by walking a cursor from windowStart to now; each order is placed in the latest bucket whose `start <= createdAt` (reverse scan). Labels via `Intl.DateTimeFormat("uk-UA", { day:"2-digit", month:"short" })`.

Hard-won lessons in comments:
- `loading` initialised true, NOT reset on range change — "Re-setting it here would tick a cascading render — react 19 flags that."
- `isoDay()` zero-pads month/day: "emitting '2026-5-9' for May 9th invites a subtle bug the moment anything parses or sorts them as dates."

Ukrainian plural helper (used everywhere counts are shown):
```ts
function plural(n, forms) { // [1, 2-4, 5+]
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}
```

## 3. Orders module (`src/lib/orders.ts` — client-safe)

Types: `OrderStatus = "pending" | "paid" | "packing" | "shipped" | "delivered" | "cancelled"`; `DeliveryMethod = "novaposhta-branch" | "novaposhta-postomat" | "pickup"`; `PaymentMethod = "card" | "cod"`.

Conventions: **DB speaks snake_case; translate at the boundary** via `rowToOrder/rowToItem/rowToStatusEvent` adapters — UI never sees column names. `internalNote` is staff-only. `viewToken` = per-order shared secret in customer URL (`/order/BAT-1234?token=…`) so guests reach receipts without an account; owners/admins reach the same data via RLS.

Key queries:
```ts
// Admin dashboard — nested FK select, one round-trip:
let q = supabase.from("orders").select("*, order_items(*)")
  .order("created_at", { ascending: false });
if (isoSince) q = q.gte("created_at", isoSince);
const { data } = await q.limit(2000);
```
- `listOrders({ status, search, sortBy, sortDir, limit })` — server-side filtering; search is `q.ilike("number", `%${search}%`)`; same function serves customer (RLS narrows) and admin.
- `updateOrderStatus/updateOrderTracking/updateOrderInternalNote` — plain `.update()`; "RLS rejects this for regular customers, so no extra guard is needed here." Note clearing: `internal_note: note?.trim() || null`.
- `listOrderStatusEvents(orderId)` — `order_status_events` table ascending, "older events first so the UI can render top-to-bottom timelines without reversing." **A DB trigger appends the event on status change** — admin UI refetches the timeline after `updateOrderStatus`.
- Guest view via SECURITY DEFINER RPCs: `get_order_for_view(p_number, p_token)`, `get_order_items_for_view`, `get_order_events_for_view` — single RPC serves owner / admin / guest-with-token.
- `createOrder` — two sequential inserts (header then items), no RPC; orphan header acknowledged as rare + hand-cleanable.

### Status helpers (shared customer/admin)
```ts
export function statusLabel(status: OrderStatus): string {
  pending → "Очікує оплату"; paid → "Оплачено"; packing → "Пакується";
  shipped → "Відправлено"; delivered → "Доставлено"; cancelled → "Скасовано";
}
export function statusTone(status) {
  pending:   { bg: "bg-amber-100",   text: "text-amber-800" }
  paid:      { bg: "bg-sky-100",     text: "text-sky-800" }
  packing:   { bg: "bg-violet-100",  text: "text-violet-800" }
  shipped:   { bg: "bg-indigo-100",  text: "text-indigo-800" }
  delivered: { bg: "bg-emerald-100", text: "text-emerald-800" }
  cancelled: { bg: "bg-rose-100",    text: "text-rose-800" }
}
```
Pill markup: `inline-flex items-center text-[10px] tracking-[0.2em] uppercase rounded-full px-2.5 py-1` + tone classes.

### customerStatusDisplay (`src/app/order/[number]/page.tsx:566`)
Customer-facing override — pending wording depends on payment method:
```ts
if (order.status === "pending") {
  if (order.paymentMethod === "card") return {
    label: "Перевіряємо оплату", bg: "bg-sky-100", text: "text-sky-800",
    spinning: true,   // waiting on the WayForPay webhook to confirm
  };
  return { label: "Очікує оплату при отриманні", bg: "bg-amber-100",
    text: "text-amber-800", spinning: false };
}
const tone = statusTone(order.status);
return { label: statusLabel(order.status), ...tone, spinning: false };
```

## 4. Server-only admin queries (`src/lib/orders-admin.ts`)

```ts
import "server-only";   // build-time error if a client component imports this
import { createSupabaseAdminClient } from "./supabase/server";
```
Why a separate module: bringing `createSupabaseAdminClient` into `orders.ts` "would pull in `next/headers` and break" client imports. Sole export `getOrderByIdAdmin(id)` — fetches order + items bypassing RLS; used by payment-init route "to compute the WayForPay total from the authoritative DB value rather than trust the client."

`src/lib/supabase/server.ts`:
- `createSupabaseServerClient()` — `createServerClient(supabaseUrl, supabaseAnonKey, { cookies: { getAll, setAll } })`; setAll wrapped in try/catch because "`cookies().set` throws in pure Server Components" — safe to swallow, middleware handles refresh.
- `createSupabaseAdminClient()` — service-role key, throws if missing, cookie hooks are no-ops (`getAll: () => []`). "Use ONLY for trusted server-side operations."

`src/lib/supabase/env.ts` — validates once, re-exports typed constants via `required(name, value)` thrower; `supabaseServiceRoleKey` deliberately optional (undefined on client).

## 5. Orders list + detail pages

`orders/page.tsx`: search debounced 250ms (`window.setTimeout` in effect), status `<select>` with "Всі статуси" + `ORDER_STATUSES.map(statusLabel)`. Sort toggle: same column click flips dir, new column resets to `desc` ("matches what every spreadsheet does"). Every fetch effect uses the `let cancelled = false` + cleanup pattern. Table: `text-[11px] tracking-[0.18em] uppercase` headers, `tabular-nums` on numbers/dates, `font-display font-semibold` totals, rows `hover:bg-[var(--color-bg-secondary)]`. Empty state distinguishes filtered ("Нічого не знайдено.") vs truly empty.

`orders/[id]/page.tsx`: header status pill + `<select>` with options `Змінити: {statusLabel(s)}`; 3 InfoCards (Клієнт w/ `tel:`/`mailto:` links, Доставка w/ inline ТТН editor — placeholder "20 цифр", save disabled when draft equals stored value, Оплата w/ totals incl. conditional `Знижка −`); items table; internal note `<textarea>` with badge "Тільки для команди" (amber pill) + cancel/save buttons disabled-when-unchanged; **status timeline** `<ol>` — absolute vertical line `left-[7px] w-px`, dots filled for latest, each entry "`{fromStatus} → {toStatusPill}`" or "Створено → …" + timestamp.

## 6. Customers (`src/lib/customers.ts` + pages)

`listCustomers()` / `getCustomer(id)` over `profiles` (RLS: admins read all — migration 0002). `computeCustomerStats(orders)` → `{ orderCount, totalSpent, lastOrderAt }`, excluding cancelled. Comment encodes scale decision: client-side aggregates are "fine for 'shop has 200 customers' scale; becomes a SQL view once we hit tens-of-thousands" (list page states ceiling: ~1k customers × ~5k orders in-memory join).

`customers/page.tsx`: fetches `Promise.all([listCustomers(), listOrders()])`, builds `Map<userId, {count, spent, lastOrderAt}>` in one `useMemo`, filters by lowercase haystack of email/name/phone, sorts by `"recent" | "spent" | "orders"` (recent = lastOrderAt desc, signup-date tiebreak via `localeCompare`). Admin profiles flagged with `ShieldCheck`.

## 7. scripts/ directory

Universal pattern — every script:
```ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },   // service-role bypasses RLS
);
```
Run as `cd web && npx tsx scripts/<name>.ts`. Explicit guard + `process.exit(1)` if env missing. Service-role scripts live in `scripts/`, never app runtime.

- **grant-admin.ts** — toggle `profiles.is_admin` from CLI. `<phone-or-email>`, `--revoke`, `--list`. Auto-detects identifier: contains `@` → email, else normalize to E.164 (`"+" + digits`, min 7 digits). User must already have signed up (looked up in `profiles`, not created).
- **seed-test-orders.ts** — inserts 3 demo orders (paid/packing/shipped mix covering pill colors, real catalog slugs); owner = email arg or first admin ("solo-testing just works"). deliveryFee = pickup ? 0 : 80. "Idempotent-ish": re-runs add rows (auto BAT-NNNN).
- **run-migration.ts** — runs one `.sql` file via `pg` `Client` over `SUPABASE_DB_URL` (direct Postgres, immune to RLS/RPC limits). Migrations written idempotent by convention. Explicit caveat: no `schema_migrations` tracking — ad-hoc only, "adopt `supabase db push` later."
- **inspect-order.ts** — `npx tsx scripts/inspect-order.ts BAT-1003` → `console.dir` order + items, service-role.
- **update-site-settings.ts** — one-shot patch of singleton Sanity `siteSettings` doc (address/hours/phone/instagram) via `@sanity/client` (`apiVersion: "2024-11-01"`, `useCdn: false`, `SANITY_API_TOKEN`). Fetch `*[_type == "siteSettings"][0]{ _id }`, patch-or-create. Rationale: "a script keeps the change in git so we know when the canonical contact info moved."
- Others: `import-client-products.ts` (CSV → Sanity, dry-run default / `--commit`, slug cleaning strips Cyrillic look-alikes), `migrate-to-sanity.ts` (mocks → Sanity, deterministic `_id` from slug + `createOrReplace` = idempotent), `compress-farm-field.ts` (dry-run/`--commit` content fix), `check-sanity.ts`, `check-product-price.ts` (read-only probes).

Pattern: destructive scripts default to **dry run** with a `--commit` flag.

## 8. SEO

**`src/lib/site.ts`** — single source of truth; comment documents the bug it fixed (robots/sitemap/JSON-LD hardcoded the Vercel preview domain while layout used `batch.coffee` → conflicting canonicals):
```ts
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://batch-coffee.vercel.app"
).replace(/\/+$/, "");
```
Also feeds WayForPay return/service URLs.

**`src/app/robots.ts`** — allow `/`, disallow `["/studio", "/studio/", "/account", "/account/", "/login", "/checkout", "/order/", "/api/"]`, `sitemap: ${SITE_URL}/sitemap.xml`.

**`src/app/sitemap.ts`** — static routes hand-rolled with priority/freq (`/` 1.0 weekly, `/shop` 0.9 daily, `/subscription` 0.8, …, `/privacy` & `/terms` 0.1 yearly); dynamic entries from Sanity via `Promise.all([fetchProducts(), fetchBrewGuides(), fetchJournalPosts()])` — products `/shop/${slug}` 0.8 weekly, brew guides 0.6 monthly, journal 0.5 monthly with `lastModified: publishedAt`.

**Product JSON-LD** (`src/app/shop/[slug]/page.tsx`, server component):
```tsx
const productLd = {
  "@context": "https://schema.org", "@type": "Product",
  name, description: product.shortDescription, sku: product.slug,
  brand: { "@type": "Brand", name: "BATCH Coffee Roastery" },
  category: product.category,
  offers: { "@type": "Offer", url: `${SITE_URL}/shop/${product.slug}`,
    priceCurrency: "UAH", price: startingPrice,
    availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" },
};
// <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }} />
```

## 9. Env var inventory (all of them, by service)

**Supabase** (client-safe): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. (Server-only): `SUPABASE_SERVICE_ROLE_KEY` (admin client + scripts), `SUPABASE_DB_URL` (direct Postgres — run-migration only), `SUPABASE_SMS_HOOK_SECRET` (`whsec_…` value for the auth send-SMS hook, `api/auth/send-sms/route.ts`).

**Sanity** (client-safe): `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`, `NEXT_PUBLIC_SANITY_API_VERSION`. (Server-only): `SANITY_API_TOKEN` (write token — scripts + server fetchers), `SANITY_WEBHOOK_SECRET` (shared secret for `/api/revalidate` ISR webhook).

**WayForPay** (server-only, `src/lib/wayforpay/config.ts` — defaults fall back to WFP public sandbox creds): `WAYFORPAY_MERCHANT_ACCOUNT` (default `"test_merch_n1"`), `WAYFORPAY_MERCHANT_SECRET` (default `"flk3409refn54t54t*FNJRET"`), `WAYFORPAY_MERCHANT_DOMAIN_NAME` (falls back to `NEXT_PUBLIC_SITE_URL` minus protocol).

**SMSClub** (server-only, `src/lib/smsclub.ts`): `SMSCLUB_API_TOKEN`, `SMSCLUB_SENDER_ID`.

**Site**: `NEXT_PUBLIC_SITE_URL` (canonical URL; set in Vercel when DNS live).

All local config in `web/.env.local` (gitignored); scripts load it explicitly with dotenv since tsx doesn't inherit Next's env loading.

## 10. Cross-cutting admin conventions

- Visual tokens used throughout admin: cards `rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-5 lg:p-6`; section eyebrows `text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]`; headings `font-display ... tracking-[-0.025em]`; numbers always `tabular-nums`; pills `rounded-full`; errors `text-rose-700 border-rose-200 bg-rose-50`; loading = centered `Loader2 animate-spin`.
- Save buttons disabled when draft === stored value (prevents no-op writes); spinner replaces icon while saving.
- Dates: `Intl.DateTimeFormat("uk-UA", …)` variants (short list date, long detail date).
- Error normalization: `messageOf(e)` → `e instanceof Error ? e.message : "Щось пішло не так."`.
- AGENTS.md warning: this repo runs a post-cutoff Next.js 16 — consult `node_modules/next/dist/docs/` before writing code.
