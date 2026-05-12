"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef } from "react";
import { EASING } from "@/lib/easing";
import { cn } from "@/lib/utils";

interface WordRevealProps {
  children: string;
  /** Delay before the first word in seconds */
  delay?: number;
  /** Stagger between words in seconds */
  stagger?: number;
  /** Per-word animation duration */
  duration?: number;
  className?: string;
  /** HTML element to render */
  as?: "h1" | "h2" | "h3" | "h4" | "p" | "span" | "div";
}

/**
 * Editorial word-by-word reveal. Each word sits in an overflow:hidden
 * wrapper and translates up from -100% Y. Creates the "masked slide-in"
 * feel used by Canyon / modern editorial sites.
 *
 * @example
 * <WordReveal as="h1" className="font-display text-7xl">
 *   Кава, яка знає своє місце
 * </WordReveal>
 */
export function WordReveal({
  children,
  delay = 0,
  stagger = 0.06,
  duration = 0.9,
  className,
  as = "span",
}: WordRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  const shouldReduceMotion = useReducedMotion();

  const words = children.split(/(\s+)/); // preserve spaces
  const Component = motion[as];

  if (shouldReduceMotion) {
    return (
      <Component
        ref={ref as never}
        className={className}
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : undefined}
        transition={{ duration: 0.4 }}
      >
        {children}
      </Component>
    );
  }

  return (
    <Component ref={ref as never} className={cn("inline-block", className)}>
      {words.map((word, i) => {
        if (/^\s+$/.test(word)) {
          return (
            <span key={i} aria-hidden>
              {word}
            </span>
          );
        }
        return (
          <span
            key={i}
            className="inline-block overflow-hidden align-bottom"
            style={{ lineHeight: "inherit" }}
          >
            <motion.span
              className="inline-block"
              initial={{ y: "115%" }}
              animate={inView ? { y: "0%" } : undefined}
              transition={{
                duration,
                ease: EASING.expoOut,
                delay: delay + i * stagger,
              }}
            >
              {word}
            </motion.span>
          </span>
        );
      })}
    </Component>
  );
}
