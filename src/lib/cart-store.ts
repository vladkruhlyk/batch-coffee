import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/data/products";

/**
 * Cart store — Zustand + localStorage persistence.
 *
 * Each line item has a stable `id` derived from slug + variant combination
 * (weight / roast / grind), so adding the "same" product with a different
 * weight creates a new line rather than incrementing the existing one.
 */

export interface CartItem {
  /** Stable key — `${slug}__${weightLabel}__${roast ?? ""}__${grind ?? ""}`. */
  id: string;
  slug: string;
  name: string;
  /** Primary gallery gradient — used as thumb background. */
  thumb: string;
  weightLabel: string;
  weightGrams: number;
  unitPrice: number;
  roast?: string;
  grind?: string;
  quantity: number;
}

export interface AddToCartInput {
  weightIndex?: number;
  roast?: string;
  grind?: string;
  quantity?: number;
}

interface CartState {
  items: CartItem[];
  open: boolean;
  /** Increments on every add — lets UI play a pulse animation on the badge. */
  lastAddBump: number;
  add: (product: Product, opts?: AddToCartInput) => void;
  remove: (id: string) => void;
  setQuantity: (id: string, n: number) => void;
  clear: () => void;
  /** Replace the entire items array. Used by the checkout's
   *  price-refresh step so it can update line prices in one shot
   *  without having to remove+re-add. */
  replaceItems: (items: CartItem[]) => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
}

function makeItemId(
  slug: string,
  weightLabel: string,
  roast?: string,
  grind?: string,
): string {
  return `${slug}__${weightLabel}__${roast ?? ""}__${grind ?? ""}`;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      open: false,
      lastAddBump: 0,

      add: (product, opts = {}) => {
        const weightIndex = opts.weightIndex ?? 0;
        const weight = product.weights[weightIndex];
        if (!weight) return;
        const roast = opts.roast ?? product.roasts?.[0];
        const grind = opts.grind;
        const quantity = Math.max(1, opts.quantity ?? 1);
        const id = makeItemId(product.slug, weight.label, roast, grind);

        const items = [...get().items];
        const existing = items.find((i) => i.id === id);
        if (existing) {
          existing.quantity += quantity;
        } else {
          items.push({
            id,
            slug: product.slug,
            name: product.name,
            thumb: product.gallery[0],
            weightLabel: weight.label,
            weightGrams: weight.grams,
            unitPrice: weight.price,
            roast,
            grind,
            quantity,
          });
        }

        // Note: we deliberately do NOT auto-open the drawer here. Visual
        // feedback comes from the fly-to-cart ghost + icon pulse fired by
        // `useAddToCart`. Auto-opening interrupts browsing on grid pages.
        // Consumers can call `openCart()` manually when appropriate (e.g.
        // a "Buy now" button on the PDP).
        set({ items, lastAddBump: Date.now() });
      },

      remove: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

      setQuantity: (id, n) =>
        set((state) => ({
          items: state.items
            .map((i) => (i.id === id ? { ...i, quantity: Math.max(1, n) } : i))
            .filter((i) => i.quantity > 0),
        })),

      clear: () => set({ items: [] }),

      replaceItems: (items) => set({ items }),

      openCart: () => set({ open: true }),
      closeCart: () => set({ open: false }),
      toggleCart: () => set((s) => ({ open: !s.open })),
    }),
    {
      name: "batch-cart",
      partialize: (state) => ({ items: state.items }),
    },
  ),
);

/** Derived subtotal — sum of line totals. */
export function getCartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
}

/** Total unit count (sum of quantities) — for the header badge. */
export function getCartCount(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}
