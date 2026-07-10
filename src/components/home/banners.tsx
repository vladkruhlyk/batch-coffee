"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Container } from "@/components/layout/container";
import { EASING } from "@/lib/easing";
import { cn } from "@/lib/utils";

/**
 * First-screen carousel — stacked layout.
 *
 * Each slide is a vertical card:
 *
 *   ┌──────────────────────────┐
 *   │                          │
 *   │       PHOTO / ART        │ ← top, ~16:9 area, image fills via object-cover
 *   │                          │
 *   ├──────────────────────────┤
 *   │  Kicker                  │
 *   │  Title                   │ ← cream/white text block, normal flow
 *   │  Copy        [CTA]       │
 *   └──────────────────────────┘
 *
 * Image area accepts a real photo (`image` field) — set the asset path and
 * it renders via next/image. When `image` is undefined we fall back to the
 * existing radial-gradient + splash-mark composition so the layout never
 * collapses while photography is still being shot.
 *
 * Keep aspect ratios responsive: portrait phones get a more square-ish
 * image (4:3) so the photo doesn't dominate the screen, while desktops
 * get the wider 21:9 cinematic frame.
 */

interface Banner {
  slug: string;
  kicker: string;
  titleLine1: string;
  titleLine2: string;
  copy: string;
  ctaLabel: string;
  ctaHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  badge?: string;
  /** URL to an uploaded image (Sanity) — when present, replaces the
   *  gradient + splash placeholder. */
  image?: string;
  /** Tint used by both the gradient fallback AND the photo overlay. */
  markTint: string;
  /** Background color behind the image area for the gradient fallback. */
  fallbackBg: string;
}

const AUTOPLAY_MS = 7000;

interface HomeBannersProps {
  /** Banners come from Sanity now — empty array renders nothing. The
   *  homepage server component pre-fetches and hands them down. */
  banners: Banner[];
}

export function HomeBanners({ banners }: HomeBannersProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const go = useCallback(
    (n: number) => {
      if (banners.length === 0) return;
      setIndex(((n % banners.length) + banners.length) % banners.length);
    },
    [banners.length],
  );

  useEffect(() => {
    if (paused || banners.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % banners.length);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [paused, banners.length]);

  // Empty state — editor hasn't published any banners yet. Don't render
  // the whole section so the page doesn't have an awkward empty hero.
  if (banners.length === 0) return null;

  const active = banners[Math.min(index, banners.length - 1)];

  return (
    <section
      className="relative bg-[var(--color-bg-primary)] pt-24 sm:pt-28 lg:pt-32 pb-8 sm:pb-12 lg:pb-16"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <Container size="wide">
        <div className="overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)]">
          {/* TOP — image. Crossfades between slides.
              Height is capped against the viewport (svh) so the whole card
              — image + text + controls — still fits inside the first screen.
              Mobile gets a shorter image (controls now live ON the image, so
              there's no external controls row eating height) → the entire
              hero card is visible without scrolling on a phone. Desktop keeps
              the taller cinematic frame. */}
          <div
            className="relative w-full h-[34svh] min-h-[220px] sm:h-[clamp(280px,50svh,560px)]"
            style={{ backgroundColor: active.fallbackBg }}
          >
            <AnimatePresence mode="sync">
              <motion.div
                key={active.slug + "-image"}
                initial={{ opacity: 0, scale: 1.04 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 1.1, ease: EASING.smooth }}
                className="absolute inset-0"
              >
                {active.image ? (
                  <Image
                    src={active.image}
                    alt={active.titleLine1}
                    fill
                    priority={index === 0}
                    className="object-cover"
                    sizes="(min-width: 1280px) 1200px, 100vw"
                  />
                ) : (
                  <PlaceholderArt tint={active.markTint} />
                )}
                {/* Brand splash mark — pinned top-right, ALWAYS present so the
                    petal editors got used to survives once real photos land.
                    Tinted over the gradient placeholder; a subtle white
                    watermark over a photo so it never fights the image. */}
                <SplashMark tint={active.markTint} overPhoto={!!active.image} />
              </motion.div>
            </AnimatePresence>

            {/* Top-left badge — sits over the image */}
            <div className="absolute top-5 left-5 lg:top-7 lg:left-7 z-10">
              <AnimatePresence mode="wait">
                {active.badge && (
                  <motion.span
                    key={active.slug + "-badge"}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.5, ease: EASING.smooth }}
                    className="inline-flex items-center text-[10px] tracking-[0.3em] uppercase rounded-full px-4 py-2 bg-white/85 backdrop-blur-md text-[var(--color-text-primary)] border border-white/60"
                  >
                    {active.badge}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            {/* Counter — over image, top-right */}
            <span className="absolute top-5 right-5 lg:top-7 lg:right-7 z-10 inline-flex items-center font-display text-xs tabular-nums text-white/85 mix-blend-difference">
              {String(index + 1).padStart(2, "0")}
              <span className="mx-1 opacity-50">/</span>
              <span className="opacity-50">
                {String(banners.length).padStart(2, "0")}
              </span>
            </span>

            {banners.length > 1 && (
              <>
                {/* Soft bottom scrim so white controls stay legible over any
                    photo, light or dark. */}
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/35 to-transparent"
                  aria-hidden
                />
                {/* Controls ON the image: progress dots bottom-left,
                    prev/next arrows bottom-right. */}
                <div className="absolute inset-x-5 bottom-4 lg:inset-x-7 lg:bottom-6 z-10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {banners.map((b, i) => (
                      <button
                        key={b.slug}
                        onClick={() => go(i)}
                        aria-label={`Слайд ${i + 1}`}
                        className="group h-6 flex items-center"
                      >
                        <span
                          className={cn(
                            "block h-px bg-white transition-all duration-500 drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]",
                            i === index
                              ? "w-9 opacity-100"
                              : "w-4 opacity-50 group-hover:opacity-80 group-hover:w-6",
                          )}
                          aria-hidden
                        />
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => go(index - 1)}
                      aria-label="Попередній слайд"
                      className="h-9 w-9 lg:h-10 lg:w-10 rounded-full bg-white/85 backdrop-blur-md border border-white/60 flex items-center justify-center text-[var(--color-text-primary)] hover:bg-white transition-colors duration-300"
                    >
                      <ArrowLeft className="h-4 w-4" strokeWidth={1.6} />
                    </button>
                    <button
                      onClick={() => go(index + 1)}
                      aria-label="Наступний слайд"
                      className="h-9 w-9 lg:h-10 lg:w-10 rounded-full bg-white/85 backdrop-blur-md border border-white/60 flex items-center justify-center text-[var(--color-text-primary)] hover:bg-white transition-colors duration-300"
                    >
                      <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* BOTTOM — text block. Cream surface. */}
          <div className="relative bg-[var(--color-bg-primary)]">
            <Container size="wide" className="!px-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={active.slug + "-content"}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.7, ease: EASING.smooth }}
                  className="grid lg:grid-cols-12 gap-5 sm:gap-7 lg:gap-12 px-5 py-6 sm:px-6 sm:py-9 lg:px-12 lg:py-12"
                >
                  {/* LEFT — kicker + headline */}
                  <div className="lg:col-span-7">
                    <div className="flex items-center gap-4 mb-4">
                      <span
                        className="block w-10 h-px bg-[var(--color-text-primary)]/25"
                        aria-hidden
                      />
                      <span className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-secondary)]">
                        {active.kicker}
                      </span>
                    </div>
                    <h1 className="font-display font-semibold text-[clamp(1.85rem,4.2vw,3.5rem)] leading-[1.03] tracking-[-0.04em] text-[var(--color-text-primary)]">
                      {active.titleLine1}
                      <span className="block font-medium text-[var(--color-text-secondary)]">
                        {active.titleLine2}
                      </span>
                    </h1>
                  </div>

                  {/* RIGHT — copy + single CTA. Laconic: one button only.
                      Copy renders only when filled, so the banner can be a
                      clean kicker + title + button when left empty in Sanity. */}
                  <div className="lg:col-span-5 lg:pt-3 flex flex-col gap-5 sm:gap-6">
                    {active.copy && (
                      <p className="text-[var(--color-text-secondary)] text-[15px] sm:text-base leading-relaxed max-w-sm">
                        {active.copy}
                      </p>
                    )}
                    <div>
                      <Link
                        href={active.ctaHref}
                        className="group inline-flex items-center gap-3 text-sm tracking-[0.12em] uppercase px-7 py-4 rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] transition-opacity duration-300 hover:opacity-85"
                      >
                        {active.ctaLabel}
                        <span className="inline-block transition-transform duration-500 ease-out group-hover:translate-x-1">
                          →
                        </span>
                      </Link>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </Container>
          </div>
        </div>
      </Container>
    </section>
  );
}

