"use client";

import { useCallback, type MouseEvent } from "react";
import { useCart, type AddToCartInput } from "@/lib/cart-store";
import { useCartFly } from "@/lib/cart-fly-store";
import type { Product } from "@/data/products";

/**
 * Hook used by every "Add to cart" button on the site.
 *
 * Wraps three concerns into one call:
 *   1. Inserts the line into the cart store
 *   2. Fires the fly-to-cart ghost from the click site (when an event is
 *      provided). The ghost provides the visual confirmation, so we don't
 *      auto-open the drawer on every add — that would be intrusive on
 *      grid pages where the user is still browsing.
 *   3. Falls back to opening the drawer when there's no source rect (e.g.
 *      keyboard activation) so the user still gets clear feedback.
 *
 * Consumers should pass the React `MouseEvent` so we can grab the source
 * rect from the actual button element (`currentTarget`).
 */
export function useAddToCart() {
  const add = useCart((s) => s.add);
  const openCart = useCart((s) => s.openCart);
  const triggerFly = useCartFly((s) => s.trigger);

  return useCallback(
    (
      product: Product,
      opts: AddToCartInput | undefined,
      event?: MouseEvent<HTMLElement>,
    ) => {
      add(product, opts);

      const sourceEl =
        event?.currentTarget instanceof HTMLElement ? event.currentTarget : null;

      if (sourceEl) {
        const rect = sourceEl.getBoundingClientRect();
        triggerFly({
          source: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          },
          thumb: product.gallery[0],
        });
      } else {
        // No click event (e.g. SR-triggered "Enter" without a clear source) —
        // open the drawer so feedback isn't lost.
        openCart();
      }
    },
    [add, openCart, triggerFly],
  );
}
