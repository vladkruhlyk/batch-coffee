/**
 * Canyon-level easing curves.
 * Use these for all Framer Motion transitions. NEVER use 'ease', 'linear', or default browser curves.
 */
export const EASING = {
  /** Smooth — main transition curve, use by default */
  smooth: [0.22, 1, 0.36, 1] as const,

  /** Exponential out — for bigger movements (page transitions, hero reveals) */
  expoOut: [0.16, 1, 0.3, 1] as const,

  /** Entrance — soft appearance of elements */
  entrance: [0.25, 0.1, 0.25, 1] as const,

  /** Spring-like — subtle bounce for hover states */
  spring: [0.34, 1.56, 0.64, 1] as const,
} as const;

/**
 * Timing constants (in seconds for Framer Motion, ms for CSS).
 */
export const DURATION = {
  fast: 0.3,
  base: 0.5,
  slow: 0.8,
  slower: 1.2,
} as const;
