# BATCH Coffee — Design System Reference (Next.js 16 + Tailwind v4)

## 1. Design tokens — `src/app/globals.css` (verbatim)

```css
@import "tailwindcss";

:root {
  /* Background — bright, editorial; warm undertones minimal */
  --color-bg-primary: #FFFFFF;      /* pure white, main bg */
  --color-bg-secondary: #F7F5F1;    /* very light cream, secondary blocks */
  --color-bg-surface: #FFFFFF;      /* cards */
  --color-bg-dark: #1A1612;         /* warm black — used sparingly (footer, dark ribbon) */

  --color-text-primary: #1A1612;    /* warm black, NOT #000 */
  --color-text-secondary: #6B6660;  /* warm gray */
  --color-text-muted: #A8A29A;      /* lighter gray — bumped for contrast on pure white */
  --color-text-inverse: #FFFFFF;

  --color-border-default: #EBE7DF;  /* very light sand */
  --color-border-strong: #D9D2C4;   /* sand */

  --color-accent: #2B1F15;          /* dark espresso */
  --color-accent-hover: #3D2817;

  --section-gap: clamp(5rem, 10vw, 10rem);
  --section-gap-sm: clamp(3rem, 6vw, 5rem);

  /* Radius scale — brand reads soft/rounded everywhere */
  --radius-sm: 0.625rem;   /* 10px — small chips, inputs */
  --radius-md: 1rem;       /* 16px — buttons if not pill */
  --radius-lg: 1.5rem;     /* 24px — product cards, small tiles */
  --radius-xl: 2rem;       /* 32px — large tiles, feature cards */
  --radius-2xl: 2.75rem;   /* 44px — hero / banner frames */
  --radius-pill: 9999px;
}
```

## 2. Tailwind v4 `@theme inline` registration pattern

Self-referencing registration makes tokens available as Tailwind utilities while keeping `:root` the single source of truth:

```css
@theme inline {
  --color-bg-primary: var(--color-bg-primary);
  --color-bg-secondary: var(--color-bg-secondary);
  --color-bg-surface: var(--color-bg-surface);
  --color-bg-dark: var(--color-bg-dark);
  --color-text-primary: var(--color-text-primary);
  --color-text-secondary: var(--color-text-secondary);
  --color-text-muted: var(--color-text-muted);
  --color-text-inverse: var(--color-text-inverse);
  --color-border-default: var(--color-border-default);
  --color-border-strong: var(--color-border-strong);
  --color-accent: var(--color-accent);
  --color-accent-hover: var(--color-accent-hover);
  /* Fonts registered as CSS variables via next/font in layout.tsx */
  --font-display: var(--font-display);
  --font-sans: var(--font-sans);
}
```

This enables `font-display` / `font-sans` utility classes. NOTE: in practice components consume colors via **inline arbitrary values** (`bg-[var(--color-bg-dark)]`, `text-[var(--color-text-muted)]`, `border-[var(--color-border-default)]`, `rounded-[var(--radius-xl)]`) rather than the generated utility names — grep-friendly and unambiguous.

## 3. Base styles + hard-won lessons (globals.css)

```css
html {
  scroll-behavior: auto;        /* Lenis needs this to take over smooth scroll */
  overscroll-behavior-x: none;  /* kills macOS trackpad swipe = back/forward; critical
                                   for horizontal-scroll components (carousel) */
}
body {
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-family: var(--font-sans), system-ui, -apple-system, sans-serif;
  font-feature-settings: "ss01", "ss02";
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  overflow-x: hidden;
  overscroll-behavior-x: none;
}
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-display), "Inter", system-ui, sans-serif;
  letter-spacing: -0.02em; /* SN Pro is humanist — only mild negative tracking */
  line-height: 1;
  font-weight: 500;
}
::selection { background-color: var(--color-text-primary); color: var(--color-bg-primary); }

/* Focus MUST live in @layer base — unlayered rules outrank @layer utilities,
   so per-element `focus-visible:outline-none` overrides wouldn't win otherwise */
@layer base {
  :focus-visible { outline: 2px solid var(--color-text-primary); outline-offset: 3px; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* Lenis smooth scroll base */
html.lenis, html.lenis body { height: auto; }
.lenis.lenis-smooth { scroll-behavior: auto !important; }
.lenis.lenis-smooth [data-lenis-prevent] { overscroll-behavior: contain; }
.lenis.lenis-stopped { overflow: clip; }
.lenis.lenis-smooth iframe { pointer-events: none; }
```

