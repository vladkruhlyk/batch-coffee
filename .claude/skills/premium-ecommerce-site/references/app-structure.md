# BATCH Coffee — App Structure Digest (Next.js 16 e-commerce)

Root: `/Users/vladkruhlyk/Documents/GitHub/git-batch-coffee/web`

## Stack (package.json, exact versions)

- `next 16.2.4`, `react 19.2.4`, `react-dom 19.2.4`, TS 5
- `tailwindcss ^4` + `@tailwindcss/postcss ^4` (CSS-first, **no tailwind.config file**)
- `framer-motion ^12.38.0`, `lenis ^1.3.23` (smooth scroll)
- `@tanstack/react-query ^5.99.2`, `zustand ^5.0.12` (UI/cart stores), `react-hook-form ^7.73.1`, `zod ^4.3.6`
- `sanity ^5.25.0`, `next-sanity ^12.4.5`, `@sanity/client ^7.22.0`, `@sanity/image-url ^2.1.1` (CMS, embedded Studio)
- `@supabase/ssr ^0.10.3`, `@supabase/supabase-js ^2.105.4` (auth + orders DB)
- `clsx ^2.1.1` + `tailwind-merge ^3.5.0` (cn), `lucide-react ^1.8.0`
- Dev: `pg`, `tsx`, `dotenv` (migration scripts)
- AGENTS.md warns: "This is NOT the Next.js you know" — read `node_modules/next/dist/docs/` before coding against Next 16.

## Configs

**next.config.ts** — only one thing: whitelist Sanity CDN for next/image:
```ts
images: { remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io" }] }
```
**postcss.config.mjs**: `plugins: { "@tailwindcss/postcss": {} }`. Tailwind v4 configured entirely in `globals.css` via `@import "tailwindcss"` + `@theme inline`.
**tsconfig**: alias `"@/*": ["./src/*"]`.

## src/ tree (condensed)

```
src/app/
  layout.tsx providers.tsx template.tsx globals.css error.tsx not-found.tsx
  page.tsx robots.ts sitemap.ts favicon.ico
  fonts/sn-pro/{SNPro-Variable.ttf, SNPro-Variable-Italic.ttf}   # self-hosted display font
  about/ brew-guide/[method]/ cart/ checkout/(+loading.tsx) compare/ contacts/
  delivery/ faq/ journal/[slug]/ login/ order/[number]/ order/success/
  privacy/ terms/ shop/[slug]/ subscription/(+setup/) visit/
  account/{layout.tsx, page, orders, profile, subscriptions}
  admin/{layout.tsx, page, orders/[id], customers/[id]}
  studio/{layout.tsx, [[...tool]]/page.tsx}                       # embedded Sanity Studio
  api/{auth/send-sms, orders/create, promo/validate, revalidate,
       wayforpay/{start,return,webhook}}/route.ts
src/components/
  layout/    # container, header, footer, cookie-banner, loader-overlay,
             # legal-page, page-stub, section-kicker — chrome + shared scaffolding
  ui/        # button.tsx — generic primitives only
  home/      # hero, ribbon, categories, bestsellers, featured-coffee, about,
             # subscription, banners, journal, visit, newsletter — one file per home section
  shop/      # catalog, filter-sidebar, filters-config, product-card, product-detail,
             # origin-panel, taste-meters, brewing-recipe, quantity-stepper, sticky-mobile-cta
  cart/      # cart-drawer, cart-fly-layer, cart-icon-button, free-shipping-progress
  search/    # search-button, search-overlay (overlay exports SearchHotkeys too)
  account/ admin/ subscription/ animations/{reveal, stagger, word-reveal, marquee}
src/lib/     # easing.ts, utils.ts, site.ts, *-store.ts (zustand), use-*.ts hooks,
             # supabase/{client,server,middleware,env}, wayforpay/, shipping, promo, orders
src/data/    # static fallbacks: products.ts, brew-guides.ts, journal.ts, mock-account.ts
src/sanity/  # env.ts, queries.ts, lib/{client,fetchers,adapters,image}, schemaTypes/, structure.ts
src/middleware.ts
```
Organization philosophy: **components grouped by feature domain, not type**; `ui/` is reserved for true primitives; `animations/` holds reusable motion wrappers; nothing page-specific in `ui/` or `layout/`. Each page composes `<Header/> <main className="flex-1"> … </main> <Footer/>` itself (no global header in root layout — Studio must escape it).

## Root layout (src/app/layout.tsx)

