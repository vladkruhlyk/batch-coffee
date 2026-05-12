"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef, type ReactNode } from "react";
import { EASING } from "@/lib/easing";

interface RevealProps {
  children: ReactNode;
  /** Delay in seconds before animation starts */
  delay?: number;
  /** Vertical offset to animate from, in pixels */
  y?: number;
  /** Animation duration in seconds */
  duration?: number;
  /** Margin for Intersection Observer ("-10%" means trigger 10% before viewport edge) */
  margin?: string;
  /** Additional className */
  className?: string;
}

/**
 * Scroll-triggered reveal animation.
 * Fades up + translates y when scrolled into view.
 * Use this for all scroll-reveals. Canyon pattern.
 *
 * @example
 * <Reveal><h1>Hello</h1></Reveal>
 * <Reveal delay={0.15}><p>Subtitle</p></Reveal>
 */
export function Reveal({
  children,
  delay = 0,
  y = 40,
  duration = 1,
  margin = "-10%",
  className,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: margin as `${number}%` });
  const shouldReduceMotion = useReducedMotion();

  const initial = shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y };
  const animate = inView
    ? shouldReduceMotion
      ? { opacity: 1 }
      : { opacity: 1, y: 0 }
    : undefined;

  return (
    <motion.div
      ref={ref}
      initial={initial}
      animate={animate}
      transition={{ duration, delay, ease: EASING.smooth }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
