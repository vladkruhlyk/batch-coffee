"use client";

import { motion } from "framer-motion";
import { EASING } from "@/lib/easing";

/**
 * Page transition wrapper.
 * Applied to every route change — gives soft fade-in instead of white flash.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASING.smooth }}
    >
      {children}
    </motion.div>
  );
}
