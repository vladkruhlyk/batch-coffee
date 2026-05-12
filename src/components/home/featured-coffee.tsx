"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Container } from "@/components/layout/container";
import { SectionKicker } from "@/components/layout/section-kicker";
import { WordReveal } from "@/components/animations/word-reveal";
import { Reveal } from "@/components/animations/reveal";
import { formatPrice } from "@/lib/utils";

const FEATURED = [
  {
    slug: "ethiopia-sidamo",
    name: "Ефіопія Сідамо",
    origin: "Сідамо, Ефіопія",
    process: "Натуральна",
    notes: ["Полуниця", "Чорний чай", "Мед"],
    price: 420,
    weight: "250 г",
    roast: "Фільтр",
    gradient:
      "radial-gradient(ellipse at 30% 30%, #C9573E 0%, #6A1E14 55%, #2A0A08 100%)",
  },
  {
    slug: "colombia-huila",
    name: "Колумбія Уїла",
    origin: "Уїла, Колумбія",
    process: "Мита",
    notes: ["Молочний шоколад", "Карамель", "Яблуко"],
    price: 390,
    weight: "250 г",
    roast: "Еспресо",
    gradient:
      "radial-gradient(ellipse at 60% 50%, #A06536 0%, #2F1A0E 70%, #120806 100%)",
  },
  {
    slug: "kenya-nyeri",
    name: "Кенія Ньєрі",
    origin: "Ньєрі, Кенія",
    process: "Мита",
    notes: ["Чорна смородина", "Грейпфрут", "Томат"],
    price: 460,
    weight: "250 г",
    roast: "Фільтр",
    gradient:
      "radial-gradient(ellipse at 50% 55%, #8B2E22 0%, #1A0806 75%)",
  },
  {
    slug: "brazil-cerrado",
    name: "Бразилія Серрадо",
    origin: "Серрадо, Бразилія",
    process: "Натуральна",
    notes: ["Горіх", "Какао", "Апельсин"],
    price: 360,
    weight: "250 г",
    roast: "Еспресо",
    gradient:
      "radial-gradient(ellipse at 40% 50%, #8B562E 0%, #241812 70%, #0A0605 100%)",
  },
  {
    slug: "guatemala-antigua",
    name: "Гватемала Антигуа",
    origin: "Антигуа, Гватемала",
    process: "Мита",
    notes: ["Темний шоколад", "Какао боб", "Спеції"],
    price: 410,
    weight: "250 г",
    roast: "Еспресо",
    gradient:
      "radial-gradient(ellipse at 45% 45%, #6B3E2A 0%, #1A0E08 75%)",
  },
];

