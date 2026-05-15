"use client";

import { Container } from "@/components/layout/container";
import { SectionKicker } from "@/components/layout/section-kicker";
import { WordReveal } from "@/components/animations/word-reveal";
import { Reveal } from "@/components/animations/reveal";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { EASING } from "@/lib/easing";

const BENEFITS = [
  {
    number: "01",
    title: "Нова кава щомісяця",
    description:
      "Моносорти, рідкісні обробки, сезонні лоти — ти отримуєш їх першим.",
  },
  {
    number: "02",
    title: "Під твій метод",
    description:
      "Еспресо, V60, Аеропрес або Moka — обсмажимо саме під спосіб приготування.",
  },
  {
    number: "03",
    title: "Коли і скільки хочеш",
    description:
      "Раз на два тижні, на місяць, на два. 250 г, 500 г, кілограм. Пауза будь-коли.",
  },
  {
    number: "04",
    title: "Дешевше за разові",
    description: "Знижка 15% на кожну доставку. Безкоштовно від 3 500 ₴.",
  },
];

export function HomeSubscription() {
  return (
    <section className="relative py-[var(--section-gap)] bg-[var(--color-bg-primary)] overflow-hidden">
      <Container size="wide" className="relative z-10">
        {/* Top — kicker + headline */}
        <div className="grid lg:grid-cols-12 gap-8 mb-16 lg:mb-24">
          <div className="lg:col-span-8">
            <Reveal>
              <SectionKicker label="Підписка" />
            </Reveal>
            <h2 className="font-display font-semibold text-[clamp(1.875rem,4.2vw,4rem)] leading-[1] tracking-[-0.045em] mt-10 max-w-4xl">
              <WordReveal duration={1} stagger={0.07}>
                Нехай свіжа кава
              </WordReveal>
              <span className="block font-medium text-[var(--color-text-secondary)] mt-1">
                <WordReveal delay={0.3} duration={1} stagger={0.07}>
                  знаходить тебе сама.
                </WordReveal>
              </span>
            </h2>
          </div>
          <div className="lg:col-span-4 lg:col-start-9 lg:pt-8">
            <Reveal delay={0.3}>
              <p className="text-[var(--color-text-secondary)] leading-relaxed max-w-md">
                Ти обираєш сорти, метод і ритм. Все інше — наша справа.
                Обсмажуємо, пакуємо і відправляємо свіже.
              </p>
            </Reveal>
          </div>
        </div>

        {/* Main split — benefits list (L) + big featured card (R) */}
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-14 items-start">
          {/* LEFT — benefits as numbered editorial list */}
          <div className="lg:col-span-6 order-2 lg:order-1">
            <div className="flex flex-col divide-y divide-[var(--color-border-default)] border-t border-[var(--color-border-default)]">
              {BENEFITS.map((benefit, i) => (
                <Reveal key={benefit.number} delay={0.1 + i * 0.1}>
                  <div className="grid grid-cols-[auto_1fr] gap-6 lg:gap-10 py-7 lg:py-9">
                    <span className="font-display font-medium text-2xl lg:text-3xl text-[var(--color-text-muted)] tabular-nums tracking-tight">
                      {benefit.number}
                    </span>
                    <div>
                      <h3 className="font-display font-semibold text-xl lg:text-2xl tracking-[-0.03em] leading-tight mb-2">
                        {benefit.title}
                      </h3>
                      <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed max-w-sm">
                        {benefit.description}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={0.5}>
              {/* CTA disabled — full subscription flow is gated until
                  LiqPay recurring + cron job are wired. Re-enable by
                  swapping the button back to `<Button href="/subscription/setup">`. */}
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Button variant="primary" size="lg" disabled>
                  Оформити підписку →
                </Button>
                <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5 text-[11px] tracking-[0.2em] uppercase text-amber-900">
                  Скоро
                </span>
              </div>
            </Reveal>
          </div>

          {/* RIGHT — one featured card */}
          <div className="lg:col-span-6 lg:col-start-7 order-1 lg:order-2 lg:sticky lg:top-28">
            <Reveal y={60} duration={1.2}>
              <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-2xl)]">
                <motion.div
                  aria-hidden
                  className="absolute inset-0"
                  initial={{ scale: 1.15 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true, margin: "-15%" }}
                  transition={{ duration: 1.8, ease: EASING.expoOut }}
                  style={{
                    backgroundImage:
                      "radial-gradient(ellipse at 40% 55%, #C67A3E 0%, #4A2416 60%, #100805 100%)",
                  }}
                />
                <div
                  aria-hidden
                  className="absolute inset-0 opacity-[0.1] mix-blend-overlay"
                  style={{
                    backgroundImage:
                      "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
                  }}
                />
                {/* Top meta */}
                <div className="absolute top-6 left-6 right-6 flex items-start justify-between text-white/90">
                  <span className="text-[10px] tracking-[0.35em] uppercase text-white/60">
                    Batch Box · N°03
                  </span>
                  <span className="text-[10px] tracking-[0.3em] uppercase text-white/50 font-display">
                    Subscription
                  </span>
                </div>
                {/* Bottom overlay */}
                <div className="absolute bottom-6 left-6 right-6 text-white/90">
                  <span className="text-[10px] tracking-[0.35em] uppercase text-white/50 block mb-3">
                    Щомісячна коробка
                  </span>
                  <h3 className="font-display font-medium text-3xl lg:text-5xl leading-[0.95] tracking-[-0.04em] max-w-md">
                    Кава, що ніколи не застоюється на полиці.
                  </h3>
                </div>
              </div>
            </Reveal>

            {/* Tiny caption under card */}
            <Reveal delay={0.3}>
              <div className="mt-4 flex items-center gap-3 text-[10px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]">
                <span>Photo N°03</span>
                <span className="block w-6 h-px bg-[var(--color-border-strong)]" aria-hidden />
                <span>Від 390 ₴ / міс.</span>
              </div>
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}
