"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { EASING } from "@/lib/easing";
import { useCartFly, type FlyPayload } from "@/lib/cart-fly-store";

/**
 * Renders a single short-lived "ghost" tile that flies from the click site
 * (a product card / PDP add button) into the cart icon in the header.
 *
 * Mounted once at the root via providers. Reads `pending` from
 * {@link useCartFly}; when set it spawns a Ghost component, which measures
 * the cart icon position via `[data-cart-target]` on mount and animates a
 * `motion.div` carrying the product's gradient thumb.
 *
 * The ghost follows a soft parabolic path: it lifts ~80px above the source
 * before sliding down + scaling toward the cart. We use Framer's keyframes
 * for `y` to get the arc, plus `expoOut` for the lateral motion.
 *
 * AnimatePresence's `onExitComplete` calls `clear()` so a fresh add re-runs
 * the cycle cleanly.
 */
export function CartFlyLayer() {
  const pending = useCartFly((s) => s.pending);
  const clear = useCartFly((s) => s.clear);

  return (
    <div
      // Full-viewport, ignores pointer events — purely visual.
      className="pointer-events-none fixed inset-0 z-[140]"
      aria-hidden
    >
      <AnimatePresence onExitComplete={clear}>
        {pending && <Ghost key={pending.id} payload={pending} />}
      </AnimatePresence>
    </div>
  );
}

function Ghost({ payload }: { payload: FlyPayload }) {
  const { source, thumb } = payload;

  // Measure the destination on mount via lazy init. Querying DOM in a
  // useState initializer is safe here because Ghost only ever mounts in
  // the browser (parent only renders us after a user action), and lazy
  // init runs exactly once — no setState-in-effect anti-pattern.
  const [target] = useState(() => {
    const el = document.querySelector<HTMLElement>("[data-cart-target]");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });

  // Local "done" state lets the parent's AnimatePresence trigger an exit
  // by removing the Ghost from the tree once travel completes.
  const [finished, setFinished] = useState(false);

  if (!target || finished) return null;

  // Source center — anchor so we can animate symmetrically about it.
  const startX = source.x + source.width / 2;
  const startY = source.y + source.height / 2;

  // Travel deltas from start → cart icon center.
  const dx = target.x - startX;
  const dy = target.y - startY;

  // Parabolic lift: peak ~80px above the midpoint. Three-keyframe path
  // gives the ghost a tossed feel rather than a straight diagonal slide.
  const peak = -80;
  const yKeyframes = [0, dy * 0.45 + peak, dy];
  const xKeyframes = [0, dx * 0.55, dx];
  const scaleKeyframes = [1, 0.7, 0.18];
  const opacityKeyframes = [1, 1, 0];

  // Ghost size — start at the source size (clamped), shrinks via scale.
  const size = Math.max(48, Math.min(120, source.width));

  return (
    <motion.div
      initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
      animate={{
        x: xKeyframes,
        y: yKeyframes,
        scale: scaleKeyframes,
        opacity: opacityKeyframes,
      }}
      transition={{
        duration: 0.85,
        ease: EASING.expoOut,
        times: [0, 0.55, 1],
      }}
      onAnimationComplete={() => setFinished(true)}
      style={{
        position: "fixed",
        left: startX - size / 2,
        top: startY - size / 2,
        width: size,
        height: size,
      }}
    >
      <div
        className="h-full w-full rounded-[var(--radius-lg)] shadow-[0_18px_40px_-12px_rgba(0,0,0,0.35)]"
        style={{ backgroundImage: thumb }}
      />
    </motion.div>
  );
}
