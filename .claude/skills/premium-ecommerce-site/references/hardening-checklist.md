# Hardening Checklist — 52 real bugs, distilled into prevention rules

Every rule below is a bug that actually shipped in a production build of this
stack and was caught by adversarial multi-agent audits. Apply them DURING the
build, not after. Organized by domain; severity tags show what the bug cost.

## Money path (the non-negotiables)

1. 🔴 **The server prices everything.** Never charge from client-sent
   `unitPrice`/`discount`. At order creation, re-fetch every line's price from
   the CMS by slug+variant, re-apply volume/wholesale rules server-side, and
   reject lines whose product/variant no longer exists. The client's numbers
   are display-only.
2. 🔴 **Bypass the CMS CDN on the charge path.** `revalidate: 0` only bypasses
   Next's cache, NOT Sanity's CDN (caches ~minutes). Money reads use a second
   client with `useCdn: false`.
3. 🔴 **Idempotent order creation.** Client generates `crypto.randomUUID()` per
   order intent (reset when cart changes), sends it; server stores it in a
   nullable column with a partial UNIQUE index and replays the ORIGINAL
   response on a repeated key (pre-check + catch Postgres `23505` for the
   concurrent race). Without this, double-click/network-retry = duplicate
   orders + duplicate charges.
4. 🔴 **Two-step inserts need compensation.** orders + order_items are two
   statements — if the second fails, DELETE the order (retry the delete once,
   log an ALERT marker if it still fails). Otherwise: orphan orders, corrupted
   ledger, pinned idempotency keys.
