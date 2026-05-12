"use client";

import { Marquee } from "@/components/animations/marquee";

interface RibbonProps {
  items: string[];
  /** Light or dark background? */
  variant?: "light" | "dark";
  duration?: number;
  reverse?: boolean;
}

/**
 * Between-section marquee ribbon. Used to create rhythm and give the
 * page that "editorial/fashion" feel where ribbons punctuate sections.
 */
export function Ribbon({
  items,
  variant = "light",
  duration = 50,
  reverse = false,
}: RibbonProps) {
  const isDark = variant === "dark";
  return (
    <div
      className={`relative py-7 lg:py-10 border-y ${
        isDark
          ? "bg-[var(--color-bg-dark)] text-[var(--color-text-inverse)] border-white/10"
          : "bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] border-[var(--color-border-default)]"
      }`}
    >
      <Marquee duration={duration} reverse={reverse}>
        {items.map((item, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-14 font-display font-semibold text-[clamp(1.5rem,3.2vw,2.75rem)] tracking-[-0.03em] leading-none"
          >
            {item}
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                isDark ? "bg-white/60" : "bg-[var(--color-text-primary)]/70"
              }`}
              aria-hidden
            />
          </span>
        ))}
      </Marquee>
    </div>
  );
}
