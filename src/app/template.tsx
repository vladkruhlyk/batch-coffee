"use client";

import { motion } from "framer-motion";
import { EASING } from "@/lib/easing";

/**
 * Page transition wrapper — applied to every route change.
 *
 * Kept very short (180ms) and opacity-only. The old 600ms fade + 12px Y
 * shift looked polished in isolation but stacked with route compilation
 * to make pages feel heavy ("туго переходить") — the new route was
 * invisible for more than half a second after the click. 180ms is below
 * the threshold where people perceive a delay; the navigation feels
 * snappy without losing the soft-fade refinement.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18, ease: EASING.smooth }}
    >
      {children}
    </motion.div>
  );
}
