"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Container } from "@/components/layout/container";
import { WordReveal } from "@/components/animations/word-reveal";
import { EASING } from "@/lib/easing";

export function HomeHero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const bgY = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const bgScale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);
  const textY = useTransform(scrollYProgress, [0, 1], [0, -40]);

  return (
    <section
      ref={ref}
      className="relative h-[100svh] min-h-[640px] flex items-end overflow-hidden bg-[var(--color-bg-dark)] text-[var(--color-text-inverse)]"
    >
      {/* Background layer */}
      <motion.div
        style={{ y: bgY, scale: bgScale }}
        className="absolute inset-0 -top-24 -bottom-24 will-change-transform"
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at 25% 60%, #3F2818 0%, #1A1210 55%, #0A0705 100%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at 80% 20%, rgba(200, 140, 80, 0.25) 0%, transparent 45%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.08] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
      </motion.div>

      {/* Bottom fade */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[var(--color-bg-dark)] via-[var(--color-bg-dark)]/60 to-transparent z-[1]"
      />

      {/* Vertical running head */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 1, ease: EASING.smooth }}
        className="hidden lg:flex absolute left-7 top-1/2 -translate-y-1/2 z-20 items-center gap-3 text-[10px] tracking-[0.4em] uppercase text-white/40 [writing-mode:vertical-rl] rotate-180"
      >
        <span>Issue N°01</span>
        <span className="h-8 w-px bg-white/30" aria-hidden />
        <span>Spring 2026</span>
        <span className="h-8 w-px bg-white/30" aria-hidden />
        <span>Poltava</span>
      </motion.div>

      {/* Section number — top right */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, delay: 1, ease: EASING.smooth }}
        className="absolute top-28 right-6 lg:right-16 z-10 text-right"
      >
        <div className="text-[10px] tracking-[0.35em] uppercase text-white/40 mb-1">
          N°01
        </div>
        <div
          aria-hidden
          className="font-display font-extralight text-[clamp(5rem,8vw,9rem)] leading-[0.85] text-white/[0.06] tracking-[-0.05em]"
        >
          01
        </div>
      </motion.div>

      {/* Main content */}
      <Container size="wide" className="relative z-10 pb-20 lg:pb-28">
        <motion.div style={{ y: textY }} className="max-w-[1100px]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="flex items-center gap-4 mb-8 lg:mb-10"
          >
            <span className="block w-12 h-px bg-white/40" aria-hidden />
            <span className="text-[11px] tracking-[0.35em] uppercase text-white/60 font-medium">
              Спешіалті ростерія · Полтава
            </span>
          </motion.div>

          <h1 className="font-display font-semibold text-[clamp(2.25rem,5.5vw,5.5rem)] leading-[0.98] tracking-[-0.045em]">
            <WordReveal delay={0.4} stagger={0.07} duration={1.1}>
              Кава, яка знає своє місце
            </WordReveal>
            <span className="block font-medium text-white/70 mt-1">
              <WordReveal delay={0.75} stagger={0.07} duration={1.1}>
                в твоєму ранку.
              </WordReveal>
            </span>
          </h1>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 1.4, ease: EASING.smooth }}
            className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-8 mt-14 lg:mt-16"
          >
            <p className="text-sm lg:text-base text-white/60 max-w-sm leading-relaxed">
              Обсмажуємо невеликими партіями. Відправляємо свіжим —
              від зерна до чашки не довше двох тижнів.
            </p>

            <div className="flex items-center gap-8">
              <Link
                href="/shop"
                className="group inline-flex items-center gap-3 text-sm tracking-[0.15em] uppercase border-b border-white pb-2 hover:opacity-70 transition-opacity duration-300"
              >
                До каталогу
                <span className="inline-block transition-transform duration-500 ease-out group-hover:translate-x-2">
                  →
                </span>
              </Link>
              <Link
                href="/subscription"
                className="hidden sm:inline-flex text-sm tracking-[0.15em] uppercase text-white/60 hover:text-white transition-colors duration-300"
              >
                Підписка
              </Link>
            </div>
          </motion.div>
        </motion.div>
      </Container>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.8 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-3 text-white/40"
      >
        <span className="text-[10px] tracking-[0.4em] uppercase">Скрол</span>
        <motion.span
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="block w-px h-10 bg-white/30"
          aria-hidden
        />
      </motion.div>
    </section>
  );
}
