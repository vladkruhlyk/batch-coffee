"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * First-visit splash loader.
 *
 * Cycles through 4 PNG frames of the BATCH "splash" mark, each frame adding
 * one filled petal. Frames swap every 500ms; after the final frame the
 * splash holds briefly then fades out and unmounts.
 *
 * Suppressed for the rest of the session via `sessionStorage` so navigating
 * between routes (or refreshing within the tab) doesn't replay it.
 *
 * Frames live in `public/2.png` … `public/5.png` (the empty `1.png` state
 * was dropped — splash starts already with one petal filled). All are
 * rendered into the DOM at mount time and stacked with absolute positioning,
 * so the browser preloads them all and the swap is instant — no flash of empty.
 */

const FIRST_FRAME = 2; // 2.png … 5.png — empty 1.png state intentionally skipped
const LAST_FRAME = 5;
// One tick = one new petal. Frames cross-fade over CROSSFADE_MS, which is
// slightly less than the tick so each frame fully resolves before the next
// starts coming in (avoids a perpetual ghost-overlap that reads as muddy).
//
// History:
//   - Original timings totalled ~4.2s — user said too slow.
//   - 1.5s sprint → user said "стало очень быстрым в самом начале" — the
//     brand flourish was over before it registered, and the page's Onest
//     font hadn't finished loading yet so first-paint flashed system-ui.
// Settled on ~2.5s: long enough for the brand moment + font load, short
// enough that returning visitors (who skip the splash entirely via
// localStorage) aren't affected and first-time visitors don't tap out.
const FRAME_INTERVAL_MS = 360;
const CROSSFADE_MS = 320;
const HOLD_AFTER_LAST_MS = 380;
const FADE_OUT_MS = 600;
// Use `localStorage` (not session): show the splash exactly once per
// browser — returning visitors get the site instantly. New visitors get
// the brand moment once and never see it again. Closing the tab and
// reopening counted as a new session before, which felt annoying.
const STORAGE_KEY = "batch-loader-shown-v2";

// Standard "expo out" easing — fast then settles. Matches the rest of the site.
const EASE_OUT_EXPO: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function LoaderOverlay() {
  // Read persisted state during render via lazy init — avoids the
  // setState-in-effect anti-pattern (and saves a render). `typeof
  // window` guard keeps SSR happy.
  const [show, setShow] = useState(() => {
    if (typeof window === "undefined") return true;
    return !localStorage.getItem(STORAGE_KEY);
  });
  const [frame, setFrame] = useState(FIRST_FRAME);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Already-shown shortcut handled by the initializer above; here
    // we just bail without animating.
    if (!show) return;

    // Lock body scroll while splash is up.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    let current = FIRST_FRAME;
    const tick = setInterval(() => {
      current += 1;
      if (current > LAST_FRAME) {
        clearInterval(tick);
        // Brief hold so the eye registers the final state, then dismiss.
        // Mark only AFTER completion so React StrictMode's double-mount in
        // dev doesn't trip the early-return on remount and skip the splash.
        window.setTimeout(() => {
          localStorage.setItem(STORAGE_KEY, "1");
          setShow(false);
        }, HOLD_AFTER_LAST_MS);
        return;
      }
      setFrame(current);
    }, FRAME_INTERVAL_MS);

    return () => {
      clearInterval(tick);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Restore body scroll once the exit animation finishes.
  useEffect(() => {
    if (!show) {
      const t = window.setTimeout(() => {
        document.body.style.overflow = "";
      }, FADE_OUT_MS);
      return () => window.clearTimeout(t);
    }
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="batch-loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: FADE_OUT_MS / 1000, ease: EASE_OUT_EXPO }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-white"
          aria-hidden
        >
          {/* Container breathes in on mount and gently scales up on exit, so
              the splash feels like it lifts off the page rather than blinking
              away. Cross-fading the frames inside provides the petal-by-petal
              smoothness. */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ scale: 1.04 }}
            transition={{
              opacity: { duration: 0.6, ease: EASE_OUT_EXPO },
              scale: { duration: 1.1, ease: EASE_OUT_EXPO },
            }}
            className="relative w-40 h-40 sm:w-48 sm:h-48 lg:w-56 lg:h-56"
          >
            {Array.from(
              { length: LAST_FRAME - FIRST_FRAME + 1 },
              (_, i) => i + FIRST_FRAME,
            ).map((n) => (
              <Image
                key={n}
                src={`/${n}.png`}
                alt=""
                fill
                priority
                sizes="(min-width: 1024px) 224px, (min-width: 640px) 192px, 160px"
                className="object-contain"
                style={{
                  opacity: frame === n ? 1 : 0,
                  transition: `opacity ${CROSSFADE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
                }}
              />
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
