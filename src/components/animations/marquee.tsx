"use client";

import { motion } from "framer-motion";
import { type ReactNode, Children } from "react";
import { cn } from "@/lib/utils";

interface MarqueeProps {
  children: ReactNode;
  /** Seconds for one full loop; lower = faster */
  duration?: number;
  /** Reverse direction */
  reverse?: boolean;
  /** Pause on hover */
  pauseOnHover?: boolean;
  className?: string;
}

/**
 * Infinite horizontal marquee. Duplicates children twice to create
 * a seamless loop. Use for "свіжообсмажено · свіжообсмажено · ..." ribbons.
 */
export function Marquee({
  children,
  duration = 40,
  reverse = false,
  pauseOnHover = false,
  className,
}: MarqueeProps) {
  return (
    <div
      className={cn(
        "relative flex overflow-hidden group",
        className,
      )}
      aria-hidden
    >
      <motion.div
        className={cn(
          "flex shrink-0 items-center gap-14 whitespace-nowrap pr-14",
          pauseOnHover && "group-hover:[animation-play-state:paused]",
        )}
        animate={{ x: reverse ? ["-50%", "0%"] : ["0%", "-50%"] }}
        transition={{
          duration,
          repeat: Infinity,
          ease: "linear",
        }}
        style={{ width: "max-content" }}
      >
        {/* Render twice for seamless loop */}
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-14 shrink-0 pr-14">
            {Children.map(children, (child, j) => (
              <span key={`${i}-${j}`} className="shrink-0">
                {child}
              </span>
            ))}
          </div>
        ))}
      </motion.div>
    </div>
  );
}
