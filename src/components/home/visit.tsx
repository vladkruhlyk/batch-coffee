"use client";

import { motion } from "framer-motion";
import { Container } from "@/components/layout/container";
import { SectionKicker } from "@/components/layout/section-kicker";
import { WordReveal } from "@/components/animations/word-reveal";
import { Reveal } from "@/components/animations/reveal";
import { Button } from "@/components/ui/button";
import { EASING } from "@/lib/easing";

const HOURS = [
  { days: "Пн — Пт", time: "08:00 — 20:00" },
  { days: "Сб — Нд", time: "09:00 — 21:00" },
];

const POI = [
  { label: "Від ЦУМу", value: "3 хв пішки" },
  { label: "Паркінг", value: "Безкоштовно" },
  { label: "Wi-Fi", value: "Так, швидкий" },
  { label: "Власний посуд", value: "Знижка 10%" },
];

export function HomeVisit() {
  return (
    <section className="relative py-[var(--section-gap)] bg-[var(--color-bg-primary)] overflow-hidden">
      <Container size="wide" className="relative z-10">
        {/* Header */}
        <div className="grid lg:grid-cols-12 gap-8 mb-16 lg:mb-20">
          <div className="lg:col-span-8">
            <Reveal>
              <SectionKicker label="Кав'ярня" />
            </Reveal>
            <h2 className="font-display font-semibold text-[clamp(2rem,4.5vw,4.5rem)] leading-[1] tracking-[-0.045em] mt-10">
              <WordReveal duration={1} stagger={0.07}>
                Полтава. Наша
              </WordReveal>
              <span className="block font-medium text-[var(--color-text-secondary)] mt-1">
                <WordReveal delay={0.3} duration={1} stagger={0.07}>
                  кав&rsquo;ярня чекає.
                </WordReveal>
              </span>
            </h2>
          </div>
        </div>

        {/* Main grid — visual | info */}
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Big image card */}
          <div className="lg:col-span-7">
            <Reveal y={80} duration={1.2}>
              <div className="relative aspect-[4/3] lg:aspect-[16/11] overflow-hidden rounded-[var(--radius-2xl)]">
                <motion.div
                  aria-hidden
                  className="absolute inset-0"
                  initial={{ scale: 1.14 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true, margin: "-15%" }}
                  transition={{ duration: 1.8, ease: EASING.expoOut }}
                  style={{
                    backgroundImage:
                      "radial-gradient(ellipse at 55% 50%, #D4A574 0%, #8B5A3C 45%, #3D2417 85%, #120806 100%)",
                  }}
                />
                <div
                  aria-hidden
                  className="absolute inset-0 opacity-[0.1] mix-blend-overlay"
                  style={{
                    backgroundImage:
                      "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
                  }}
                />
                {/* Bottom meta */}
                <div className="absolute top-6 left-6 right-6 flex items-start justify-between text-white/90">
                  <span className="text-[10px] tracking-[0.35em] uppercase">
                    Наша кав&rsquo;ярня
                  </span>
                  <span className="text-[10px] tracking-[0.3em] uppercase text-white/60 font-display">
                    49.58° N / 34.55° E
                  </span>
                </div>
                <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between text-white/90">
                  <span className="font-display font-medium text-3xl lg:text-5xl leading-[0.95] tracking-tight max-w-md">
                    вул. Соборності, 12
                  </span>
                  <span className="text-[10px] tracking-[0.35em] uppercase text-white/50 hidden md:block">
                    Photo N°02
                  </span>
                </div>
              </div>
            </Reveal>

            {/* POI row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6 mt-8 lg:mt-10 pt-6 border-t border-[var(--color-border-default)]">
              {POI.map((item, i) => (
                <Reveal key={item.label} delay={0.1 + i * 0.07}>
                  <div>
                    <span className="text-[10px] tracking-[0.25em] uppercase text-[var(--color-text-muted)] block mb-1.5">
                      {item.label}
                    </span>
                    <span className="font-display text-base tracking-tight">
                      {item.value}
                    </span>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          {/* Right — hours + CTA */}
          <div className="lg:col-span-4 lg:col-start-9 flex flex-col">
            <Reveal delay={0.2}>
              <p className="text-lg text-[var(--color-text-secondary)] leading-relaxed">
                У кав&rsquo;ярні можна спробувати всі лоти, дізнатися про
                методи заварювання і просто провести ранок у тиші.
              </p>
            </Reveal>

            <div className="mt-10 lg:mt-14">
              <Reveal delay={0.3}>
                <h3 className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] mb-5">
                  Години роботи
                </h3>
              </Reveal>
              <div className="flex flex-col divide-y divide-[var(--color-border-default)] border-y border-[var(--color-border-default)]">
                {HOURS.map((row, i) => (
                  <Reveal key={row.days} delay={0.4 + i * 0.08}>
                    <div className="flex items-baseline justify-between gap-4 py-4 text-base">
                      <span className="font-display text-lg">{row.days}</span>
                      <span className="text-[var(--color-text-secondary)] tabular-nums">
                        {row.time}
                      </span>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>

            <Reveal delay={0.6}>
              <div className="flex flex-wrap gap-4 mt-10">
                <Button href="/visit" variant="primary" size="lg">
                  Як нас знайти →
                </Button>
              </div>
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}