export function HomeFeaturedCoffee() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  // Horizontal scroll distance. 4 additional cards to reveal → translate -80% to fully show last.
  const x = useTransform(scrollYProgress, [0, 1], ["0%", "-72%"]);

  return (
    <section
      ref={ref}
      className="relative bg-[var(--color-bg-primary)]"
      style={{ height: "340vh" }}
    >
      {/* Huge background section number */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none flex items-start justify-end pt-[10vh] pr-6 lg:pr-16 overflow-hidden"
      >
        <span className="font-display font-light text-[clamp(20rem,45vw,50rem)] leading-none tracking-[-0.05em] text-[var(--color-bg-secondary)] select-none">
          02
        </span>
      </div>

      {/* Sticky viewport */}
      <div className="sticky top-0 h-screen flex flex-col justify-center overflow-hidden">
        {/* Header */}
        <Container size="wide" className="relative z-10 mb-10 lg:mb-16">
          <div className="grid lg:grid-cols-12 gap-8 items-end">
            <div className="lg:col-span-7">
              <Reveal>
                <SectionKicker number="02" label="Обсмажка тижня" />
              </Reveal>
              <h2 className="font-display font-semibold text-[clamp(1.875rem,4.2vw,3.75rem)] leading-[1] tracking-[-0.04em] mt-8 lg:mt-10 max-w-3xl">
                <WordReveal duration={1} stagger={0.07}>
                  Свіжа партія.
                </WordReveal>
                <span className="block text-[var(--color-text-secondary)] font-medium mt-1">
                  <WordReveal delay={0.25} duration={1} stagger={0.07}>
                    Щойно з обсмажування.
                  </WordReveal>
                </span>
              </h2>
            </div>
            <div className="lg:col-span-4 lg:col-start-9">
              <Reveal delay={0.3}>
                <p className="text-[var(--color-text-secondary)] leading-relaxed max-w-sm">
                  Кожного тижня обсмажуємо новий лот. Нічого не чекає на полиці —
                  відправляємо в той же день або наступний.
                </p>
                <div className="mt-6 flex items-center gap-3 text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]">
                  <span>Гортай вбік →</span>
                </div>
              </Reveal>
            </div>
          </div>
        </Container>

        {/* Horizontal track */}
        <div className="relative overflow-hidden">
          <motion.div
            style={{ x }}
            className="flex gap-6 lg:gap-10 pl-6 md:pl-10 lg:pl-16 pr-[40vw] will-change-transform"
          >
            {FEATURED.map((coffee) => (
              <ProductCard key={coffee.slug} coffee={coffee} />
            ))}

            {/* Final "see all" card */}
            <Link
              href="/shop"
              className="group flex-shrink-0 w-[70vw] sm:w-[360px] lg:w-[420px] aspect-[3/4] border border-[var(--color-border-default)] rounded-[var(--radius-xl)] flex flex-col items-center justify-center gap-6 hover:bg-[var(--color-bg-secondary)] transition-colors duration-500"
            >
              <span className="text-[10px] tracking-[0.35em] uppercase text-[var(--color-text-muted)]">
                Весь каталог
              </span>
              <span className="font-display text-4xl lg:text-5xl font-semibold tracking-tight text-center px-8">
                Дивитися все
              </span>
              <span className="inline-block text-2xl transition-transform duration-500 ease-out group-hover:translate-x-2">
                →
              </span>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

interface CardProps {
  coffee: (typeof FEATURED)[number];
}

function ProductCard({ coffee }: CardProps) {
  return (
    <Link
      href={`/shop/${coffee.slug}`}
      className="group flex-shrink-0 w-[70vw] sm:w-[360px] lg:w-[420px]"
    >
      {/* Image */}
      <div className="relative aspect-[3/4] overflow-hidden bg-[var(--color-bg-secondary)] mb-6 rounded-[var(--radius-xl)]">
        <motion.div
          whileHover={{ scale: 1.04 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0"
        >
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ backgroundImage: coffee.gradient }}
          />
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.12] mix-blend-overlay"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            }}
          />
        </motion.div>

        {/* Top meta row */}
        <div className="absolute top-5 left-5 right-5 flex items-start justify-between text-white/90">
          <span className="text-[10px] tracking-[0.3em] uppercase border border-white/30 px-3 py-1.5 backdrop-blur-sm rounded-full">
            {coffee.roast}
          </span>
          <span className="text-[10px] tracking-[0.3em] uppercase text-white/60">
            {coffee.process}
          </span>
        </div>

        {/* Bottom caption on image */}
        <div className="absolute bottom-5 left-5 right-5 text-white/90">
          <span className="text-[10px] tracking-[0.35em] uppercase text-white/50 block mb-1">
            {coffee.origin}
          </span>
        </div>
      </div>

      {/* Info row */}
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <h3 className="font-display text-2xl lg:text-3xl font-semibold tracking-tight group-hover:opacity-60 transition-opacity duration-300">
          {coffee.name}
        </h3>
        <span className="text-sm text-[var(--color-text-secondary)] tabular-nums whitespace-nowrap">
          {formatPrice(coffee.price)}
        </span>
      </div>

      {/* Tasting notes */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tracking-wide text-[var(--color-text-secondary)]">
        {coffee.notes.map((note, i) => (
          <span key={note} className="flex items-center gap-2">
            {i > 0 && (
              <span className="text-[var(--color-text-muted)]">·</span>
            )}
            {note}
          </span>
        ))}
        <span className="text-[var(--color-text-muted)] ml-auto">
          {coffee.weight}
        </span>
      </div>
    </Link>
  );
}
