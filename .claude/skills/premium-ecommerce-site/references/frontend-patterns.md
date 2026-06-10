# Frontend Patterns Digest — git-batch-coffee/web (Next.js 16 + Zustand + Framer Motion)

All paths relative to `/Users/vladkruhlyk/Documents/GitHub/git-batch-coffee/web/src`.

## 0. Motion tokens — `lib/easing.ts` (verbatim, used everywhere)

```ts
export const EASING = {
  smooth: [0.22, 1, 0.36, 1] as const,   // default curve
  expoOut: [0.16, 1, 0.3, 1] as const,   // big movements (page/hero/panels)
  entrance: [0.25, 0.1, 0.25, 1] as const,
  spring: [0.34, 1.56, 0.64, 1] as const, // subtle bounce for hovers/badges
} as const;
export const DURATION = { fast: 0.3, base: 0.5, slow: 0.8, slower: 1.2 } as const;
```
Doc comment: "NEVER use 'ease', 'linear', or default browser curves."

## 1. Cart store — `lib/cart-store.ts` (Zustand + persist)

**Composite line-item ids** — same product + different variant = new line:
```ts
function makeItemId(slug, weightLabel, roast?, grind?) {
  return `${slug}__${weightLabel}__${roast ?? ""}__${grind ?? ""}`;
}
```

**Persist config** — localStorage key `"batch-cart"`, `version: 1`, migrate drops legacy shape:
```ts
{
  name: "batch-cart",
  version: 1,
  // v0 persisted `promoCode: string`; v1 uses `promo: PromoSnapshot | null`.
  migrate: (persisted, version) => {
    const s = (persisted ?? {}) as Record<string, unknown>;
    if (version < 1) { delete s.promoCode; if (typeof s.promo !== "object") s.promo = null; }
    return s;
  },
  partialize: (state) => ({ items: state.items, promo: state.promo }), // never persist `open`/`lastAddBump`
}
```

**NaN guards** (why: `Math.max(1, NaN)` is NaN and "poisons every total downstream"; in setQuantity NaN "fails the >0 filter and silently deletes the line"):
```ts
// add():
const quantity = Number.isFinite(opts.quantity) && (opts.quantity as number) > 0
  ? Math.floor(opts.quantity as number) : 1;
// setQuantity():
const qty = Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 1;
```

**Add semantics**: `add()` finds existing line by id and increments, else pushes. Sets `lastAddBump: Date.now()` (badge pulse trigger). Deliberately does NOT auto-open the drawer — "auto-opening interrupts browsing on grid pages"; the fly-to-cart ghost is the feedback.

**Price snapshots**: `unitPrice` (retail) and `wholesalePerKg: number | null` (optional for back-compat with pre-field carts) are snapshotted at add-time. Promo: store only a `PromoSnapshot` (code+type+value), never the discount amount — "recomputed from the snapshot for display and re-validated from Sanity on the server for the charge, so the two can't drift and the client can't fake a discount". `replaceItems(items)` exists for checkout's price-refresh step. `clear()` also nulls `promo`.

**Wholesale aggregation** — pure helper, not stored state:
```ts
export function getEffectiveItems(items: CartItem[]): EffectiveCartItem[] {
  const totalGrams = new Map<string, number>();
  for (const i of items)
    totalGrams.set(i.slug, (totalGrams.get(i.slug) ?? 0) + i.weightGrams * i.quantity);
  const minGrams = WHOLESALE_MIN_KG * 1000;
  return items.map((i) => {
    const wholesaleActive = i.wholesalePerKg != null && (totalGrams.get(i.slug) ?? 0) >= minGrams;
    const effectiveUnitPrice = wholesaleActive
      ? Math.round(i.wholesalePerKg! * (i.weightGrams / 1000)) : i.unitPrice;
    return { ...i, effectiveUnitPrice, wholesaleActive };
  });
}
```
`getCartSubtotal` sums `effectiveUnitPrice * quantity`; `getCartCount` sums quantities.

**Wholesale constants** (`lib/wholesale.ts`): `WHOLESALE_DISCOUNT_PERCENT = 15`, `WHOLESALE_MIN_KG = 3`. `getWholesalePerKg(product)`: only SKUs with a `grams === 1000` variant qualify; prefers explicit `kgVariant.wholesalePrice`, falls back to `Math.round(kgVariant.price * 0.85)`.

