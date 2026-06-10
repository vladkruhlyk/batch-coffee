# WayForPay Money Path — Reference Digest (batch-coffee, Next.js 16 + Supabase + Sanity)

All paths relative to `/Users/vladkruhlyk/Documents/GitHub/git-batch-coffee/web/src/`.

## 1. Config — `lib/wayforpay/config.ts`

```ts
export const WAYFORPAY_PAY_URL = "https://secure.wayforpay.com/pay";
export const WAYFORPAY_API_URL = "https://api.wayforpay.com/api";
export const wayforpayMerchantAccount = process.env.WAYFORPAY_MERCHANT_ACCOUNT || "test_merch_n1";
export const wayforpayMerchantSecret = process.env.WAYFORPAY_MERCHANT_SECRET || "flk3409refn54t54t*FNJRET";
export const wayforpayMerchantDomain =
  process.env.WAYFORPAY_MERCHANT_DOMAIN_NAME ||
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/^https?:\/\//, "") || "batch-coffee.vercel.app";
export const wayforpayIsTestMode = wayforpayMerchantAccount === "test_merch_n1";
```
- Defaults = WayForPay's public TEST merchant so dev works with zero env setup. Test card: `4444 5551 1111 6666` exp 12/24 cvv 123. `wayforpayIsTestMode` drives a UI banner.

## 2. Signatures — `lib/wayforpay/sign.ts`

All three signatures: **HMAC-MD5** (`crypto.createHmac("md5", secret)`), payload = values joined with `;`, output lowercase hex. Arrays expand inline (`productName=["A","B"] → "A;B"`).

**Field orders (exact, order matters):**
- `requestSignature`: `merchantAccount; merchantDomainName; orderReference; orderDate; amount; currency; ...productName; ...productCount; ...productPrice`
- `responseSignature` (webhook verify): `merchantAccount; orderReference; amount; currency; authCode; cardPan; transactionStatus; reasonCode`
- `webhookAck`: `orderReference; status; time` — status `"accept"` stops retries; `time` is Unix seconds, the same value sent back signed.

Timing-safe compare:
```ts
export function timingSafeEqHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex")); }
  catch { return false; }
}
```

## 3. Payload builder — `lib/wayforpay/payload.ts`

```ts
// Fresh ref per attempt so WayForPay doesn't reject duplicates.
const ref = `${order.number}-${randomBytes(4).toString("hex")}`;
const orderDate = Math.floor(Date.now() / 1000);
const productName = order.items.map((i) => trim(i.productName, 96));
```
- **Fresh `provider_order_ref` per attempt** — WayForPay enforces uniqueness per reference; reuse breaks retries.
- **Sign BEFORE inserting** the `payments` row: signRequest is sync crypto, so a failure can't leave an orphan `pending` payments row.
- **Insert the `payments` row BEFORE returning the form** — webhook races the return redirect; the row must exist when the webhook lands. `insert({ order_id, provider: "wayforpay", provider_order_ref: ref, status: "pending", amount: order.total, currency: "UAH" })`, error checked (`if (payErr) throw payErr`).
- Fields are an **ordered array of `{name, value}` pairs, not an object** — `productName[]`/`productPrice[]`/`productCount[]` repeat the same field name; an object can't represent duplicates.
- Key fields: `merchantAuthType: "SimpleSignature"`, `merchantTransactionSecureType: "AUTO"`, `currency: "UAH"`, `language: "UA"`, `defaultPaymentSystem: "card"`, `returnUrl: ${siteUrl}/api/wayforpay/return?orderReference=${encodeURIComponent(ref)}`, `serviceUrl: ${siteUrl}/api/wayforpay/webhook`, `clientPhone: order.recipientPhone.replace(/\D/g, "")`. `clientEmail` only pushed when present.
- Guard: `if (!siteUrl?.startsWith("http")) throw` — WayForPay needs an absolute public URL.
- `trim(s, max)` truncates with `…`: `s.slice(0, max - 1) + "…"`.

## 4. Start route — `app/api/wayforpay/start/route.ts`