5. 🟡 **Discounts: client sends the CODE, never the amount.** Server resolves
   the code from the CMS and recomputes the discount against ITS subtotal,
   clamped to `[0, subtotal]`; reject `total <= 0` and validate every money
   field (`Number.isFinite`, bounds) — `Math.max(1, NaN)` is `NaN`, `0 ?? x`
   is `0` (nullish doesn't catch zero!).
6. 🟡 **Date-window checks: guard `NaN`.** `new Date(garbage).getTime()` is
   `NaN`, and BOTH `NaN > now` and `NaN < now` are false — an expired promo
   silently passes. Parse to a timestamp, reject non-finite, THEN compare.
7. 🟡 **Round money ONCE, in one place, identically everywhere.** Pick
   per-unit rounding (`Math.round(rate × unitWeight) × qty`) and use the same
   formula on the card, PDP, drawer, cart, checkout, and server. Two formulas
   = totals that differ by a few UAH = looks like fraud to the customer.
8. 🟡 **Lookup keys need normalization.** `.trim()` variant labels on BOTH the
   map-build side and the lookup side (Map keys are strict-equality); a
   trailing space typed in the CMS must not reject a valid order. Duplicate
   labels: disambiguate by grams/size, refuse if still ambiguous.

## Payments provider (WayForPay et al.)

9. 🔴 **Check `{ error }` on every DB write in the webhook.** If a write fails
   you must NOT ack — return an error so the provider retries. Acking a failed
   write = provider thinks it's settled, your DB says pending, money lost.
10. 🔴 **Conditional status transitions.** Order update uses
    `.neq("status", "paid")` — atomic + idempotent against retried/concurrent
    deliveries, AND lets a retry complete the transition if a prior delivery
    half-failed. Never gate on a stale pre-read of the status.
11. 🟡 **Webhooks lie about Content-Type.** WayForPay POSTs JSON with
    `Content-Type: text/plain`. Read raw text, sniff the leading `{`, fall
    back to form-urlencoded. Accept GET **and** POST on the return URL; 303
    the redirect.
12. 🟡 **Handle refund webhooks.** Map refund → an order status the customer
    understands (gated `.eq("status","paid")`); leaving the order "paid" after
    a refund breaks trust and reporting.
13. 🟡 **PCI: never log raw webhook bodies** — they carry `cardPan`/`authCode`.
    Log orderReference + failure category + field NAMES only.
14. 🟡 **Replay-protect signed webhooks.** Verify the signature AND reject
    timestamps outside ±5 min — a captured payload otherwise replays forever
    (e.g. re-triggering SMS sends).
15. 🟡 **Cart-clear timing.** Clear the cart only at the point of no return:
    AFTER the payment-form payload is obtained (card) / right before the
    confirmation redirect (COD). Clearing earlier turns a failed payment setup
    into an empty-cart dead end where the error can't even render.
16. 🟢 **Pending-payment UX.** After return-redirect, the webhook may not have
    landed yet: show "Перевіряємо оплату" + poll the order every ~3s for ~2
    min instead of showing a scary "unpaid".
17. 🟢 **Sign before insert.** Build + sign the payment payload BEFORE
    persisting the attempt row, so a signing throw can't orphan a row. Fresh
    `provider_order_ref` per attempt (providers enforce uniqueness).

## Auth & sessions (Supabase phone OTP)

18. 🔴 **One identity channel.** Email+phone as parallel login methods created
    DUPLICATE accounts (register by email, add phone, login by phone → second
    account). Pick one (phone) unless you build real account-merging.
19. 🔴 **Clear revoked sessions fail-closed.** When `getSession()` returns
    null and the store has a cached user, wipe user + reset flow state. Gate
    on user presence, NOT on flow step — fresh-OTP logins have `user === null`
    anyway, so they can't be bounced.
20. 🟡 **Normalize phones at ONE boundary.** Supabase stores E.164 WITHOUT the
    leading `+`. Store bare digits in the DB, re-add `+` via one `ensurePlus()`
    helper on every read. Mixed formats break server functions silently.
21. 🟡 **Onboarding must not be able to loop.** If profile completion requires
    a phone, REQUIRE it in the submit handler (error, not silent null upsert)
    and render a phone input for legacy accounts that lack one — otherwise
    they're trapped forever.
22. 🟡 **Profile rows: UPSERT, not UPDATE,** and don't trust the
    `on_auth_user_created` trigger to have fired — environments drift; a plain
    UPDATE silently affects 0 rows.
23. 🟢 **Cross-tab sync:** a `storage`-event listener that calls
    `persist.rehydrate()` — registered ONCE behind a `window.__flag` (HMR
    re-evaluates modules and stacks duplicate listeners).
24. 🟢 **Middleware session refresh in try-catch.** It matches every route — an
    unhandled Supabase blip 500s the entire site. Degrade to "no refresh this
    request".

## API routes

25. 🟡 **Every route returns JSON on every path.** Wrap handlers in try-catch;
    an uncaught throw returns an HTML 500 that breaks the client's
    `res.json()`. Extract error messages properly (Supabase errors are plain
    objects → "[object Object]" if stringified naively).
26. 🟡 **Validate ALL fields, not just the obvious ones.** Numbers: finite +
    bounds. Strings: non-empty after trim AND max-length caps (DB `text`
    columns are unbounded — a tampered client can push megabytes per field).
    Items: cap the array length (e.g. 100 lines).
27. 🟡 **Check `{ error }` on every Supabase read,** not just writes — a DB
    error destructured as `{ data }` is just `undefined`, silently sending a
    paying customer to the homepage.
28. 🟢 **Rate limiting needs infra on serverless** (in-memory counters don't
    survive across instances) — plan Upstash/Redis early for OTP, order, and
    promo endpoints; don't pretend a per-instance counter protects anything.

## RLS & DB

29. 🔴 **Guest rows: `user_id IS NULL AND auth.uid() IS NULL`** — and apply
    the SAME clause to every child table (items, status events). Asymmetric
    policies strand guests on some tables.
30. 🟡 **Guest order viewing via a `view_token` RPC** (SECURITY DEFINER,
    random token in the URL), never by widening SELECT policies.
31. 🟡 **Server routes resolve `user_id` from cookies, never from the client
    body.** Insert via service-role AFTER computing identity server-side.
32. 🟢 **Postgres enums are append-only via migration** — adding a status
    means a migration; design the initial enum generously (include
    `refunded`/`cancelled` from day one).
33. 🟢 **Write migrations idempotently** (`if not exists`, `drop policy if
    exists` + recreate) and make the APP tolerate a not-yet-run migration
    (catch `42703` undefined-column and degrade) — deploy order then never
    matters.

## React / state (Next App Router + zustand)

34. 🟡 **Persisted stores: `version` + `migrate` from day one.** Changing a
    persisted field's shape without a migration hydrates garbage into the new
    shape.
35. 🟡 **Async refresh + live store = merge by id.** A fetch that resolves
    after the user edited state must MERGE (by line id, keeping live
    quantities) — `replaceItems(staleSnapshot)` silently undoes their edits.
36. 🟡 **One ref-counted body-scroll lock** shared by EVERY overlay (drawer,
    search, splash, menus). Two components doing save/restore of
    `body.overflow` clobber each other when they overlap.
37. 🟡 **`exit` animations need `<AnimatePresence>`** around the conditional —
    otherwise the node unmounts instantly and the exit never plays.
38. 🟢 **Stamp cache-TTLs AFTER the fetch resolves** (in `.then`), with an
    in-flight guard — stamping up-front marks failed/slow fetches as fresh.
39. 🟢 **Unmount guards on client fetches** (`let alive = true` + cleanup) —
    avoids setState-after-unmount and gives failed fetches a clean retry path.
40. 🟢 **React 19 lints are right:** no `Date.now()`/`Math.random()` during
    render or in lint-flagged positions; no `setState` directly in effect
    bodies; `useSyncExternalStore` already handles SSR/hydration via
    `getServerSnapshot` — don't add `mounted` flags around it.
41. 🟢 **Guard empty data everywhere adapters can produce it.**
    `Math.min(...[])` is `Infinity`; `array[0]` on `[]` crashes the page. A
    CMS draft with no variants must not take down the whole grid — return
    null/fallback UI, filter weightless products from search/compare.

## CMS (Sanity)

42. 🟡 **The pipeline is schema → GROQ → fetcher (cache tags) → adapter →
    component.** Components never touch raw CMS data; adapters own null
    handling and camelCase view-models.
43. 🟡 **Search/compare/etc must use the LIVE catalog** — every list the
    customer sees fetches from the CMS, not from a seed/demo array that
    silently goes stale.
44. 🟢 **Free-text vs constrained fields:** constrain what code depends on
    (category), free-text what the merchant iterates on (grinds, badges,
    process) — `string & {}` keeps TS unions open.
45. 🟢 **Revalidate webhook:** signature-checked (`parseBody` from
    next-sanity), tag-per-type + tag-per-slug; remember client-side caches
    (search overlay) need their own TTL — server revalidation doesn't reach
    them.

## SEO / ops

46. 🟡 **ONE `SITE_URL` source** (env-driven) for metadataBase, OG, JSON-LD,
    robots, sitemap, AND payment return URLs. Two hardcoded domains =
    conflicting canonicals.
47. 🟢 **Admin guard is server-side** (layout checks `is_admin` via
    service-role); client-side guards are UX, not security.
48. 🟢 **Ops scripts directory** (`scripts/grant-admin.ts`,
    `seed-test-orders.ts`, `inspect-order.ts`, `run-migration.ts`) using
    dotenv + service-role — you WILL need them mid-launch.
49. 🟢 **Date math:** epoch milliseconds, not `setDate()` (local-calendar math
    on UTC instants drifts ±1 day near midnight); ISO keys are 1-indexed and
    zero-padded.

## Process

50. **Audit in rounds, adversarially.** Fan out reviewers per domain, then have
    a skeptic agent try to REFUTE each finding against the real code before
    fixing — half of raw findings are false positives.
51. **Re-review your own fixes.** Two of the worst bugs in this project were
    introduced BY fixes (the NaN date guard's first version, the idle-only
    session gate). Any fix on the money/auth path gets its own focused review.
52. **Verify with the real build** (`tsc --noEmit`, lint, `next build`) before
    every commit, and keep a human-run live checklist (real card payment, real
    SMS, double-click the submit button) — agents can't test webhooks from
    localhost.
