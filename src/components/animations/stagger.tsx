"use client";

import { motion, useInView } from "framer-motion";
import { useRef, type ReactNode } from "react";
import { EASING } from "@/lib/easing";

interface StaggerContainerProps {
  children: ReactNode;
  /** Stagger delay between children, in seconds */
  stagger?: number;
  /** Initial delay before first child appears */
  delay?: number;
  className?: string;
}

/**
 * Container that staggers animation of children.
 * Use together with <StaggerItem>.
 *
 * @example
 * <StaggerContainer>
 *   <StaggerItem><ProductCard /></StaggerItem>
 *   <StaggerItem><ProductCard /></StaggerItem>
 * </StaggerContainer>
 */
export function StaggerContainer({
  children,
  stagger = 0.1,
  delay = 0.15,
  className,
}: StaggerContainerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });

  return (
    <motion.div
      ref={ref}
      initial="initial"
      animate={inView ? "animate" : "initial"}
      variants={{
        animate: {
          transition: { staggerChildren: stagger, delayChildren: delay },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface StaggerItemProps {
  children: ReactNode;
  className?: string;
  y?: number;
}

export function StaggerItem({ children, className, y = 30 }: StaggerItemProps) {
  return (
    <motion.div
      variants={{
        initial: { opacity: 0, y },
        animate: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.8, ease: EASING.smooth },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