## 2. Auth store — `lib/auth-store.ts`

**Steps state machine**: `type AuthStep = "idle" | "code-sent" | "needs-profile"`. State: `user, method ("phone"|"email"), pendingPhone, pendingEmail, step, error, errorBump, hydrated`. `errorBump` is a counter incremented with every error so identical consecutive error strings still retrigger shake animations.

**Persist**: key `"batch-auth"`; `partialize: (s) => ({ user: s.user, method: s.method })` — flow state deliberately NOT persisted ("otherwise reopening the tab leaves the login page stuck on a half-finished OTP screen").

**onRehydrateStorage** — hydrated flag + parallel reconcile:
```ts
onRehydrateStorage: () => (state) => {
  if (!state) return;
  state.hydrated = true; // mark immediately so UI can render
  state.syncFromSupabase().catch(() => {});
},
```
Route guards must wait on `hydrated` "to avoid flashing the wrong UI".

**syncFromSupabase** lessons:
- If no session and `get().user` exists → wipe mirror. Gate on **user presence, NOT flow step** — gating on `step === "idle"` "left revoked/deleted accounts with a working cabinet UI". Fail closed.
- Session wins over the localStorage mirror; no merging ("ids may differ").
- Step override only when idle: `step: needsProfile && s.step === "idle" ? "needs-profile" : s.step` (don't clobber in-flight "code-sent").

**ensurePlus** (hard-won invariant — Supabase stores E.164 WITHOUT "+"):
```ts
export function ensurePlus(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  return digits ? "+" + digits : "";
}
```
Every read path re-pluses; every write strips: `phone: phone.replace(/^\+/, "")` in `completeOnboarding` upsert — writing "+380…" "would diverge profiles.phone from auth.users.phone". Onboarding uses **upsert with `{ onConflict: "id" }`**, not update — a plain UPDATE silently affects 0 rows if the `on_auth_user_created` trigger never fired. Phone is required at onboarding because upserting `phone: null` makes `needsProfile` true forever → infinite redirect loop back to the form.

OTP flows: `signInWithOtp({ phone|email, options: { shouldCreateUser: true } })` (auto-provision, no register page); verify with `verifyOtp({ ..., type: "sms"|"email" })`, both 6-digit (`/^\d{6}$/`). After verify, fetch `profiles` row (`first_name, last_name, phone, email, newsletter, is_admin`) via `.maybeSingle()`; `needsProfile = !firstName || !lastName || !phone` drives step. `logout()` wraps `supabase.auth.signOut()` in try/catch and wipes local state regardless — network errors shouldn't strand a logged-in UI.

**Cross-tab sync** (module top-level, after store creation):
```ts
declare global { interface Window { __batchAuthStorageBound?: boolean } }
if (typeof window !== "undefined" && !window.__batchAuthStorageBound) {
  window.__batchAuthStorageBound = true;
  window.addEventListener("storage", (e) => {
    if (e.key === "batch-auth") void useAuth.persist.rehydrate();
  });
}
```
Why the window flag: HMR re-evaluates the module; without it listeners stack and multiply rehydrate calls. `storage` fires only in OTHER tabs → login/logout propagates without refresh.

## 3. Body scroll lock — `lib/use-body-scroll-lock.ts` (VERBATIM, ref-counted)

```ts
import { useEffect } from "react";
let lockCount = 0;
let savedOverflow = "";
function lockBodyScroll() {
  if (typeof document === "undefined") return;
  if (lockCount === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockCount += 1;
}
function unlockBodyScroll() {
  if (typeof document === "undefined") return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) document.body.style.overflow = savedOverflow;
}
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [active]);
}
```
Why: per-component save/restore breaks with two overlapping overlays — the second saves `prev="hidden"`, closing EITHER restores scroll while the other is open. Capture on 0→1, restore on N→0.

## 4. Search — `lib/search-store.ts` + `components/search/search-overlay.tsx`

Store is ultra-thin (`open/openSearch/closeSearch/toggleSearch`) — exists purely to avoid prop drilling from header/Cmd+K/empty-cart CTA.

**Lazy fetch + TTL** (`FRESH_MS = 2 * 60 * 1000`):
```ts
const lastFetchRef = useRef(0); const fetchingRef = useRef(false);
useEffect(() => {
  if (!open || fetchingRef.current) return;
  if (products.length > 0 && Date.now() - lastFetchRef.current < FRESH_MS) return;
  fetchingRef.current = true;
  sanityClient.fetch(PRODUCTS_QUERY)
    .then((raw) => {
      setProducts(raw.map(adaptProduct).filter((p) => p.weights && p.weights.length > 0));
      lastFetchRef.current = Date.now();   // stamp AFTER resolve
    })
    .catch(() => {/* stamp stays stale → next open retries */})
    .finally(() => { fetchingRef.current = false; });
}, [open]);
```
Why: stamping freshness up-front "marks data as fresh even when the request fails slowly... hiding newly published products for a whole TTL window". Filter out weightless products — they'd show `Infinity` starting price.

**Keyboard nav** — track highlight by **slug, not index**: "makes the 'active' anchor stable when results re-rank, and sidesteps the need for an effect to clamp a stale index". `activeIndex` is derived inline (findIndex, fallback 0). ↑/↓ wrap with modulo; Enter does `router.push(...)` ("the old `window.location.href` forced a full page reload + flash"); Escape closes. Focus input via `requestAnimationFrame` on open (let it mount first). Reset query/active 300 ms after close (let exit animation finish). Route-change safety net: `useRef(pathname)` compare in effect → `closeSearch()` so future Links inside the overlay can't leave it stuck open.

**Hotkeys** (`SearchHotkeys`, separate null-rendering component): Cmd/Ctrl+K toggles; bare `/` opens only when `!isTypingTarget(e.target)` (INPUT/TEXTAREA/SELECT/isContentEditable check).

**Shell**: `z-[130]` fixed root; backdrop `bg-[var(--color-text-primary)]/55 backdrop-blur-xl`, fade 0.35s `EASING.smooth`; panel `mt-[8vh] w-[min(720px,94vw)]` (floats near top, "Linear/Vercel" style), enter `{opacity:0, y:-24, scale:0.97}` → 0.5s `EASING.expoOut`. Results list: `<AnimatePresence initial={false}>` + `layout` on each `motion.li` for re-rank animation (0.25s smooth). Scoring: name prefix +100 > name substring +40 > notes +30 > country +20 > bag +5; top 8. Gotcha noted: input needs `focus-visible:outline-none` because a global `:focus-visible` rule wins over plain `outline-none`.

## 5. Fly-to-cart — `lib/cart-fly-store.ts` + `lib/use-add-to-cart.ts` + `components/cart/cart-fly-layer.tsx`

**Separate UI-only store** so cart data model stays pure. `FlyPayload = { id, source: {x,y,width,height}, thumb }`; module-level `let counter = 0`, `trigger` sets `{...payload, id: ++counter}` — id used as React key so the ghost remounts/replays even with identical source/thumb.

**`useAddToCart()`** wraps three concerns: (1) `add(product, opts)`; (2) if a MouseEvent is passed, read `event.currentTarget.getBoundingClientRect()` and `triggerFly({source, thumb: product.gallery[0]})`; (3) **fallback `openCart()` when no source rect** (keyboard/SR activation) so feedback isn't lost.

**CartFlyLayer** (mounted once in `app/providers.tsx`): `pointer-events-none fixed inset-0 z-[140]`, `<AnimatePresence onExitComplete={clear}>{pending && <Ghost key={pending.id} .../>}`. Ghost measures destination via `document.querySelector("[data-cart-target]")` in a **lazy `useState` initializer** ("runs exactly once — no setState-in-effect anti-pattern"; safe because it only mounts after a user action). Parabolic arc:
```ts
const peak = -80;
const yKeyframes = [0, dy * 0.45 + peak, dy];
const xKeyframes = [0, dx * 0.55, dx];
const scaleKeyframes = [1, 0.7, 0.18];
const opacityKeyframes = [1, 1, 0];
// transition: { duration: 0.85, ease: EASING.expoOut, times: [0, 0.55, 1] }
const size = Math.max(48, Math.min(120, source.width));
```
`onAnimationComplete={() => setFinished(true)}` → returns null → AnimatePresence exit → `clear()`.

**Cart icon** (`components/cart/cart-icon-button.tsx`): carries `data-cart-target` on the button itself ("not a child wrapper, so the rect math lines up"). Hydration gate via `useSyncExternalStore`:
```ts
function useHasHydrated(): boolean {
  return useSyncExternalStore(
    (cb) => useCart.persist.onFinishHydration(cb),
    () => useCart.persist.hasHydrated(),
    () => false,  // SSR fallback → count renders 0, no hydration mismatch
  );
}
```
Pulse: icon `motion.span` keyed on `lastAddBump`, `initial={lastAddBump ? {scale:0.85} : false}` → scale 1, 0.5s `EASING.spring`. Badge enters scale 0→1 spring; count swaps inside `<AnimatePresence mode="popLayout">` keyed on `count` (y: -8→0, exit y: 8); ping halo keyed `` `ping-${lastAddBump}` `` scales 1→2.1 / opacity 0.6→0 over 0.7s.

## 6. Product card — `components/shop/product-card.tsx`

- **`compact` prop** (mobile 2-up): `const hideCompact = compact ? "max-sm:hidden" : "";` applied to taste meters, notes, variant pills, stepper, wholesale lines — desktop unaffected. Body padding `compact && "max-sm:gap-3 max-sm:p-4"`, title `max-sm:text-base`.
- **Misconfig guard**: `const weight = product.weights[weightIndex]; if (!weight) return null;` — bad import/draft would otherwise "crash the whole grid".
- Local state per card: `weightIndex`, `roastIndex`, `quantity`. Variant pills: rounded-full, `aria-pressed`, active = `bg-[var(--color-text-primary)] text-[var(--color-text-inverse)]`; single-option roast rendered but `disabled` (visible, not interactive).
- **Wholesale rounding lockstep** (why-comment): "Round PER UNIT then multiply — identical to getEffectiveItems in the cart store. Rounding the whole total once instead diverges by a few UAH... Keep the two formulas in lockstep." Same comment repeated in product-detail.
- Wholesale UI: below threshold → hint line "Гурт від 3 кг — X/кг"; at threshold → green `text-emerald-700` "✓ Гуртова знижка −savings" + retail struck through, **stacked vertically** under price ("12kg-level prices... crash into the stepper" otherwise).
- Image hover: `motion.div whileHover={{ scale: 1.04 }}` 0.9s smooth; grain overlay = inline data-URI SVG `feTurbulence baseFrequency='0.85'` at `opacity-[0.1] mix-blend-overlay`.
- Add button passes the click event: `addToCart(product, { weightIndex, roast, quantity }, e)`.

## 7. Product detail — `components/shop/product-detail.tsx` + `sticky-mobile-cta.tsx`

- All hooks run before the `if (!activeWeight)` early-return graceful "unavailable" screen (rules-of-hooks safe, noted in a comment).
- Grind default: `product.grinds?.[0] ?? "Не молоти"`; but only pass `grind: product.grinds ? grind : undefined` to add — "avoids polluting the line-item id with 'Не молоти' for drip/capsules".
- **Gallery**: `<AnimatePresence mode="sync">` crossfade keyed on `galleryIndex` (opacity only, 0.6s smooth); prev/next with modulo wrap; dots = `h-1` bars, active `w-8` vs `w-4` at /30 opacity.
- **StickyMobileCTA**: parent owns a `primaryCtaRef` on the in-page buy Button; the bar appears only when that scrolls out of view (IntersectionObserver, `threshold: 0`, `setShow(!entry.isIntersecting)`; "a small rootMargin... just creates flicker — leave it sharp"). `lg:hidden fixed inset-x-0 bottom-0 z-[120] pointer-events-none` outer + `pointer-events-auto` card with `style={{ paddingBottom: "env(safe-area-inset-bottom)" }}` for iPhone home indicator. Enter/exit `{ y: 80, opacity: 0 }` 0.35s smooth. Receives the **same** `onAddToCart` handler as the in-page CTA so fly animation fires identically.

## 8. Reveal — `components/animations/reveal.tsx`

```tsx
const inView = useInView(ref, { once: true, margin: margin as `${number}%` }); // default "-10%"
const shouldReduceMotion = useReducedMotion();
const initial = shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y };       // y default 40
const animate = inView ? (shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }) : undefined;
// transition: { duration (default 1), delay, ease: EASING.smooth }
```
Props: `delay=0, y=40, duration=1, margin="-10%"`. "Use this for all scroll-reveals." Stagger via explicit `delay={0.15}` on siblings.

## 9. Catalog — `components/shop/catalog.tsx`

- **Mobile grid-density toggle**: `const [mobileCols, setMobileCols] = useState<1 | 2>(1)` — toolbar pill pair (Square / Grid2x2 icons, `aria-pressed`), `lg:hidden`. Grid: `"grid sm:grid-cols-2 xl:grid-cols-3 sm:gap-5 lg:gap-8"` + `mobileCols === 2 ? "grid-cols-2 gap-3" : "grid-cols-1 gap-5"`, and `<ProductCard compact={mobileCols === 2} />`. Tighter gap at 2-up.
- All filtering/sorting client-side via `useMemo` (small dataset; "if the catalogue grows past ~100 products... move to URL-synced params + server fetch"). Initial categories come from the server page parsing `/shop?category=` into `initialCategories`, seeded via lazy useState initializer.
- Price slider bounds = exact min/max of `getStartingPrice` ("not rounded: the user wants the extremes to read as real product prices").
- Mobile category chips: horizontal scroll row hiding scrollbar with `[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`, toggling the **same** `filters.categories` state as the desktop sidebar.
- Desktop sidebar: `sticky top-28 max-h-[calc(100vh-9rem)] overflow-y-auto [overscroll-behavior:contain]` + **`data-lenis-prevent`** to opt out of global Lenis smooth-scroll (wheel events otherwise eaten by the root scroller). Same attribute on the mobile drawer's scroll area.
- Sort dropdown: AnimatePresence `{opacity:0, y:-6}` 0.25s smooth, `z-30`.
- Ukrainian plural helper `plural(n, ["товар","товари","товарів"])` with mod10/mod100 rules.

## 10. AnimatePresence overlay/drawer conventions (recurring)

- Pattern: `<AnimatePresence>{open && (<backdrop motion.div key="backdrop" opacity fade/>) }{open && (<panel motion.div key="drawer"/>)}</AnimatePresence>`; backdrop `onClick` closes, `aria-hidden`; panel `role="dialog"` + `aria-label`/`aria-modal`.
- Right drawer slide: `initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}`, 0.4s `EASING.smooth`, `w-full sm:w-[420px]`.
- z-index ladder: sort dropdown `z-30` < drawer backdrop `z-40` / drawer `z-50` < sticky CTA `z-[120]` < search `z-[130]` < fly layer `z-[140]`.
- `AnimatePresence onExitComplete` for post-exit cleanup (fly layer); `mode="popLayout"` for count swaps; `mode="sync"` for gallery crossfade; `initial={false}` to skip first-mount animation on lists.
- Every overlay uses the shared ref-counted `useBodyScrollLock(open)`.

## 11. Misc conventions

- All colors via CSS vars: `--color-bg-primary/secondary`, `--color-text-primary/secondary/muted/inverse`, `--color-border-default/strong`; radii `--radius-md/lg/xl/2xl`; `--section-gap` for page bottom padding.
- Prices always `tabular-nums`; micro-labels `text-[10px]/[11px] tracking-[0.18em–0.3em] uppercase`; display font class `font-display` with tight negative tracking (`-0.02em` to `-0.04em`); headline sizes via `clamp()` e.g. `text-[clamp(2rem,4.5vw,4.25rem)]`.
- Buttons: pill (`rounded-full`), primary = `bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] hover:opacity-85`; icon buttons `grid h-N w-N place-items-center`.
- Thumbs are CSS `background-image` values (gradients or url(...)) stored in `product.gallery[]` — enables the fly ghost and cart thumbs without `<img>` loading.
- `web/AGENTS.md` warning: Next.js version has breaking changes — read `node_modules/next/dist/docs/` before writing code.
