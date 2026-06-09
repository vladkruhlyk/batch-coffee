import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/data/products";
import { getWholesalePerKg, WHOLESALE_MIN_KG } from "./wholesale";
import type { PromoSnapshot } from "./promo";

/**
 * Cart store — Zustand + localStorage persistence.
 *
 * Each line item has a stable `id` derived from slug + variant combination
 * (weight / roast / grind), so adding the "same" product with a different
 * weight creates a new line rather than incrementing the existing one.
 *
 * Wholesale pricing: when the total weight of a single SKU reaches 3 kg
 * across all of its lines, every line of that SKU drops to the wholesale
 * per-kg rate. We snapshot the per-kg rate on each item at add-time, then
 * compute the "effective" price for display + submit via getEffectiveItems.
 * Cart-store stores the retail snapshot; UI + checkout call the helper.
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
  /** Retail per-line snapshot from Sanity at add-time. Always paid as-is
   *  unless wholesale kicks in for the whole SKU — then `getEffectiveItems`
   *  overrides this. */
  unitPrice: number;
  /** Wholesale per-kg rate snapshot, or null if the SKU has no 1 kg
   *  variant (drips, gear, etc — those never qualify for wholesale).
   *  Optional for back-compat with carts persisted before this field
   *  existed; treated like null when absent. */
  wholesalePerKg?: number | null;
  roast?: string;
  grind?: string;
  quantity: number;
}

/** Cart line enriched with the price the customer actually pays. */
export interface EffectiveCartItem extends CartItem {
  /** Per-unit price after applying the wholesale rule across the SKU. */
  effectiveUnitPrice: number;
  /** True iff the wholesale per-kg rate is in force for this SKU. */
  wholesaleActive: boolean;
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
  /** Applied promo snapshot (code + type + value for preview), or null.
   *  Persisted so it survives /cart → /checkout. The discount AMOUNT is
   *  never stored — it's recomputed from the snapshot for display and
   *  re-validated from Sanity on the server for the charge, so the two
   *  can't drift and the client can't fake a discount. */
  promo: PromoSnapshot | null;
  add: (product: Product, opts?: AddToCartInput) => void;
  remove: (id: string) => void;
  setQuantity: (id: string, n: number) => void;
  clear: () => void;
  /** Replace the entire items array. Used by the checkout's
   *  price-refresh step so it can update line prices in one shot
   *  without having to remove+re-add. */
  replaceItems: (items: CartItem[]) => void;
  setPromo: (promo: PromoSnapshot | null) => void;
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
      promo: null,

      add: (product, opts = {}) => {
        const weightIndex = opts.weightIndex ?? 0;
        const weight = product.weights[weightIndex];
        if (!weight) return;
        const roast = opts.roast ?? product.roasts?.[0];
        const grind = opts.grind;
        // Guard against NaN/invalid quantity: `Math.max(1, NaN)` is NaN,
        // which would poison every total downstream. Coerce to 1.
        const quantity =
          Number.isFinite(opts.quantity) && (opts.quantity as number) > 0
            ? Math.floor(opts.quantity as number)
            : 1;
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
            wholesalePerKg: getWholesalePerKg(product),
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

      clear: () => set({ items: [], promo: null }),

      replaceItems: (items) => set({ items }),

      setPromo: (promo) => set({ promo }),

      openCart: () => set({ open: true }),
      closeCart: () => set({ open: false }),
      toggleCart: () => set((s) => ({ open: !s.open })),
    }),
    {
      name: "batch-cart",
      version: 1,
      // v0 persisted `promoCode: string`; v1 uses `promo: PromoSnapshot |
      // null`. Drop the legacy key and never carry a non-object promo
      // over, so an old cache can't hydrate `promo` into a bad shape.
      migrate: (persisted, version) => {
        const s = (persisted ?? {}) as Record<string, unknown>;
        if (version < 1) {
          delete s.promoCode;
          if (typeof s.promo !== "object") s.promo = null;
        }
        return s;
      },
      partialize: (state) => ({
        items: state.items,
        promo: state.promo,
      }),
    },
  ),
);

/**
 * Apply wholesale across the cart. For each product slug, sum total kg
 * across its lines; if that total hits WHOLESALE_MIN_KG and the SKU
 * has a per-kg wholesale rate, drop every line of that SKU to the
 * wholesale rate (computed as `wholesalePerKg × weightGrams / 1000`,
 * rounded). Lines from SKUs that don't qualify keep their retail
 * unitPrice unchanged.
 */
export function getEffectiveItems(items: CartItem[]): EffectiveCartItem[] {
  const totalGrams = new Map<string, number>();
  for (const i of items) {
    totalGrams.set(
      i.slug,
      (totalGrams.get(i.slug) ?? 0) + i.weightGrams * i.quantity,
    );
  }
  const minGrams = WHOLESALE_MIN_KG * 1000;
  return items.map((i) => {
    const slugTotal = totalGrams.get(i.slug) ?? 0;
    const wholesaleActive =
      i.wholesalePerKg != null && slugTotal >= minGrams;
    const effectiveUnitPrice = wholesaleActive
      ? Math.round(i.wholesalePerKg! * (i.weightGrams / 1000))
      : i.unitPrice;
    return { ...i, effectiveUnitPrice, wholesaleActive };
  });
}

/** Derived subtotal — sum of effective line totals (wholesale-aware). */
export function getCartSubtotal(items: CartItem[]): number {
  return getEffectiveItems(items).reduce(
    (sum, i) => sum + i.effectiveUnitPrice * i.quantity,
    0,
  );
}

/** Total unit count (sum of quantities) — for the header badge. */
export function getCartCount(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}