- Fonts: **SN Pro** (local variable TTF, `variable: "--font-display"`, `weight: "200 900"` normal+italic, `display: "swap"`, fallback `["system-ui","-apple-system","Segoe UI","sans-serif"]`) — display face for headings/prices/watermarks; only 2 variable files ≈670 KB instead of per-weight files. **Onest** via `next/font/google` (`variable: "--font-sans"`, `subsets: ["latin","cyrillic"]`, weights 300–700) — body/UI.
- Metadata: `title: { default: "BATCH Coffee Roastery", template: "%s — BATCH Coffee" }`, `metadataBase: new URL(SITE_URL)`, openGraph `locale: "uk_UA"`.
- Shell:
```tsx
<html lang="uk" className={`${snPro.variable} ${onest.variable} h-full antialiased`}>
  <body className="min-h-full flex flex-col"><Providers>{children}</Providers></body>
</html>
```
(`flex flex-col` + per-page `main.flex-1` = sticky footer.)

## src/app/providers.tsx (load-bearing, near-verbatim)

```tsx
"use client";
export function Providers({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false } },
  }));
  // Studio routes: stripped tree — no Lenis (fights Studio's internal scroll
  // containers), no global overlays, no scroll-reset.
  const isStudio = pathname?.startsWith("/studio");
  if (isStudio) return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  return (
    <ReactLenis root options={{
      lerp: 0.1, duration: 1.2, smoothWheel: true,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    }}>
      <QueryClientProvider client={queryClient}>
        <LoaderOverlay />
        <ScrollResetOnRouteChange />
        {children}
        {/* Global overlays — mounted once, opened via their respective stores. */}
        <CartDrawer /><CartFlyLayer /><SearchOverlay /><SearchHotkeys /><CookieBanner />
      </QueryClientProvider>
    </ReactLenis>
  );
}
```
**ScrollResetOnRouteChange** (why: Lenis on `root` keeps internal scroll state and overrides browser scroll-to-top on navigation — without this, navigating long→short page strands users in the footer):
```tsx
function ScrollResetOnRouteChange() {
  const pathname = usePathname();
  const lenis = useLenis();
  const isFirst = useRef(true); // skip first mount: don't fight #anchor deep links / SSR scroll restoration
  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    if (lenis) lenis.scrollTo(0, { immediate: true }); // immediate: user expects a clean page, not a 1s glide
    else if (typeof window !== "undefined") window.scrollTo(0, 0);
  }, [pathname, lenis]);
  return null;
}
```
Watches `usePathname` only — same-path query-string changes (shop filters) must NOT yank scroll.

## src/app/template.tsx (page transition)

```tsx
export default function Template({ children }) {
  return (
    <motion.div initial={false} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: EASING.smooth }}>
      {children}
    </motion.div>
  );
}
```
Comment documents tuning history: 600ms/12px = "too sluggish" complaint; 180ms opacity-only = "not smooth" complaint; settled on **320ms + 4px lift** (content at 60% opacity by ~200ms perceived wait). Note `initial={false}` in current code.

## Easing tokens (src/lib/easing.ts) — "NEVER use 'ease', 'linear', or default browser curves"

```ts
export const EASING = {
  smooth:   [0.22, 1, 0.36, 1],   // default
  expoOut:  [0.16, 1, 0.3, 1],    // big movements / hero reveals
  entrance: [0.25, 0.1, 0.25, 1],
  spring:   [0.34, 1.56, 0.64, 1],// hover bounce
} as const;
export const DURATION = { fast: 0.3, base: 0.5, slow: 0.8, slower: 1.2 } as const;
```

## globals.css (Tailwind v4, 225 lines)

`@import "tailwindcss";` then `:root` tokens:
```css
--color-bg-primary:#FFFFFF; --color-bg-secondary:#F7F5F1; --color-bg-surface:#FFFFFF;
--color-bg-dark:#1A1612;            /* warm black, used sparingly */
--color-text-primary:#1A1612;       /* warm black, NOT #000 */
--color-text-secondary:#6B6660; --color-text-muted:#A8A29A; --color-text-inverse:#FFFFFF;
--color-border-default:#EBE7DF; --color-border-strong:#D9D2C4;
--color-accent:#2B1F15; --color-accent-hover:#3D2817;
--section-gap:clamp(5rem,10vw,10rem); --section-gap-sm:clamp(3rem,6vw,5rem);
--radius-sm:.625rem; --radius-md:1rem; --radius-lg:1.5rem; --radius-xl:2rem;
--radius-2xl:2.75rem; --radius-pill:9999px;
```
`@theme inline { --color-bg-primary: var(--color-bg-primary); … --font-display: var(--font-display); --font-sans: var(--font-sans); }` — registers same-named vars so Tailwind v4 emits utilities (`bg-bg-primary`, `text-text-muted`, `font-display`).

