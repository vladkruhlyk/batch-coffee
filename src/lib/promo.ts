/**
 * Shared promo types + the pure display-discount calculation.
 *
 * Promo codes are managed in Sanity now (see schemaTypes/promoCode.ts).
 * This module is the framework-agnostic, dependency-free core that both
 * the client (cart/checkout summary preview) and the server (authoritative
 * charge in api/orders/create) use, so the displayed discount and the
 * charged discount are computed by the SAME function.
 *
 * Security: the client stores only a "snapshot" of the applied code for
 * preview. The server NEVER trusts it — it re-resolves the code from
 * Sanity and re-evaluates validity + amount (see lib/promo-server.ts).
 */

export type PromoDiscountType = "percent" | "fixed";

/**
 * The minimal, display-only view of an applied promo kept in the cart
 * store. Enough to recompute the preview discount as the cart changes,
 * without re-hitting the network on every edit.
 */
export interface PromoSnapshot {
  code: string;
  discountType: PromoDiscountType;
  discountValue: number;
  /** Min subtotal for the code to apply; null/absent = no minimum. */
  minSubtotal?: number | null;
}

/**
 * Integer-UAH discount for a snapshot applied to `subtotal`. Pure — no
 * date logic (validity windows are checked server-side at apply +
 * checkout). Clamped to [0, subtotal] so a discount can never exceed the
 * basket or go negative. Rounded once so preview and charge agree.
 */
export function discountFromSnapshot(
  promo: PromoSnapshot | null | undefined,
  subtotal: number,
): number {
  if (!promo) return 0;
  if (!Number.isFinite(subtotal) || subtotal <= 0) return 0;
  if (
    promo.minSubtotal != null &&
    Number.isFinite(promo.minSubtotal) &&
    subtotal < promo.minSubtotal
  ) {
    return 0;
  }
  if (!Number.isFinite(promo.discountValue) || promo.discountValue <= 0) {
    return 0;
  }
  const raw =
    promo.discountType === "percent"
      ? subtotal * (promo.discountValue / 100)
      : promo.discountValue;
  const discount = Math.round(raw);
  return Math.max(0, Math.min(discount, subtotal));
}
