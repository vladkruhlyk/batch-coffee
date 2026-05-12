"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { SectionKicker } from "@/components/layout/section-kicker";
import { WordReveal } from "@/components/animations/word-reveal";
import { Reveal } from "@/components/animations/reveal";
import { Button } from "@/components/ui/button";
import { EASING } from "@/lib/easing";

const STATS = [
  { value: "12", label: "Ферм-партнерів" },
  { value: "250г", label: "Середня партія" },
  { value: "< 14", label: "Днів до чашки" },
  { value: "2022", label: "Заснована" },
];

const PRINCIPLES = [
  "Прямі контракти з фермами",
  "Повітряна обсмажка без диму",
  "Партія до 30 кг",
  "Відправка в день обсмажки",
];

export function HomeAbout() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const imgY = useTransform(scrollYProgress, [0, 1], [-60, 60]);

  return (
    <section
      ref={ref}
      className="relative bg-[var(--color-bg-dark)] text-[var(--color-text-inverse)] overflow-hidden"
    >
      <div className="relative z-10 grid lg:grid-cols-2 min-h-[100svh]">
        {/* LEFT COLUMN — everything textual */}
        <div className="flex flex-col justify-between p-6 lg:p-16 pt-28 lg:pt-32 pb-14 lg:pb-16 border-b lg:border-b-0 lg:border-r border-white/10">
          {/* Top — kicker */}
          <Reveal>
            <SectionKicker label="Про BATCH" inverse />
          </Reveal>

          {/* Middle — headline + story */}
          <div className="mt-14 lg:mt-0">
            <h2 className="font-display font-medium text-[clamp(2rem,4.4vw,4.25rem)] leading-[1] tracking-[-0.045em]">
              <WordReveal duration={1.1} stagger={0.08}>
                Маленька ростерія
              </WordReveal>
              <span className="block text-white/60 mt-1">
                <WordReveal delay={0.35} duration={1.1} stagger={0.08}>
                  з великою уважністю.
                </WordReveal>
              </span>
            </h2>

            <div className="mt-10 lg:mt-14 grid md:grid-cols-2 gap-x-10 gap-y-5 max-w-xl">
              <Reveal delay={0.2}>
                <p className="text-[15px] text-white/65 leading-relaxed">
                  Ми почали BATCH у 2022 з простої ідеї: не має бути кави, яку
                  соромно подати близьким. Все, що ми відправляємо — обсмажене
                  за останні два тижні.
                </p>
              </Reveal>
              <Reveal delay={0.35}>
                <p className="text-[15px] text-white/65 leading-relaxed">
                  Знаємо кожну ферму особисто, на&nbsp;ім&rsquo;я. Обсмажуємо
                  невеликими партіями. І чесно розповідаємо, звідки кожна чашка.
                </p>
              </Reveal>
            </div>

            {/* Principles — inline chips */}
            <div className="mt-10 flex flex-wrap gap-2 lg:gap-3 max-w-xl">
              {PRINCIPLES.map((item, i) => (
                <Reveal key={item} delay={0.4 + i * 0.06}>
                  <span className="inline-flex items-center gap-2 text-[11px] tracking-[0.15em] uppercase text-white/60 border border-white/15 px-3 py-2 rounded-full">
                    <span
                      aria-hidden
                      className="block w-1 h-1 rounded-full bg-white/60"
                    />
                    {item}
                  </span>
                </Reveal>
              ))}
            </div>

            {/* Stats strip */}
            <div className="mt-12 lg:mt-14 grid grid-cols-4 gap-4 lg:gap-6 pt-8 border-t border-white/15 max-w-xl">
              {STATS.map((stat, i) => (
                <Reveal key={stat.label} delay={0.5 + i * 0.08}>
                  <div>
                    <div className="font-display font-medium text-2xl lg:text-[40px] leading-none tracking-[-0.03em]">
                      {stat.value}
                    </div>
                    <div className="text-[10px] tracking-[0.2em] uppercase text-white/45 mt-3 leading-tight">
                      {stat.label}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          {/* Bottom — CTA + meta */}
          <div className="mt-12 lg:mt-0 flex items-end justify-between gap-6 pt-10 border-t border-white/10">
            <Reveal delay={0.7}>
              <Button
                href="/about"
                variant="secondary"
                size="lg"
                className="border-white/40 text-white hover:bg-white hover:text-[var(--color-text-primary)]"
              >
                Наша історія →
              </Button>
            </Reveal>
            <Reveal delay={0.8}>
              <div className="text-right">
                <div className="text-[10px] tracking-[0.25em] uppercase text-white/30">
                  Est. 2022 · Poltava
                </div>
              </div>
            </Reveal>
          </div>
        </div>

        {/* RIGHT COLUMN — image only, full bleed */}
        <div className="relative overflow-hidden min-h-[60svh] lg:min-h-full">
          <motion.div
            style={{ y: imgY }}
            className="absolute inset-0 -top-16 -bottom-16 will-change-transform"
          >
            <motion.div
              aria-hidden
              className="absolute inset-0"
              initial={{ scale: 1.14 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true, margin: "-15%" }}
              transition={{ duration: 1.8, ease: EASING.expoOut }}
              style={{
                backgroundImage:
                  "radial-gradient(ellipse at 45% 55%, #A06838 0%, #3D2417 60%, #0F0A06 100%)",
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
          </motion.div>

          {/* Quote overlay on the image */}
          <div className="absolute bottom-6 lg:bottom-10 left-6 lg:left-10 right-6 lg:right-10 flex items-end justify-between gap-4 text-white/80 z-10">
            <span className="font-display font-medium text-2xl lg:text-4xl leading-[0.95] tracking-[-0.04em] max-w-sm">
              «Не має бути кави, яку соромно подати близьким.»
            </span>
            <span className="text-[10px] tracking-[0.3em] uppercase text-white/40 whitespace-nowrap hidden md:block">
              — Засновники
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
