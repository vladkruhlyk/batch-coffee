"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Container } from "@/components/layout/container";
import { SectionKicker } from "@/components/layout/section-kicker";
import { WordReveal } from "@/components/animations/word-reveal";
import { Reveal } from "@/components/animations/reveal";
import { EASING } from "@/lib/easing";

const POSTS = [
  {
    slug: "jak-zavaryty-v60",
    category: "Brew Guide",
    title: "Як заварити V60 так, щоб чашка говорила сама за себе",
    excerpt: "Три параметри, які змінять усе: помел, температура, час.",
    readTime: "6 хв",
    date: "Березень 2026",
    gradient:
      "radial-gradient(ellipse at 30% 40%, #C9A87B 0%, #6B4225 55%, #1F1208 100%)",
    offsetClass: "lg:mt-0",
    aspect: "aspect-[3/4]",
  },
  {
    slug: "ferma-bensa",
    category: "Історії ферм",
    title: "Ферма Бенса, Ефіопія — три покоління однієї історії",
    excerpt:
      "Чому ефіопська кава смакує як ягоди, і хто стоїть за нашим новим лотом.",
    readTime: "8 хв",
    date: "Березень 2026",
    gradient:
      "radial-gradient(ellipse at 60% 50%, #8B3A2B 0%, #3D1812 65%, #0F0605 100%)",
    offsetClass: "lg:mt-48",
    aspect: "aspect-[4/5]",
  },
  {
    slug: "shho-take-speshialti",
    category: "Основи",
    title: "Що таке спешіалті кава і чим вона відрізняється від звичайної",
    excerpt:
      "Без пафосу: звідки береться оцінка 80+, як її ставлять і чому це має значення.",
    readTime: "5 хв",
    date: "Лютий 2026",
    gradient:
      "radial-gradient(ellipse at 50% 45%, #7A5C3E 0%, #28190E 70%, #0A0504 100%)",
    offsetClass: "lg:mt-24",
    aspect: "aspect-[3/4]",
  },
];

export function HomeJournal() {
  return (
    <section className="relative py-[var(--section-gap)] bg-[var(--color-bg-primary)] overflow-hidden">
      <Container size="wide">
        {/* Header */}
        <div className="grid lg:grid-cols-12 gap-8 mb-20 lg:mb-28">
          <div className="lg:col-span-8">
            <Reveal>
              <SectionKicker label="Журнал" />
            </Reveal>
            <h2 className="font-display font-semibold text-[clamp(2rem,4.5vw,4.5rem)] leading-[1] tracking-[-0.045em] mt-10 max-w-4xl">
              <WordReveal duration={1} stagger={0.07}>
                Те, що варто читати
              </WordReveal>
              <span className="block font-medium text-[var(--color-text-secondary)] mt-1">
                <WordReveal delay={0.3} duration={1} stagger={0.07}>
                  з чашкою в руці.
                </WordReveal>
              </span>
            </h2>
          </div>
        </div>

        {/* Offset grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-14">
          {POSTS.map((post, i) => (
            <div key={post.slug} className={post.offsetClass}>
              <JournalCard post={post} index={i} />
            </div>
          ))}
        </div>

        {/* Bottom running signature */}
        <div className="mt-24 lg:mt-32 pt-8 border-t border-[var(--color-border-default)] flex flex-col md:flex-row md:items-baseline justify-between gap-3 text-[10px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]">
          <span>Journal · Spring 2026</span>
          <span className="font-display text-xs">BATCH Coffee Roastery</span>
        </div>
      </Container>
    </section>
  );
}

interface PostProps {
  post: (typeof POSTS)[number];
  index: number;
}

function JournalCard({ post, index }: PostProps) {
  return (
    <Link href={`/journal/${post.slug}`} className="group block">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-10%" }}
        transition={{
          duration: 1,
          ease: EASING.expoOut,
          delay: 0.1 + index * 0.15,
        }}
      >
        <div className={`relative ${post.aspect} overflow-hidden bg-[var(--color-bg-secondary)] mb-7 rounded-[var(--radius-xl)]`}>
          <motion.div
            whileHover={{ scale: 1.04 }}
            transition={{ duration: 0.9, ease: EASING.smooth }}
            className="absolute inset-0"
          >
            <div
              aria-hidden
              className="absolute inset-0"
              style={{ backgroundImage: post.gradient }}
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
          {/* Category top */}
          <div className="absolute top-5 left-5 right-5 flex items-center justify-between text-white/90">
            <span className="text-[10px] tracking-[0.3em] uppercase border border-white/30 px-3 py-1.5 backdrop-blur-sm rounded-full">
              {post.category}
            </span>
            <span className="text-[10px] tracking-[0.3em] uppercase text-white/50 font-display">
              N°0{index + 1}
            </span>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 text-[11px] tracking-[0.2em] uppercase text-[var(--color-text-muted)] mb-4">
          <span>{post.date}</span>
          <span className="block w-6 h-px bg-[var(--color-border-strong)]" aria-hidden />
          <span>{post.readTime}</span>
        </div>

        <h3 className="font-display font-semibold text-2xl lg:text-[32px] leading-[1.05] tracking-[-0.02em] mb-4 group-hover:opacity-60 transition-opacity duration-300">
          {post.title}
        </h3>
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
          {post.excerpt}
        </p>
      </motion.div>
    </Link>
  );
}
