import type { Product } from "@/data/products";

/**
 * Wholesale pricing — single source of truth.
 *
 * Rule: order 3+ kilograms of any single coffee SKU and the per-kilo
 * price drops by 15%. Shown as an informational badge on the card and
 * a dark accent card on the PDP. Not yet auto-applied at checkout —
 * that's a follow-up once the order flow is real.
 *
 * Eligibility: only products that ship in a 1000g pack qualify
 * (`beans` + the ground house blend). Drip, capsules, gear, gifts,
 * grinders return null.
 */
export const WHOLESALE_DISCOUNT_PERCENT = 15;
export const WHOLESALE_MIN_KG = 3;

/** Wholesale per-kg price for a single coffee, or null if the SKU
 *  doesn't sell in kilo packs.
 *
 *  Prefers an explicit `wholesalePrice` on the 1 kg variant (set by
 *  the roaster — their per-kg wholesale rate). Falls back to the
 *  computed −15% off retail when none is given. */
export function getWholesalePerKg(product: Product): number | null {
  const kgVariant = product.weights.find((w) => w.grams === 1000);
  if (!kgVariant) return null;
  if (kgVariant.wholesalePrice && kgVariant.wholesalePrice > 0) {
    return Math.round(kgVariant.wholesalePrice);
  }
  return Math.round(kgVariant.price * (1 - WHOLESALE_DISCOUNT_PERCENT / 100));
}
