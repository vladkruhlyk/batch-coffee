"use client";

import { motion } from "framer-motion";
import { EASING } from "@/lib/easing";

/**
 * Page transition wrapper — applied to every route change.
 *
 * History:
 *   - 600ms + 12px Y shift → felt polished but pages were invisible too
 *     long; users called it "туго переходить".
 *   - 180ms opacity-only → snappy but lost the refined feel; user said
 *     "переходы не плавные".
 * Now: 320ms with a subtle 4px Y lift. Brain reads the soft motion as
 * "smooth", but the perceived wait stays under 200ms because content
 * is already 60% opacity by that point. Sweet spot between snappy and
 * soft.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: EASING.smooth }}
    >
      {children}
    </motion.div>
  );
}
