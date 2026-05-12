"use client";

import Link from "next/link";
import { Container } from "@/components/layout/container";
import { SectionKicker } from "@/components/layout/section-kicker";
import { WordReveal } from "@/components/animations/word-reveal";
import { Reveal } from "@/components/animations/reveal";
import { ProductCard } from "@/components/shop/product-card";
import type { Product } from "@/data/products";

/**
 * Bestsellers block — second section on the homepage.
 *
 * Receives products as a prop from the server-rendered HomePage, which
 * pulls them from Sanity and filters by `badge === "Bestseller"`. If the
 * editor flags zero items, we don't render the section at all — beats
 * an empty grid.
 */

interface HomeBestsellersProps {
  products: Product[];
}

export function HomeBestsellers({ products }: HomeBestsellersProps) {
  if (products.length === 0) return null;

  return (
    <section className="relative py-[var(--section-gap)] bg-[var(--color-bg-primary)] overflow-hidden">
      <Container size="wide">
        {/* Header */}
        <div className="grid lg:grid-cols-12 gap-8 mb-14 lg:mb-20">
          <div className="lg:col-span-7">
            <Reveal>
              <SectionKicker number="02" label="Бестселери" />
            </Reveal>
            <h2 className="font-display font-semibold text-[clamp(1.875rem,4.2vw,4rem)] leading-[1] tracking-[-0.045em] mt-10 max-w-3xl">
              <WordReveal duration={1} stagger={0.07}>
                Те, що замовляють
              </WordReveal>
              <span className="block font-medium text-[var(--color-text-secondary)] mt-1">
                <WordReveal delay={0.25} duration={1} stagger={0.07}>
                  найчастіше.
                </WordReveal>
              </span>
            </h2>
          </div>
          <div className="lg:col-span-4 lg:col-start-9 lg:pt-8">
            <Reveal delay={0.3}>
              <p className="text-[var(--color-text-secondary)] leading-relaxed max-w-md">
                Шість позицій, до яких люди вертаються. Свіжообсмажені, відправка
                в день замовлення або наступний.
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

        {/* Product grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-8">
          {products.map((product, i) => (
            <Reveal key={product.slug} delay={(i % 3) * 0.1} y={40}>
              <ProductCard product={product} />
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