Base styles with hard-won fixes:
- `html { scroll-behavior: auto; }` — Lenis needs this to take over.
- `html, body { overscroll-behavior-x: none; }` — kills macOS trackpad swipe = history back/forward; critical because horizontal carousels exist.
- `body { font-feature-settings: "ss01","ss02"; overflow-x: hidden; }`
- `h1–h6 { font-family: var(--font-display); letter-spacing: -0.02em; line-height: 1; font-weight: 500; }`
- `::selection { background: var(--color-text-primary); color: var(--color-bg-primary); }`
- Focus ring **wrapped in `@layer base`**: unlayered rules outrank `@layer utilities`, so per-element `focus-visible:outline-none` Tailwind overrides only win if the global `:focus-visible { outline: 2px solid …; outline-offset: 3px }` lives inside a layer.
- `@media (prefers-reduced-motion: reduce)` global kill-switch (0.01ms durations).
- Lenis required CSS block: `html.lenis, html.lenis body { height: auto; }`, `.lenis.lenis-smooth { scroll-behavior: auto !important; }`, `.lenis.lenis-smooth [data-lenis-prevent] { overscroll-behavior: contain; }`, `.lenis.lenis-stopped { overflow: clip; }`, `.lenis.lenis-smooth iframe { pointer-events: none; }`.
- `.batch-range-input` dual-thumb slider: `pointer-events: none` on input, `pointer-events: auto` only on thumb pseudo-elements (so empty rail doesn't steal clicks); focus ring moved to thumb via `box-shadow` because global outline would circle the transparent track.

## Route map + rendering modes

| Route | Mode |
|---|---|
| `/` (home), `/shop`, `/contacts`, `/journal`, `/brew-guide` | ISR `export const revalidate = 60` (Sanity content) |
| `/shop/[slug]`, `/journal/[slug]`, `/brew-guide/[method]` | ISR 60 + `generateStaticParams()` |
| `/about`, `/visit`, `/subscription`, `/delivery`, `/privacy`, `/terms`, `/not-found`, `/account/subscriptions` | static server components (metadata exported per page) |
| `/cart`, `/checkout` (+`loading.tsx`), `/compare`, `/faq`, `/login`, `/order/[number]`, `/order/success`, `/account/*` (page/orders/profile), `/admin/*` pages | `"use client"` |
| `/studio/[[...tool]]` | `export const dynamic = "force-static"` (Sanity convention) |
| API: `auth/send-sms`, `orders/create`, `promo/validate`, `revalidate`, `wayforpay/{start,return,webhook}` | route handlers |
| `robots.ts`, `sitemap.ts` | derive URLs from `SITE_URL` |

Nested layouts:
- **account/layout.tsx**: `Header + main.flex-1 > AccountShell (auth guard + sidebar) + Footer`; layout persists between sibling navs so sidebar active-pill animation stays smooth.
- **admin/layout.tsx**: async **server component** gate — no session → `redirect("/login?next=/admin")`; `is_admin=false` → silent `redirect("/")`. "Server-side means hostile client can't bypass by disabling JS; RLS backstops every query anyway."
- **studio/layout.tsx**: bare `<>{children}</>` + `export const metadata = { robots: { index: false, follow: false } }` — Studio renders its own chrome; ours would fight it.

**middleware.ts**: single job — `updateSupabaseSession(request)` to refresh auth cookie (RLS does authz, no route gating). Matcher excludes internals/statics/Studio:
```ts
matcher: ["/((?!_next/static|_next/image|favicon.ico|studio|api/revalidate|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico|ttf|woff|woff2)).*)"]
```
Studio excluded because "it's its own auth realm and shouldn't touch our Supabase session cookies."

## UI primitives

**Container** (`components/layout/container.tsx`) — all sections use it for edge alignment:
```ts
sizeMap = { narrow:"max-w-[720px]", default:"max-w-[1200px]", wide:"max-w-[1440px]", full:"max-w-none" };
// wrapper: "mx-auto w-full px-6 md:px-10 lg:px-16"
```
narrow = articles/brew guides; wide = shop grid/hero.

**SectionKicker** — editorial label `N°01 · КАТАЛОГ` at top of every home section: `flex items-center gap-4 text-[11px] tracking-[0.3em] uppercase font-sans font-medium`; optional `number` renders `N°{number}` in `font-display text-sm`; `w-8 h-px` rule span between; `inverse` prop swaps to `text-white/60` / `bg-white/30`.

**Button** (`components/ui/button.tsx`) — polymorphic via discriminated union `ButtonAsButton | ButtonAsLink` (`href?: never` on button branch); renders `next/link` when `href` present (forwards `target/rel/onClick` — onClick useful for closing cart drawer on nav). Variants: primary (dark fill → `--color-accent-hover`), secondary (outlined, inverts on hover), ghost, link. Sizes: `sm: px-5 py-2.5 text-xs / md: px-7 py-3.5 text-sm / lg: px-9 py-4.5 text-base`; `link` skips size classes. Base:
```
inline-flex items-center justify-center gap-2 font-sans text-sm tracking-wide
transition-all duration-300 ease-out active:scale-[0.98] active:duration-75
disabled:opacity-40 disabled:pointer-events-none rounded-full
```
Why `active:scale-[0.98] active:duration-75`: tap registers instantly without waiting for navigation/network.

**cn** (`lib/utils.ts`): `twMerge(clsx(inputs))`. Also `formatPrice`: deterministic UAH formatting (no `Intl` — avoids server/client locale drift); thousands grouped with thin NBSP `\u202F`, `\u00A0₴` suffix.

## LoaderOverlay — once-per-browser splash (components/layout/loader-overlay.tsx)

Pattern essentials:
- 4 PNG frames (`public/2.png`…`5.png`; empty `1.png` dropped — starts with one petal filled). **All frames rendered stacked at mount** (`fill priority`, absolute) so swaps are preloaded/instant; visibility via inline `opacity` + `transition: opacity 320ms cubic-bezier(0.22,1,0.36,1)`.
- Constants: `FRAME_INTERVAL_MS=360`, `CROSSFADE_MS=320` (crossfade < tick so frames fully resolve — avoids muddy ghost-overlap), `HOLD_AFTER_LAST_MS=380`, `FADE_OUT_MS=600`, `STORAGE_KEY="batch-loader-shown-v2"`.
- Timing history in comments: ~4.2s "too slow" → 1.5s "over before it registered + Onest font hadn't loaded so first paint flashed system-ui" → settled ~2.5s total.
- **localStorage, not sessionStorage**: exactly once per browser; per-session replay "felt annoying."
- Gate via `useSyncExternalStore(subscribeToStorage, shouldShowLoader, () => false)` — no hydration mismatch because getServerSnapshot is used for both SSR and the hydration render; splash appears in the intended post-hydration re-render.
- `localStorage.setItem` only **after** completion — otherwise React StrictMode's dev double-mount trips the early return and skips the splash.
- Body scroll locked via shared ref-counted `useBodyScrollLock(show)` hook (same one cart drawer + search overlay use) — direct `body.overflow` writes used to race other overlays' locks ("whoever restored last won").
- Exit: outer `motion.div` (fixed inset-0 `z-[9999]` bg-white) fades out over 0.6s; inner container `initial {opacity:0, scale:0.94}` → `{1, 1}`, exit `scale:1.04` so it "lifts off" rather than blinking; ease `[0.22,1,0.36,1]`.

## Env vars (all names)

`NEXT_PUBLIC_SITE_URL` (canonical URL; `lib/site.ts` strips trailing slashes, falls back to `https://batch-coffee.vercel.app`; single source for SEO + payment return URLs — previously robots/sitemap hardcoded the Vercel domain while layout used the real one, producing conflicting canonicals), `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`, `NEXT_PUBLIC_SANITY_API_VERSION` (default `"2024-11-01"`, pinned), `SANITY_API_TOKEN`, `SANITY_WEBHOOK_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SMS_HOOK_SECRET`, `WAYFORPAY_MERCHANT_ACCOUNT`, `WAYFORPAY_MERCHANT_DOMAIN_NAME`, `WAYFORPAY_MERCHANT_SECRET`.

Convention: each service has an `env.ts` (`src/sanity/env.ts`, `src/lib/supabase/env.ts`) with a `required(name, value)` thrower — validates once at module load, re-exports typed constants; "fails loud at startup rather than as a mysterious 401 at request time." Server-only tokens exported as possibly-undefined, never `required` (they're absent on client).

## Key conventions summary

- Feature-domain component folders; `ui/` for primitives only; global overlays mounted once in Providers, opened via zustand stores.
- All motion uses `EASING` tokens; CSS colors only via `var(--color-*)` tokens.
- ISR 60s for all CMS-backed pages; client components for cart/checkout/account; server-gated admin; Studio fully isolated (providers branch, middleware exclusion, bare layout, noindex).
- Files: `/Users/vladkruhlyk/Documents/GitHub/git-batch-coffee/web/src/app/{layout,providers,template}.tsx`, `src/app/globals.css`, `src/lib/{easing,utils,site}.ts`, `src/components/layout/{container,section-kicker,loader-overlay}.tsx`, `src/components/ui/button.tsx`, `src/middleware.ts`.
