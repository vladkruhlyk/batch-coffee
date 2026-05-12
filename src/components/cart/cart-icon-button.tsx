"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import { useSyncExternalStore } from "react";
import { EASING } from "@/lib/easing";
import { getCartCount, useCart } from "@/lib/cart-store";

/**
 * Header cart button. Opens the drawer on click, shows a live item count,
 * and pulses when `lastAddBump` ticks (i.e. user just added something).
 *
 * The count stays at 0 on the server render (and on the first client render
 * before Zustand's persist middleware has rehydrated from localStorage),
 * then fades in once hydration finishes. Subscribing via
 * `useSyncExternalStore` keeps this an external-state-driven derivation
 * instead of a setState-in-effect anti-pattern.
 */
export function CartIconButton() {
  const items = useCart((s) => s.items);
  const lastAddBump = useCart((s) => s.lastAddBump);
  const openCart = useCart((s) => s.openCart);
  const hydrated = useHasHydrated();

  const count = hydrated ? getCartCount(items) : 0;
  const show = hydrated && count > 0;

  return (
    <button
      type="button"
      aria-label={`Кошик${show ? ` (${count})` : ""}`}
      onClick={openCart}
      // CartFlyLayer queries this attribute to find the destination point
      // for the "fly to cart" ghost. Keep it here, not on a child wrapper,
      // so the rect math lines up with what the user sees.
      data-cart-target
      className="relative p-2 hover:opacity-60 transition-opacity duration-300"
    >
      {/* Icon — bumps briefly on add. Keyed on lastAddBump so the animation
          re-fires for each new add without any local state shuffling. */}
      <motion.span
        key={lastAddBump || "idle"}
        initial={lastAddBump ? { scale: 0.85 } : false}
        animate={{ scale: 1 }}
        transition={{ duration: 0.5, ease: EASING.spring }}
        className="block"
      >
        <ShoppingBag className="w-5 h-5" strokeWidth={1.5} />
      </motion.span>

      {/* Badge */}
      <AnimatePresence>
        {show && (
          <motion.span
            key="badge"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: EASING.spring }}
            className="pointer-events-none absolute -top-0.5 -right-0.5 grid min-h-[18px] min-w-[18px] place-items-center rounded-full bg-[var(--color-text-primary)] px-1.5 text-[10px] font-semibold leading-none text-[var(--color-text-inverse)] tabular-nums"
          >
            {/* Count swaps with a subtle slide-up */}
            <AnimatePresence mode="popLayout">
              <motion.span
                key={count}
                initial={{ y: -8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 8, opacity: 0 }}
                transition={{ duration: 0.25, ease: EASING.smooth }}
              >
                {count}
              </motion.span>
            </AnimatePresence>

            {/* Ping halo on add — keyed on lastAddBump so it retriggers. */}
            <motion.span
              key={`ping-${lastAddBump}`}
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: 2.1, opacity: 0 }}
              transition={{ duration: 0.7, ease: EASING.smooth }}
              className="absolute inset-0 rounded-full bg-[var(--color-text-primary)]"
              aria-hidden
            />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

/**
 * Subscribe to Zustand persist hydration the React-19-blessed way.
 * `useSyncExternalStore` gives us a clean external-state read, with a stable
 * SSR fallback that avoids hydration mismatches.
 */
function useHasHydrated(): boolean {
  return useSyncExternalStore(
    (cb) => useCart.persist.onFinishHydration(cb),
    () => useCart.persist.hasHydrated(),
    () => false,
  );
}