Also contains `.batch-range-input` (dual-thumb price slider): inputs absolutely stacked, `pointer-events: none` on input, `pointer-events: auto` on thumb pseudo-elements only (so the rail doesn't steal clicks); thumb = 18px, `border-radius: 9999px`, `background: var(--color-text-primary)`, `border: 2px solid var(--color-bg-primary)`, `box-shadow: 0 1px 4px rgba(0,0,0,0.18)`; focus ring on thumb only via `:focus-visible::-webkit-slider-thumb { box-shadow: 0 0 0 4px rgba(0,0,0,0.18) }` because the global outline would circle the transparent track.

## 4. Fonts — `src/app/layout.tsx`

Display = SN Pro (self-hosted variable, Cyrillic support); body/UI = Onest (Google, Cyrillic-native). Variable files cover 200–900 so only ~670 KB ships total.

```tsx
import { Onest } from "next/font/google";
import localFont from "next/font/local";

const snPro = localFont({
  variable: "--font-display",
  display: "swap",
  src: [
    { path: "./fonts/sn-pro/SNPro-Variable.ttf", style: "normal", weight: "200 900" },
    { path: "./fonts/sn-pro/SNPro-Variable-Italic.ttf", style: "italic", weight: "200 900" },
  ],
  fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});

const onest = Onest({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

// <html lang="uk" className={`${snPro.variable} ${onest.variable} h-full antialiased`}>
//   <body className="min-h-full flex flex-col">
```

## 5. Easing — `src/lib/easing.ts` (verbatim, complete)

```ts
/** Canyon-level easing curves.
 * Use these for all Framer Motion transitions. NEVER use 'ease', 'linear', or default browser curves. */
export const EASING = {
  /** Smooth — main transition curve, use by default */
  smooth: [0.22, 1, 0.36, 1] as const,
  /** Exponential out — for bigger movements (page transitions, hero reveals) */
  expoOut: [0.16, 1, 0.3, 1] as const,
  /** Entrance — soft appearance of elements */
  entrance: [0.25, 0.1, 0.25, 1] as const,
  /** Spring-like — subtle bounce for hover states */
  spring: [0.34, 1.56, 0.64, 1] as const,
} as const;

/** Timing constants (seconds for Framer Motion, ms for CSS). */
export const DURATION = {
  fast: 0.3,
  base: 0.5,
  slow: 0.8,
  slower: 1.2,
} as const;
```

Canonical consumer (`src/components/animations/reveal.tsx`): scroll reveal, `useInView(ref, { once: true, margin: "-10%" })`, `initial={{ opacity: 0, y: 40 }}` → `{ opacity: 1, y: 0 }`, `transition={{ duration: 1, delay, ease: EASING.smooth }}`, with `useReducedMotion()` dropping the `y` to opacity-only.

## 6. Layout container — `src/components/layout/container.tsx`

```tsx
const sizeMap = {
  narrow: "max-w-[720px]",   // text-heavy pages (article, brew-guide method)
  default: "max-w-[1200px]", // most content pages
  wide: "max-w-[1440px]",    // shop grid, hero sections
  full: "max-w-none",
};
// wrapper: "mx-auto w-full px-6 md:px-10 lg:px-16"
```

Section rhythm: home sections = `<section className="relative py-[var(--section-gap)] bg-[var(--color-bg-primary)] overflow-hidden">`; inner pages = `<Container size="wide" className="pt-28 lg:pt-36 pb-[var(--section-gap)]">` (extra top padding clears fixed header).

## 7. Typography scale (recurring exact recipes)

**Kicker** (the signature micro-label, used everywhere):
`text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]` — on dark: `text-white/70` or `text-white/60`. Variants: `text-[10px] tracking-[0.25em]` (status pills), `tracking-[0.2em]`/`tracking-[0.22em]` (meta rows).

**SectionKicker component** (`src/components/layout/section-kicker.tsx`) — editorial "N°01 · ЛЕЙБЛ" label atop every home section:
```tsx
<div className={cn("flex items-center gap-4 text-[11px] tracking-[0.3em] uppercase font-sans font-medium",
  inverse ? "text-white/60" : "text-[var(--color-text-muted)]")}>
  {number && <span className="font-display text-sm">N°{number}</span>}
  <span className={cn("block w-8 h-px", inverse ? "bg-white/30" : "bg-[var(--color-border-strong)]")} aria-hidden />
  <span>{label}</span>
</div>
```

**Headings** — always `font-display font-semibold` + clamp + tight negative tracking that grows with size:
- Hero h1: `text-[clamp(2.25rem,5.5vw,5.5rem)] leading-[0.98] tracking-[-0.045em]`
- Page h1: `text-[clamp(2rem,4.5vw,4rem)] leading-[1.02] tracking-[-0.04em] mt-10` (after kicker)
- Sub-page h1: `text-[clamp(2rem,4.5vw,3.75rem)] leading-[1.02] tracking-[-0.04em]`
- Section h2 (home): `text-[clamp(1.875rem,4.2vw,4rem)] leading-[1] tracking-[-0.045em] mt-10 max-w-3xl`
- Admin/utility h1: `font-display text-3xl lg:text-4xl font-semibold tracking-[-0.025em]`
- Card title: `font-display text-xl lg:text-[22px] font-semibold leading-[1.1] tracking-[-0.02em]`
- Giant watermark (hero bg): `font-display font-extralight text-[clamp(5rem,8vw,9rem)] leading-[0.85] text-white/[0.06] tracking-[-0.05em]`
- 404 numeral: `text-[clamp(6rem,18vw,12rem)] font-semibold leading-none ... tabular-nums`

Rule of thumb: tracking −0.02em (small) → −0.025em (3xl/4xl) → −0.035em (~3rem) → −0.04em (~4rem) → −0.045em/−0.05em (hero/display). Prices/numbers always get `tabular-nums`.

## 8. Dark tile + gradient conventions

**Dark tile recipe** (footer, newsletter, CTA cards, hero): `bg-[var(--color-bg-dark)] text-[var(--color-text-inverse)]` + large radius:
```tsx
<div className="relative overflow-hidden rounded-[var(--radius-2xl)] bg-[var(--color-bg-dark)] text-[var(--color-text-inverse)] px-7 py-14 sm:px-12 sm:py-16 lg:px-20 lg:py-24">
```
On dark, all secondary text/borders use white alpha steps: `text-white/70`, `text-white/60`, `text-white/50`, `border-white/30`, `border-white/10`, `bg-white/30`.

**Radial-ellipse gradients replace photography** — every "image" tile is an inline-style warm radial gradient (coffee tones), e.g.:
```ts
// hero base + warm glow overlay (two stacked layers)
"radial-gradient(ellipse at 25% 60%, #3F2818 0%, #1A1210 55%, #0A0705 100%)"
"radial-gradient(ellipse at 80% 20%, rgba(200, 140, 80, 0.25) 0%, transparent 45%)"
// product tiles (per-item, off-center ellipse, 3 stops bright→dark)
"radial-gradient(ellipse at 30% 30%, #C9573E 0%, #6A1E14 55%, #2A0A08 100%)"
"radial-gradient(ellipse at 60% 50%, #A06536 0%, #2F1A0E 70%, #120806 100%)"
"radial-gradient(ellipse at 50% 55%, #8B2E22 0%, #1A0806 75%)"
// dark-tile accent glow (alpha, on top of bg-dark)
"radial-gradient(ellipse at 85% 20%, rgba(201,144,86,0.28) 0%, transparent 55%)"
```
Pattern: ellipse origin off-center (25–60% x), 2–3 stops from saturated warm midtone to near-black; applied via `style={{ backgroundImage: ... }}`. Hero text legibility scrim: `absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[var(--color-bg-dark)] via-[var(--color-bg-dark)]/60 to-transparent z-[1]`. Hero shell: `relative h-[100svh] min-h-[640px] flex items-end overflow-hidden bg-[var(--color-bg-dark)]`.

## 9. Shadow conventions

No Tailwind shadow presets for elevation — arbitrary long-throw soft shadows, scaled by elevation:
- Floating overlays/dialogs: `shadow-[0_30px_70px_-12px_rgba(0,0,0,0.4)]` (modal), `shadow-[0_24px_60px_-12px_rgba(0,0,0,0.35)]` (compare dialog), `shadow-[0_24px_60px_-16px_rgba(0,0,0,0.4)]` (cookie banner, + `backdrop-blur-md`)
- Fly-to-cart ghost: `shadow-[0_18px_40px_-12px_rgba(0,0,0,0.35)]`
- Sticky mobile CTA: `shadow-[0_8px_28px_-8px_rgba(0,0,0,0.25)]` + `bg-[var(--color-bg-primary)]/95 backdrop-blur-md`
- Toggle knob: `shadow-[0_1px_3px_rgba(0,0,0,0.18)]`

Cards get NO shadow — elevation via `border border-[var(--color-border-default)]` with `hover:border-[var(--color-border-strong)] transition-colors duration-500` (see `src/components/shop/product-card.tsx` line 82).

## 10. Button — `src/components/ui/button.tsx`

Pill-only (`rounded-full`), polymorphic (`href` → Next `<Link>`):
```ts
// Active-state pulls the button 1% inward so the tap registers immediately —
// no waiting for navigation/network for visual feedback.
const base = "inline-flex items-center justify-center gap-2 font-sans text-sm tracking-wide transition-all duration-300 ease-out active:scale-[0.98] active:duration-75 disabled:opacity-40 disabled:pointer-events-none rounded-full";
const variants = {
  primary:   "bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] hover:bg-[var(--color-accent-hover)]",
  secondary: "bg-transparent text-[var(--color-text-primary)] border border-[var(--color-text-primary)] hover:bg-[var(--color-text-primary)] hover:text-[var(--color-text-inverse)]",
  ghost:     "bg-transparent text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]",
  link:      "bg-transparent text-[var(--color-text-primary)] underline-offset-4 hover:underline p-0",
};
const sizes = { sm: "px-5 py-2.5 text-xs", md: "px-7 py-3.5 text-sm", lg: "px-9 py-4.5 text-base" };
```
Note: primary uses `--color-text-primary` as the fill (warm black = de-facto brand color), hover shifts to `--color-accent-hover`.

## 11. Cross-cutting conventions

- Token consumption is always inline arbitrary: `rounded-[var(--radius-xl)]`, `bg-[var(--color-bg-dark)]`, `py-[var(--section-gap)]` — never resolved hex in components.
- Radius mapping in practice: product card `--radius-xl`, hero/banner/dialog/dark CTA `--radius-2xl`, fly-layer/small tile `--radius-lg`, everything interactive `rounded-full`.
- Hover idiom: opacity fades (`hover:opacity-80`, `group-hover/title:opacity-60`) and border-color shifts with `duration-300`/`duration-500`; image/gradient zoom uses Framer with `{ duration: 0.9, ease: EASING.smooth }`.
- Status pills: `inline-flex items-center text-[10px] tracking-[0.2em] uppercase rounded-full px-2.5 py-1` + semantic Tailwind palette (e.g. `bg-emerald-100 text-emerald-800`).
- Mobile-bottom/desktop-center dialog: `fixed inset-x-3 bottom-3 lg:inset-x-auto lg:left-1/2 lg:top-1/2 lg:bottom-auto lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-[520px] rounded-[var(--radius-2xl)]`.
- Animation primitives live in `src/components/animations/` (`reveal.tsx`, `stagger.tsx`, `word-reveal.tsx`, `marquee.tsx`); all import `EASING` from `@/lib/easing`.

**Key files:** `/Users/vladkruhlyk/Documents/GitHub/git-batch-coffee/web/src/app/globals.css`, `web/src/app/layout.tsx`, `web/src/lib/easing.ts`, `web/src/components/layout/container.tsx`, `web/src/components/layout/section-kicker.tsx`, `web/src/components/ui/button.tsx`, `web/src/components/animations/reveal.tsx`, `web/src/components/shop/product-card.tsx`, `web/src/components/home/hero.tsx`, `web/src/components/home/newsletter.tsx`, `web/src/components/home/featured-coffee.tsx`.
