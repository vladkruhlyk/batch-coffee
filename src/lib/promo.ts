/**
 * Promo codes — single source of truth, used both client-side (to show
 * the discount in the cart/checkout summary) and server-side (to compute
 * the AUTHORITATIVE discount that lands on the order).
 *
 * Security model: the client only ever transmits the promo *code*, never
 * a discount amount. The server (`/api/orders/create`) recomputes the
 * discount here from the code + server-side subtotal, so a tampered
 * client can't grant itself an arbitrary discount.
 *
 * To add / remove / disable a code, edit PROMO_CODES. A future
 * admin-managed system would replace this map with a Sanity/DB lookup
 * (with expiry, usage limits, per-product scoping) — the call sites
 * wouldn't change, only the body of `lookupPromo`.
 */

export interface PromoResult {
  /** Normalised (upper-cased) code. */
  code: string;
  /** Fractional discount, e.g. 0.10 for −10%. */
  percent: number;
}

/** code → fractional discount. Codes are matched case-insensitively. */
const PROMO_CODES: Record<string, number> = {
  BATCH10: 0.1,
};

/** Resolve a raw user-typed code to a promo, or null if it doesn't exist. */
export function lookupPromo(raw: string | null | undefined): PromoResult | null {
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  const percent = PROMO_CODES[code];
  return percent ? { code, percent } : null;
}

/**
 * Discount in integer UAH for a given code applied to `subtotal`.
 * Returns 0 for an unknown/empty code. Rounded once here so client
 * display and server charge agree to the hryvnia.
 */
export function computePromoDiscount(
  code: string | null | undefined,
  subtotal: number,
): number {
  const promo = lookupPromo(code);
  if (!promo) return 0;
  if (!Number.isFinite(subtotal) || subtotal <= 0) return 0;
  return Math.round(subtotal * promo.percent);
}