/**
 * Fallback art used while real banner photography hasn't been shot yet.
 * Radial highlight + grain. The petal itself now lives in `SplashMark`,
 * rendered by the parent for BOTH the placeholder and real photos, so the
 * brand mark stays in the corner even after an editor uploads an image.
 */
function PlaceholderArt({ tint }: { tint: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Radial highlight */}
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage: `radial-gradient(ellipse at 75% 35%, ${hexToRgba(tint, 0.22)} 0%, transparent 60%)`,
        }}
      />
      {/* Grain */}
      <div
        className="absolute inset-0 opacity-[0.07] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}

/**
 * Brand splash mark — the masked "petal" shape (/5.png) pinned to the
 * top-right of the image area. It animates in (rotate + scale) on each slide
 * change because the parent's keyed motion.div re-mounts it.
 *
 * Two looks:
 *  - over the gradient placeholder → the slide's tint at full presence, as
 *    it always was;
 *  - over a real photo → a soft white watermark (overlay blend) so the petal
 *    stays visible on any photography without ever competing with it.
 */
function SplashMark({ tint, overPhoto }: { tint: string; overPhoto: boolean }) {
  return (
    <motion.div
      aria-hidden
      initial={{ rotate: -22, scale: 0.92, opacity: 0 }}
      animate={{ rotate: 0, scale: 1, opacity: overPhoto ? 0.45 : 0.32 }}
      transition={{
        rotate: { duration: 1.6, ease: EASING.smooth },
        scale: { duration: 1.6, ease: EASING.smooth },
        opacity: { duration: 1.1, ease: EASING.smooth },
      }}
      className={cn(
        "pointer-events-none absolute -top-[10%] -right-[8%] w-[55%] max-w-[480px] aspect-square",
        overPhoto && "mix-blend-overlay",
      )}
      style={{
        backgroundColor: overPhoto ? "#ffffff" : tint,
        WebkitMaskImage: "url(/5.png)",
        maskImage: "url(/5.png)",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        // Pin the rotation around the visual center of the petals so the
        // motion reads like it's spinning in place, not arcing off-screen.
        transformOrigin: "55% 55%",
      }}
    />
  );
}

/** "#8A4A26" → "rgba(138,74,38,0.22)". Tiny helper, no validation. */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
