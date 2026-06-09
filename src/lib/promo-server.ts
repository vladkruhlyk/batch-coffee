import { freshClient } from "@/sanity/lib/client";
import { PROMO_CODE_BY_CODE_QUERY } from "@/sanity/queries";
import { discountFromSnapshot, type PromoSnapshot } from "./promo";

/**
 * Server-only promo resolution + validation. Imported by api/promo/validate
 * (the cart "Apply" check) and api/orders/create (the authoritative charge),
 * so both gates run the EXACT same rules against Sanity.
 */

export interface PromoRule {
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  active: boolean;
  startsAt?: string | null;
  expiresAt?: string | null;
  minSubtotal?: number | null;
}

/** Fetch a promo rule from Sanity by code (case-insensitive), or null. */
export async function resolvePromoRule(
  rawCode: string | null | undefined,
): Promise<PromoRule | null> {
  if (!rawCode || typeof rawCode !== "string") return null;
  // Cap defensively — callers validate, but this is the last gate before
  // the value is interpolated as a GROQ $param.
  if (rawCode.length > 50) return null;
  const code = rawCode.trim().toUpperCase();
  if (!code) return null;
  // freshClient bypasses Sanity's CDN so a disabled/expired code stops
  // working immediately — the CDN would otherwise serve the old rule for
  // minutes. revalidate:30 still caches repeat lookups in Next for 30s
  // (publish-to-live within ~30s, no hammering on hot codes).
  const rule = await freshClient.fetch<PromoRule | null>(
    PROMO_CODE_BY_CODE_QUERY,
    { code },
    { next: { revalidate: 30, tags: ["promoCode"] } },
  );
  return rule ?? null;
}

export interface PromoEvaluation {
  ok: boolean;
  discount: number;
  snapshot: PromoSnapshot | null;
  /** Human-readable (Ukrainian) reason when ok === false. */
  reason: string | null;
}

function fail(reason: string): PromoEvaluation {
  return { ok: false, discount: 0, snapshot: null, reason };
}

/**
 * Validate a fetched rule against the order's subtotal at time `now`.
 * Returns the authoritative discount + a display snapshot when valid.
 */
export function evaluatePromo(
  rule: PromoRule | null,
  subtotal: number,
  now: Date,
): PromoEvaluation {
  if (!rule) return fail("Такого промокоду не існує.");
  if (!rule.active) return fail("Промокод неактивний.");
  const nowTs = now.getTime();
  // Parse dates to timestamps and reject NON-FINITE results. Without the
  // isFinite guard, `new Date("garbage").getTime()` is NaN, and BOTH
  // `NaN > now` and `NaN < now` are false — silently skipping the window
  // check and letting an expired/not-yet-active code apply (an underpay
  // vector). A present-but-unparseable date means the code is
  // misconfigured, so we refuse it rather than ignore the constraint.
  if (rule.startsAt) {
    const startsTs = new Date(rule.startsAt).getTime();
    if (!Number.isFinite(startsTs)) {
      return fail("Промокод налаштований некоректно.");
    }
    if (startsTs > nowTs) return fail("Промокод ще не діє.");
  }
  if (rule.expiresAt) {
    const expiresTs = new Date(rule.expiresAt).getTime();
    if (!Number.isFinite(expiresTs)) {
      return fail("Промокод налаштований некоректно.");
    }
    if (expiresTs < nowTs) return fail("Термін дії промокоду минув.");
  }
  if (!Number.isFinite(rule.discountValue) || rule.discountValue <= 0) {
    return fail("Промокод налаштований некоректно.");
  }
  if (rule.discountType === "percent" && rule.discountValue > 100) {
    return fail("Промокод налаштований некоректно.");
  }
  if (
    rule.minSubtotal != null &&
    Number.isFinite(rule.minSubtotal) &&
    subtotal < rule.minSubtotal
  ) {
    // ceil, not round — never display a threshold lower than the actual
    // check (round(150.4)=150 would mislead a 150 ₴ cart that still fails).
    return fail(`Промокод діє від суми ${Math.ceil(rule.minSubtotal)} ₴.`);
  }

  const snapshot: PromoSnapshot = {
    code: rule.code,
    discountType: rule.discountType,
    discountValue: rule.discountValue,
    minSubtotal: rule.minSubtotal ?? null,
  };
  const discount = discountFromSnapshot(snapshot, subtotal);
  if (discount <= 0) {
    return fail("Промокод не дає знижки на цей кошик.");
  }
  return { ok: true, discount, snapshot, reason: null };
}

/**
 * Convenience for the order route: resolve + evaluate in one call,
 * returning just the discount (0 if the code is missing/invalid — the
 * order still goes through, just without a discount).
 */
export async function resolveOrderDiscount(
  rawCode: string | null | undefined,
  subtotal: number,
  now: Date,
): Promise<number> {
  if (!rawCode) return 0;
  const rule = await resolvePromoRule(rawCode);
  const result = evaluatePromo(rule, subtotal, now);
  return result.ok ? result.discount : 0;
}