`POST { orderId, viewToken }`, `export const runtime = "nodejs"` (crypto.createHmac needs Node). Sequence: 400 missing fields → 404 order not found → 403 `order.viewToken !== body.viewToken` → 409 `order.status !== "pending"` (no double-charge) → `buildWayForPayPayload(order, req.nextUrl.origin)` → JSON `{ action, fields }`.
- **Amount is never taken from the client** — read from DB so tampered checkout can't underpay.
- Whole body wrapped in try/catch returning `NextResponse.json({ error: detail }, { status: 500 })` — *why*: Next's default 500 is HTML, browser `res.json()` chokes, user sees generic error (most common real failure: payments table migration not applied).

## 5. Webhook — `lib/wayforpay/webhook.ts` + `app/api/wayforpay/webhook/route.ts`

Handler returns `{ ack: AckJson | null, detail: string }`; **null ack → route responds 400 → WayForPay retries (~24h)**. That null-ack semantic is the entire reliability story.

Route body parsing:
```ts
// WayForPay quirk: they POST the JSON body with Content-Type `text/plain`.
const raw = await req.text();
const trimmed = raw.trim();
if (trimmed.startsWith("{")) body = JSON.parse(trimmed);
else body = Object.fromEntries(new URLSearchParams(trimmed).entries());
...
if (typeof body.amount === "string") body.amount = Number(body.amount); // form variant sends string
```
- **PCI logging rule**: payload carries `cardPan`/`authCode` — never log raw body. Rejections log only `detail`, `orderReference`, and `Object.keys(body)` (field names, not values).

Handler flow (order is load-bearing):
1. Missing `orderReference` → null ack.
2. **Signature check FIRST** with `timingSafeEqHex(expected, merchantSignature)` — before any DB read/write.
3. Lookup payment by `provider_order_ref` via `.maybeSingle()`; **DB error → null ack** (distinct from not-found → null ack).
4. Status mapping: `Approved → "approved"`, `Declined`/`Refunded` → lowercased, **anything else → "declined"**.
5. Update payment row **unconditionally** (even duplicates refresh `raw_response`); `failure_reason: nextStatus === "approved" ? null : reason || transactionStatus`. **Error → null ack** — *why*: if the write fails but we ack, WayForPay considers it settled while our DB never recorded it.
6. Order → paid:
```ts
if (nextStatus === "approved") {
  const { error } = await supabase.from("orders")
    .update({ status: "paid" }).eq("id", payment.order_id).neq("status", "paid");
  if (error) return { ack: null, ... };
}
```
*Why `.neq` instead of gating on the previously-read `payment.status`*: the conditional update is atomic + idempotent (no double status_events on concurrent deliveries) AND a retry can still complete the order update if a prior delivery wrote the payment but died before the order step. Gating on the stale read would strand orders in `pending`.
7. Refund mapping:
```ts
if (nextStatus === "refunded") {
  await supabase.from("orders").update({ status: "cancelled" })
    .eq("id", payment.order_id).eq("status", "paid");
}
```
*Why*: order_status enum has no `refunded`; `cancelled` is closest customer truth, payments row keeps precise `refunded` for accounting. `.eq("status","paid")` guard so a refund webhook can't clobber later fulfilment states, and stays idempotent.
8. Only then `buildWebhookAck(secret, { orderReference, status: "accept", time: Math.floor(Date.now()/1000) })`.

## 6. Return route — `app/api/wayforpay/return/route.ts`

One `handleReturn(req)` shared by **both GET and POST** — WayForPay sometimes POSTs form-urlencoded to the returnUrl. Ref from `url.searchParams.get("orderReference")`, falling back to parsing the POST body with `URLSearchParams`.
- Lookups (`payments` by ref → `orders` by `payment.order_id`, selecting `number, view_token`) use `.maybeSingle()` and **distinguish error from not-found**: error → redirect `/account/orders` (*why*: on a DB error the customer HAS paid; bouncing to homepage is the worst outcome — logged-in users can still find the order in their list); not-found → redirect `/`.
- Final redirect: `/order/${order.number}?token=${view_token}` with **`{ status: 303 }`** — *why*: forces the browser to follow with GET even when WayForPay POSTed; doesn't trust paid/declined from URL (webhook is the only truth source).

