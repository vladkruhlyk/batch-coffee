---
name: premium-ecommerce-site
description: Build a production-grade, smooth/premium e-commerce site (online store, shop, магазин, інтернет-магазин) with Next.js + Supabase + Sanity + card payments. Use when the user wants to create a new online store / e-commerce site / landing-with-shop for any niche (coffee, fashion, cosmetics, food…), or to add cart/checkout/CMS/payments/admin to a site. Covers design system, catalog, cart, phone-OTP auth, orders, WayForPay payments, promo codes, admin panel, and a hardening checklist of 52 production bugs to avoid.
---

# Premium E-commerce Site Builder

Battle-tested blueprint extracted from a real production build (BATCH Coffee
Roastery, UA market): Next.js 16 + React 19 + Tailwind v4 + Framer Motion +
Lenis on the front; Supabase (Postgres/Auth/RLS) for accounts + orders; Sanity
for merchant-editable content; WayForPay for cards; SMS Club for OTP. The site
survived four adversarial multi-agent audits — every lesson is encoded here.

## Reference files — read the ones the current task touches

| File | Contents |
|---|---|
| `references/hardening-checklist.md` | **Read for ANY money/auth/webhook work.** 52 production bugs distilled into prevention rules. |
| `references/design-system.md` | Design tokens, Tailwind v4 `@theme inline`, typography scale, easing/motion constants, fonts. |
| `references/app-structure.md` | File tree, providers (Lenis), route map, ui primitives, dependency list. |
| `references/frontend-patterns.md` | Zustand stores (persist/migrate/hydration), overlays, body-scroll lock, cart math, fly-to-cart, product cards. |
| `references/supabase-backend.md` | Schema + RLS + triggers + RPCs, phone-OTP auth flow, SMS hook, client factories, migrations discipline. |
| `references/sanity-cms.md` | Schema conventions, GROQ, fetchers + cache tags, adapters, dual clients (CDN vs fresh), revalidate webhook. |
| `references/payments-orders.md` | WayForPay end-to-end (signatures, webhook, return), server-authoritative order pricing, idempotency, promo codes. |
| `references/admin-ops.md` | Admin panel (guard, KPIs, statuses), ops scripts, SEO (SITE_URL, JSON-LD, sitemap), env-var inventory. |

## Non-negotiable architecture decisions

These are the decisions that made the build succeed. Deviate only with reason:

1. **Server is the money authority.** The client displays prices; the server
   re-derives every charged number (line prices from CMS with CDN bypass,
   discounts from promo codes, totals) at order creation. Client-sent amounts
   are never trusted.
2. **One identity channel** (phone OTP). Two parallel login methods without
   account-merging = duplicate accounts. Phones stored without `+`, re-plussed
   by one helper on read.
3. **Idempotency from day one**: order creation accepts a client UUID key,
   replays the original response on repeats (unique partial index).
4. **CMS pipeline is layered**: schema → GROQ → fetcher (cache tags) →
   adapter (null-safe view models) → component. Components never see raw CMS
   data. Every customer-visible list reads the LIVE catalog.
5. **Design system as CSS variables** registered via Tailwind v4
   `@theme inline`; one shared EASING object; one ref-counted body-scroll
   lock; Lenis for smooth scroll with route-change reset.
6. **RLS does authorization** (own rows / guest-null pair / admin function);
   API routes resolve identity from cookies server-side and write via
   service-role; guests view orders via a random `view_token` RPC.
7. **Migrations are idempotent** and the app tolerates a not-yet-run
   migration (catch `42703`, degrade) so deploy order never matters.

## Build order (proven sequence)

Work in this order — each phase is shippable and the next builds on it:

1. **Skeleton + design system** — Next app, fonts, tokens in `globals.css`,
   `@theme inline`, easing module, Providers (Lenis + scroll reset), Header /
   Footer / Container primitives, loader splash. *(references: design-system,
   app-structure)*
2. **Catalog from CMS** — Sanity schemas (product with variant array incl.
   wholesale/sale fields), GROQ + fetchers + adapters, shop grid + product
   card + PDP, search overlay (lazy fetch + TTL), category tiles, compare.
   Hardcode NOTHING the merchant will edit. *(sanity-cms, frontend-patterns)*
3. **Cart** — zustand persist store (composite line ids, version+migrate,
   quantity guards), drawer + cart page, volume-pricing aggregation, price
   refresh on cart/checkout mount (display-only; merge by id). *(frontend-patterns)*
4. **Auth** — Supabase phone OTP + SMS provider hook (signature + timestamp
   verification), auth store state machine (idle → code-sent → needs-profile),
   onboarding, account pages, cross-tab sync. *(supabase-backend)*
5. **Orders + checkout** — orders/order_items/payments schema + RLS + status
   enum + status-events trigger; `/api/orders/create` with full validation,
   server pricing, idempotency, rollback; guest checkout with view_token;
   pickup/COD first. *(payments-orders, supabase-backend)*
6. **Card payments** — WayForPay (or analog): signed form payload, webhook
   with error-checked idempotent transitions, return route, pending-payment
   polling UX, refund mapping. Test keys → prod keys. *(payments-orders)*
7. **Promo codes** — CMS-managed codes (percent/fixed, dates, min subtotal,
   active toggle); client sends only the CODE; server re-validates on the
   charge path with the fresh (non-CDN) client. *(payments-orders, sanity-cms)*
8. **Admin** — server-guarded `/admin`: KPI dashboard with date ranges,
   order management (status, tracking, internal notes), customers. Ops
   scripts (grant-admin, seed, inspect). *(admin-ops)*
9. **SEO + launch** — single SITE_URL env, robots/sitemap/JSON-LD, redact
   PCI logs, run `references/hardening-checklist.md` top to bottom, live
   test: real payment, real SMS, double-click submit, promo apply.

## Process rules

- After each phase: `tsc --noEmit` + lint + `next build` must be clean before
  moving on.
- Any change on the money/auth path gets a focused adversarial review (try to
  refute that it's safe) before commit — two of the worst production bugs were
  introduced by well-meaning fixes.
- Keep merchant-facing text in the merchant's language (uk-UA here); keep code
  comments in English explaining WHY (many encode fixed bugs — preserve them).
- The user runs SQL migrations manually in the Supabase SQL Editor — always
  hand them the exact SQL and expect "Success. No rows returned".
