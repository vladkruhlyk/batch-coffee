import { freshClient } from "@/sanity/lib/client";
import { WHOLESALE_DISCOUNT_PERCENT, WHOLESALE_MIN_KG } from "./wholesale";
import { withRetry } from "./retry";

/**
 * Server-side authoritative order pricing.
 *
 * The browser sends unit prices, but they CANNOT be trusted — a tampered
 * request could set `unitPrice: 1` and underpay. So at order creation we
 * re-fetch every line's price from Sanity by slug + weight, re-apply the
 * wholesale rule ourselves, and charge those numbers. The client's prices
 * are ignored entirely for money.
 *
 * Mirrors the client display logic exactly: getWholesalePerKg
 * (lib/wholesale.ts) + getEffectiveItems (lib/cart-store.ts), so the
 * preview the customer saw matches what we charge — unless they tampered
 * or a price changed, in which case the SERVER number wins.
 *
 * Also rejects lines whose product/weight no longer exists in Sanity
 * (deleted SKU), so we never create an order referencing a phantom item.
 */

export interface IncomingOrderItem {
  productSlug: string;
  weightLabel: string;
  /** Client's grams for this variant — used ONLY to disambiguate when a
   *  product has two weights sharing a label (merchant misconfig). It
   *  selects among real catalog variants; it can never set a price. */
  weightGrams?: number;
  quantity: number;
}

export interface PricedOrderItem {
  productSlug: string;
  weightLabel: string;
  weightGrams: number;
  unitPrice: number;
  quantity: number;
  wholesaleApplied: boolean;
}

export interface OrderPricingResult {
  ok: boolean;
  items: PricedOrderItem[];
  subtotal: number;
  error: string | null;
}

interface RawWeight {
  label: string;
  grams: number;
  price: number;
  wholesalePrice?: number;
}
interface RawProduct {
  slug: string;
  weights: RawWeight[];
}

const ORDER_PRICING_QUERY = `
  *[_type == "product" && slug.current in $slugs]{
    "slug": slug.current,
    weights[]{ label, grams, price, wholesalePrice }
  }
`;

function fail(error: string): OrderPricingResult {
  return { ok: false, items: [], subtotal: 0, error };
}

export async function resolveOrderPricing(
  items: IncomingOrderItem[],
): Promise<OrderPricingResult> {
  if (!Array.isArray(items) || items.length === 0) {
    return fail("Кошик порожній.");
  }

  const slugs = Array.from(new Set(items.map((i) => i.productSlug)));
  // freshClient bypasses Sanity's CDN (useCdn: false) — `revalidate: 0`
  // alone only controls Next's fetch cache, NOT Sanity's edge cache, and
  // charging against a minutes-stale CDN price after a price hike would
  // underbill. Money paths read the live API.
  // Retry: this is a live (uncached) Sanity call on every checkout, so a
  // transient "fetch failed" must not kill the order — try a few times.
  const rows = await withRetry(() =>
    freshClient.fetch<RawProduct[]>(
      ORDER_PRICING_QUERY,
      { slugs },
      { next: { revalidate: 0 } },
    ),
  );

  // slug → (trimmed weightLabel → weights[]); slug → wholesalePerKg.
  // Labels are TRIMMED on both store and lookup — a stray trailing space
  // typed in Studio (or persisted in an old cart) must not reject a valid
  // order via Map's strict-equality keys. Values are ARRAYS because the
  // schema doesn't enforce label uniqueness; duplicates are disambiguated
  // at lookup rather than silently last-one-wins.
  const bySlug = new Map<string, Map<string, RawWeight[]>>();
  const wholesalePerKg = new Map<string, number | null>();
  for (const row of rows ?? []) {
    const labels = new Map<string, RawWeight[]>();
    let perKg: number | null = null;
    for (const w of row.weights ?? []) {
      const key = (w.label ?? "").trim();
      const bucket = labels.get(key);
      if (bucket) bucket.push(w);
      else labels.set(key, [w]);
      if (w.grams === 1000) {
        if (w.wholesalePrice && w.wholesalePrice > 0) {
          perKg = Math.round(w.wholesalePrice);
        } else if (w.price > 0) {
          perKg = Math.round(w.price * (1 - WHOLESALE_DISCOUNT_PERCENT / 100));
        }
        if (perKg !== null && perKg <= 0) perKg = null;
      }
    }
    bySlug.set(row.slug, labels);
    wholesalePerKg.set(row.slug, perKg);
  }

  /** Resolve one line's catalog weight, or null. Duplicate labels are
   *  disambiguated by the client's grams (selects among REAL variants
   *  only); still-ambiguous matches are refused rather than guessed. */
  const resolveWeight = (it: IncomingOrderItem): RawWeight | null => {
    const candidates = bySlug
      .get(it.productSlug)
      ?.get(it.weightLabel.trim());
    if (!candidates || candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];
    const byGrams = candidates.filter((w) => w.grams === it.weightGrams);
    return byGrams.length === 1 ? byGrams[0] : null;
  };

  // Aggregate total grams per slug across all lines (for the 3kg gate).
  const totalGrams = new Map<string, number>();
  for (const it of items) {
    const weight = resolveWeight(it);
    if (!weight) {
      return fail(
        "Один із товарів більше недоступний. Онови кошик і спробуй знову.",
      );
    }
    if (!Number.isFinite(weight.price) || weight.price <= 0) {
      return fail("Ціну одного з товарів не вдалось підтвердити.");
    }
    if (!Number.isInteger(it.quantity) || it.quantity < 1) {
      return fail("Некоректна кількість товару.");
    }
    totalGrams.set(
      it.productSlug,
      (totalGrams.get(it.productSlug) ?? 0) + weight.grams * it.quantity,
    );
  }

  const minGrams = WHOLESALE_MIN_KG * 1000;
  const priced: PricedOrderItem[] = items.map((it) => {
    const weight = resolveWeight(it)!;
    const perKg = wholesalePerKg.get(it.productSlug) ?? null;
    const slugTotal = totalGrams.get(it.productSlug) ?? 0;
    const wholesaleApplied = perKg !== null && slugTotal >= minGrams;
    const unitPrice = wholesaleApplied
      ? Math.round(perKg! * (weight.grams / 1000))
      : weight.price;
    return {
      productSlug: it.productSlug,
      weightLabel: it.weightLabel,
      weightGrams: weight.grams,
      unitPrice,
      quantity: it.quantity,
      wholesaleApplied,
    };
  });

  const subtotal = priced.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  if (!Number.isFinite(subtotal) || subtotal <= 0) {
    return fail("Не вдалось порахувати суму замовлення.");
  }

  return { ok: true, items: priced, subtotal, error: null };
}