## 7. Order creation — `app/api/orders/create/route.ts`

**Validation** (all before any DB work):
```ts
const MAX_LEN = { name: 100, phone: 32, email: 200, address: 500, city: 120,
  comment: 2000, promo: 50, itemString: 300, thumb: 2000 } as const;
```
*Why caps*: DB columns are unbounded `text`; without caps a tampered client pushes megabyte strings (amplification + bloated backups). Also: ≤100 items; per line `Number.isFinite(unitPrice) && 0 ≤ unitPrice ≤ 1_000_000`, `Number.isInteger(quantity) && 1 ≤ qty ≤ 999`; required `productSlug/productName/weightLabel` non-empty + `weightGrams > 0` finite (*why*: otherwise NOT NULL columns surface as opaque 500 instead of clean 400); deliveryFee finite, `0 ≤ fee ≤ 100_000`.

**Auth split**: identity resolved via cookie-bound client (`createSupabaseServerClient().auth.getUser()` → `userId = user?.id ?? null`), but **INSERT via service-role client** — server decides `user_id`, sidesteps RLS-JWT drift, same trust model. Guests allowed (`user_id: null`).

**Idempotency** (client-generated key, unique index from migration 0009):
```ts
const idemKey = typeof body.idempotencyKey === "string" &&
  /^[A-Za-z0-9-]{8,64}$/.test(body.idempotencyKey) ? body.idempotencyKey : null;
```
Three layers:
1. Pre-check: `select ... .eq("idempotency_key", idemKey).maybeSingle()` → if exists, return `{ id, number, viewToken, replayed: true }`. Lookup error is non-fatal — fall through to insert.
2. Insert with key; **error code `"23505"`** (unique violation = concurrent retry won the race) → re-select by key and return ITS order, same replay contract.
3. **Error code `"42703"`** (column doesn't exist — migration not applied) → re-insert **without** the key. Graceful degradation: orders keep working, dedup kicks in post-migration.

**Server-side pricing** — client `unitPrice` ignored for money; `resolveOrderPricing` (below) returns authoritative prices, `pricing.items` index-aligned with `body.items`. Discount via `resolveOrderDiscount(body.promoCode ?? null, subtotal, new Date())` — client sends **CODE only, never an amount**. `total = subtotal + deliveryFee - discount`; reject `total <= 0`.

**Orphan rollback** (no cross-statement transaction in PostgREST):
```ts
const { error: itemsErr } = await supabase.from("order_items").insert(itemsPayload);
if (itemsErr) {
  let { error: rollbackErr } = await supabase.from("orders").delete().eq("id", order.id);
  if (rollbackErr) ({ error: rollbackErr } = await supabase.from("orders").delete().eq("id", order.id)); // one retry
  if (rollbackErr) console.error("ALERT orders/create ORPHAN ORDER — rollback failed twice, manual cleanup needed:", order.id, rollbackErr);
  return NextResponse.json({ error: itemsErr.message }, { status: 500 });
}
```
*Why the retry*: a stranded orphan order **pins its idempotency key**, permanently blocking the customer's retry.

## 8. Server pricing — `lib/order-pricing.ts`

- **CDN bypass**: `freshClient` (`useCdn: false`, `sanity/lib/client.ts`) + `{ next: { revalidate: 0 } }` — *why*: `revalidate: 0` only controls Next's fetch cache, NOT Sanity's edge cache; a minutes-stale CDN price after a hike underbills. Money paths read the live API.
- GROQ: `*[_type == "product" && slug.current in $slugs]{ "slug": slug.current, weights[]{ label, grams, price, wholesalePrice } }`.
- **Label trim both sides**: Map keys are `(w.label ?? "").trim()`, lookup is `it.weightLabel.trim()` — *why*: a stray trailing space typed in Studio (or persisted in an old cart) must not reject a valid order via Map strict-equality.
- **Grams disambiguation**: label → `RawWeight[]` (arrays, because the schema doesn't enforce label uniqueness; no silent last-one-wins). Duplicates resolved by client's `weightGrams` filtering **real catalog variants only** (`candidates.filter(w => w.grams === it.weightGrams)`; must yield exactly 1 or the line is refused). Client grams can select, never price.
- **Wholesale parity**: per-slug total grams aggregated across lines; if `slugTotal >= WHOLESALE_MIN_KG * 1000` (3 kg) and the product has a 1000 g variant, `unitPrice = Math.round(perKg * (weight.grams / 1000))` where `perKg = wholesalePrice || Math.round(price * (1 - WHOLESALE_DISCOUNT_PERCENT/100))` (15%). Mirrors client display logic (`getWholesalePerKg` + `getEffectiveItems`) so preview === charge.
- Rejects deleted SKUs ("Один із товарів більше недоступний…"), non-positive prices, non-integer quantities, non-positive subtotal. Result shape: `{ ok, items, subtotal, error }`.

## 9. Promo system

**`lib/promo.ts`** — pure, dependency-free `discountFromSnapshot(promo, subtotal)`: used by BOTH client preview and server charge so they compute identically. `PromoSnapshot = { code, discountType: "percent"|"fixed", discountValue, minSubtotal? }`. Clamps: 0 if subtotal ≤ 0, below minSubtotal, or discountValue ≤ 0; `Math.round` once; `Math.max(0, Math.min(discount, subtotal))`.

**`lib/promo-server.ts`** — `resolvePromoRule`: cap 50 chars (last gate before GROQ $param), `trim().toUpperCase()`, fetch via `freshClient` with `{ next: { revalidate: 30, tags: ["promoCode"] } }` (*why*: CDN bypass so disabled codes die immediately; 30s Next cache stops hot-code hammering). GROQ: `*[_type == "promoCode" && upper(code) == $code][0]{ "code": upper(code), discountType, discountValue, active, startsAt, expiresAt, minSubtotal }`.

`evaluatePromo(rule, subtotal, now)` — **the date NaN guard**:
```ts
const startsTs = new Date(rule.startsAt).getTime();
if (!Number.isFinite(startsTs)) return fail("Промокод налаштований некоректно.");
if (startsTs > nowTs) return fail("Промокод ще не діє.");
```
*Why*: `new Date("garbage").getTime()` is NaN, and both `NaN > now` and `NaN < now` are false — the window check would silently pass, letting an expired code apply (underpay vector). Unparseable date = misconfigured = refuse. Also rejects `discountValue <= 0`, percent > 100; minSubtotal message uses **`Math.ceil`** not round (*why*: round(150.4)=150 would mislead a 150₴ cart that still fails). `resolveOrderDiscount` returns 0 for invalid codes — order proceeds at full price.

**`app/api/promo/validate/route.ts`** — advisory only ("the REAL charge is re-validated in orders/create, so this endpoint is safe to expose"). **Always 200 for well-formed requests**; `ok` carries accept/reject + Ukrainian `reason`. Catch wraps the Sanity fetch and degrades to `{ ok:false, reason }` JSON (*why*: HTML 500 breaks the client's `res.json()` "always JSON" contract).

## 10. Checkout client flow — `app/checkout/page.tsx`

**Idempotency key gen**:
```ts
const idemKeyRef = useRef<string | null>(null);
useEffect(() => { idemKeyRef.current = null; }, [items]); // edited basket = NEW intent
// in submit:
if (!idemKeyRef.current && typeof crypto !== "undefined" && "randomUUID" in crypto)
  idemKeyRef.current = crypto.randomUUID();
```
Key is stable across retries of one intent, reset when cart changes; missing `crypto.randomUUID` → no key (graceful, pre-idempotency behavior).

**Cart-clear timing** (the hard-won bit):
- Card path: create order → `POST /api/wayforpay/start` → on failure **cart NOT yet cleared**, so the thrown error renders on the normal form instead of the empty-cart guard hijacking the screen (order stays `pending`, same as any abandoned session). Only after payload received: `clearCart(); setWfpPayload(payload); return;` — `submitting` stays true to keep the spinner.
- COD path: `clearCart()` then `router.push(\`/order/${number}?token=${viewToken}\`)` — clear first so back-nav can't re-submit.

**Render-order guard**: the `if (wfpPayload)` "Перенаправляємо на сторінку оплати…" screen **must come BEFORE** `if (items.length === 0 && !submitting)` — cart is already empty by then; otherwise the empty-cart guard fires, the hidden form never mounts, no redirect, dead end. Empty-cart guard is also skipped while `submitting` (COD clears the cart a tick before push lands → would flash).

**WayForPayAutoForm**: invisible component; effect creates `<form method=POST acceptCharset=utf-8 style.display=none>`, appends hidden inputs from the ordered pairs, appends to body, `setTimeout(() => form.submit(), 0)`, cleanup clears timeout + removes form. Redirect screen includes "Якщо нічого не сталося… перевір, чи не заблокував браузер перехід."

Other checkout patterns: mount-once price refresh against live Sanity (ref-guarded, merges by id against `useCart.getState().items` so in-flight edits aren't undone), then re-validates the stored promo snapshot against the refreshed subtotal via `/api/promo/validate` (display honesty only — server has final word); `extractErrorMessage(e)` handles Error / string / `{message|error|details}` PostgREST objects / JSON.stringify fallback (*why*: previously stringified Supabase errors to `"[object Object]"`); submit posts `unitPrice: it.effectiveUnitPrice` (wholesale-aware) for display while server reprices.

## 11. Order page polling — `app/order/[number]/page.tsx`

Token-gated reads via RPCs `get_order_for_view(p_number, p_token)` / `get_order_events_for_view(p_order_id, p_token)` (`lib/orders.ts`) — guests view by `?token=` (view_token), logged-in owners by RLS.

**Polling effect** — only while `paymentMethod === "card" && status === "pending"`:
```ts
let ticks = 0;
const maxTicks = 40; // 40 × 3s = 2 min
const id = window.setInterval(async () => {
  ticks += 1;
  if (cancelled || ticks > maxTicks) { window.clearInterval(id); return; }
  try {
    const fresh = await getOrderForView(number!, token);
    if (fresh.status !== "pending") { setOrder(fresh); /* refetch events */ window.clearInterval(id); }
  } catch { /* swallow — keep polling */ }
}, 3000);
```
Stops on first non-pending status; gives up after ~2 min. `customerStatusDisplay`: `pending+card` → "Перевіряємо оплату" pill (`bg-sky-100 text-sky-800`) with spinner + explainer "сторінка оновиться сама"; `pending+cod` → "Очікує оплату при отриманні" (`bg-amber-100 text-amber-800`) — *why*: generic statusLabel says "awaiting payment", wrong for someone who just paid by card. "Fresh order" celebration: `Date.now() - createdAt < 30_000`, captured via **lazy useState init** (React 19 strict mode flags `Date.now()` during render as impure); animation `transition={{ duration: 0.6, ease: EASING.smooth, delay: 0.1 }}` with `EASING.smooth = [0.22, 1, 0.36, 1]` (lib/easing.ts; also `expoOut [0.16,1,0.3,1]`, `entrance [0.25,0.1,0.25,1]`, `spring [0.34,1.56,0.64,1]`).

## Architecture invariants (cross-cutting)

1. Client numbers are display-only; server re-derives every monetary value (prices from live Sanity, discount from code, amount from DB).
2. Webhook is the single source of payment truth; return route is navigation-only; signature verified before any DB touch.
3. Every DB write on the money path is error-checked; on the webhook a failed write means no ack (provider retries); on order create a failed items write means compensating delete + retry + ALERT log.
4. Idempotency at three layers: order create (client key + unique index + 23505 race recovery), payment attempt (fresh ref each time), webhook (unconditional payment refresh + conditional `.neq/.eq` order transitions).
5. Graceful migration degradation: 42703 → insert without key; missing payments table surfaces as JSON 500 with real message.
6. All API routes return JSON for every outcome (`runtime = "nodejs"` throughout); never let Next emit an HTML 500.
