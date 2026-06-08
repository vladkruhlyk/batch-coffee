"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Container } from "@/components/layout/container";
import { SectionKicker } from "@/components/layout/section-kicker";
import { WordReveal } from "@/components/animations/word-reveal";
import { Reveal } from "@/components/animations/reveal";
import { EASING } from "@/lib/easing";
import { cn } from "@/lib/utils";

/**
 * Map a category's destination href → its line-art illustration in
 * /public/illustrations. Keyed by href because the Sanity category
 * docs identify themselves by route, not slug.
 */
const ILLUSTRATION_BY_HREF: Record<string, string> = {
  "/shop?category=beans": "/illustrations/beans.svg",
  "/shop?category=ground": "/illustrations/ground.svg",
  "/shop?category=drip": "/illustrations/drip.svg",
  "/shop?category=capsules": "/illustrations/capsules.svg",
  "/subscription": "/illustrations/subscription.svg",
  "/shop?category=gear": "/illustrations/accessories.svg",
  "/shop?category=grinders": "/illustrations/grinder.svg",
  "/shop?category=gifts": "/illustrations/giftset.svg",
};

function illustrationFor(href: string): string | null {
  return ILLUSTRATION_BY_HREF[href] ?? null;
}

/**
 * True if the tile's gradient starts on a dark colour — used to invert
 * the dark line-art illustration so it reads as light on dark tiles.
 * Parses the first #hex in the gradient and checks perceived luminance.
 */
function isDarkTile(gradient: string): boolean {
  const m = gradient.match(/#([0-9a-fA-F]{6})/);
  if (!m) return false;
  const hex = m[1];
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  // Rec.601 luma. < 110 reads as "dark enough to invert on".
  return 0.299 * r + 0.587 * g + 0.114 * b < 110;
}

/**
 * Home categories block — 8 laconic tiles on a 4×2 grid (2×4 on mobile).
 *
 * Minimalist: each tile shows only the category name + a hover arrow. No
 * sub-labels, no counts in-tile — keeps the block fast to scan and lets
 * the colored gradients do the visual work.
 */

interface Category {
  slug: string;
  /** Category title (Ukrainian) */
  title: string;
  /** Destination route */
  href: string;
  /** CSS `background-image` value — either a radial-gradient or a
   *  `url(...)` to an uploaded image. */
  gradient: string;
}

interface HomeCategoriesProps {
  categories: Category[];
}

export function HomeCategories({ categories }: HomeCategoriesProps) {
  if (categories.length === 0) return null;
  return (
    <section className="relative py-[var(--section-gap)] bg-[var(--color-bg-secondary)] overflow-hidden">
      <Container size="wide" className="relative z-10">
        {/* Header */}
        <div className="grid lg:grid-cols-12 gap-8 mb-14 lg:mb-20">
          <div className="lg:col-span-7">
            <Reveal>
              <SectionKicker number="01" label="Категорії" />
            </Reveal>
            <h2 className="font-display font-semibold text-[clamp(1.875rem,4.2vw,4rem)] leading-[1] tracking-[-0.045em] mt-10 max-w-3xl">
              <WordReveal duration={1} stagger={0.07}>
                Усе, що треба
              </WordReveal>
              <span className="block font-medium text-[var(--color-text-secondary)] mt-1">
                <WordReveal delay={0.25} duration={1} stagger={0.07}>
                  для твого ранку.
                </WordReveal>
              </span>
            </h2>
          </div>
          <div className="lg:col-span-4 lg:col-start-9 lg:pt-8">
            <Reveal delay={0.3}>
              <p className="text-[var(--color-text-secondary)] leading-relaxed max-w-md">
                Від свіжообсмажених зерен до млинків і подарункових сетів —
                обирай, з чого почнеш.
              </p>
              <Link
                href="/shop"
                className="inline-flex items-center gap-2 mt-6 text-[11px] tracking-[0.3em] uppercase border-b border-[var(--color-text-primary)] pb-1 hover:opacity-60 transition-opacity duration-300"
              >
                Весь каталог →
              </Link>
            </Reveal>
          </div>
        </div>

        {/* Grid — 2 cols mobile, 4 cols desktop. 8 categories → 2×4 on desktop. */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5">
          {categories.map((category, i) => (
            <CategoryTile key={category.slug} category={category} index={i} />
          ))}
        </div>
      </Container>
    </section>
  );
}

interface TileProps {
  category: Category;
  index: number;
}

function CategoryTile({ category, index }: TileProps) {
  // Stagger reveal left-to-right, then row-by-row.
  const delay = (index % 4) * 0.08;

  return (
    <Reveal delay={delay} y={30} duration={0.9}>
      <Link
        href={category.href}
        className="group relative block aspect-square overflow-hidden rounded-[var(--radius-xl)]"
      >
        {/* Background — gradient + grain + subtle bottom darkening */}
        <motion.div
          aria-hidden
          className="absolute inset-0"
          initial={{ scale: 1 }}
          whileHover={{ scale: 1.06 }}
          transition={{ duration: 1.2, ease: EASING.smooth }}
        >
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ backgroundImage: category.gradient }}
          />
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.1] mix-blend-overlay"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            }}
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent"
          />
        </motion.div>

        {/* Line-art illustration — centred in the upper half so it
            doesn't clash with the title pinned to the bottom. The art
            is dark stroke; on dark tiles (e.g. Підписка) we invert it
            to read light. Subtle float on hover. */}
        {illustrationFor(category.href) && (
          <motion.img
            src={illustrationFor(category.href)!}
            alt=""
            aria-hidden
            initial={{ y: 0 }}
            whileHover={{ y: -6 }}
            transition={{ duration: 0.9, ease: EASING.smooth }}
            className={cn(
              "pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[46%] max-w-[120px] opacity-90 transition-opacity duration-500 group-hover:opacity-100",
              isDarkTile(category.gradient) && "[filter:invert(1)_brightness(1.4)]",
            )}
          />
        )}

        {/* Title + arrow, pinned bottom */}
        <div className="absolute bottom-4 left-4 right-4 lg:bottom-5 lg:left-5 lg:right-5 flex items-end justify-between gap-3 text-white">
          <h3 className="font-display font-semibold text-lg sm:text-xl lg:text-2xl leading-[1] tracking-[-0.025em]">
            {category.title}
          </h3>
          <span className="inline-block text-lg lg:text-xl shrink-0 opacity-60 transition-all duration-500 ease-out group-hover:opacity-100 group-hover:translate-x-1">
            →
          </span>
        </div>
      </Link>
    </Reveal>
  );
}
