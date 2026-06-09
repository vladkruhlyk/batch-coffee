import { client as sanityClient } from "@/sanity/lib/client";
import type { CartItem } from "./cart-store";
import { WHOLESALE_DISCOUNT_PERCENT } from "./wholesale";

/**
 * Re-fetch live Sanity prices for each line in the cart and return the
 * subset that have drifted from what's stored locally.
 *
 * Cart items snapshot the `unitPrice` at add-time, then sit in
 * localStorage forever. If admin bumps a price in Sanity between
 * "added to cart" and "open checkout", the customer would see the old
 * price in the cart drawer and the cart subtotal, then the order
 * would land in Supabase at … well, also the old price, since
 * createOrder uses cart.unitPrice. Either way it's inconsistent
 * with what's actually for sale.
 *
 * Calling this at checkout open ensures the customer sees today's
 * prices before they hit "Підтвердити". When prices have moved, the
 * UI surfaces a notice so the user knows the total changed under
 * them and isn't surprised.
 *
 * NOTE on trust: this still trusts the client to send the right
 * unitPrice into createOrder. For real production we should move
 * order creation server-side and look up prices there. For now,
 * client-side refresh is at least consistent with the displayed
 * total.
 */

interface SanityWeight {
  grams: number;
  label: string;
  price: number;
  wholesalePrice?: number;
}

interface ProductPriceRow {
  slug: string;
  weights: SanityWeight[];
}

export interface PriceRefreshResult {
  updatedItems: CartItem[];
  changed: Array<{
    id: string;
    name: string;
    weightLabel: string;
    oldPrice: number;
    newPrice: number;
  }>;
}

export async function refreshCartPrices(
  items: CartItem[],
): Promise<PriceRefreshResult> {
  if (items.length === 0) {
    return { updatedItems: [], changed: [] };
  }

  // Unique slugs — one round-trip total, no matter how many lines.
  const slugs = Array.from(new Set(items.map((i) => i.slug)));

  const rows = await sanityClient.fetch<ProductPriceRow[]>(
    `*[_type == "product" && slug.current in $slugs]{
      "slug": slug.current,
      weights[]{ label, grams, price, wholesalePrice }
    }`,
    { slugs },
  );

  // slug → weightLabel → currentPrice; plus wholesale per-kg (derived
  // from the 1kg variant if any). Mirrors getWholesalePerKg in
  // lib/wholesale.ts exactly: prefer the explicit wholesalePrice the
  // roaster set on the 1kg variant, fall back to the −15% computation
  // only when it's absent. Guard against a 0/invalid retail price so a
  // misconfigured Sanity doc can't yield a 0 wholesale rate (which
  // would flow into a 0-revenue order line).
  const priceLookup = new Map<string, Map<string, number>>();
  const wholesaleLookup = new Map<string, number | null>();
  for (const row of rows) {
    const weights = new Map<string, number>();
    let wholesalePerKg: number | null = null;
    for (const w of row.weights ?? []) {
      weights.set(w.label, w.price);
      if (w.grams === 1000) {
        if (w.wholesalePrice && w.wholesalePrice > 0) {
          wholesalePerKg = Math.round(w.wholesalePrice);
        } else if (w.price > 0) {
          wholesalePerKg = Math.round(
            w.price * (1 - WHOLESALE_DISCOUNT_PERCENT / 100),
          );
        }
        // else leave null — no valid rate to apply.
        if (wholesalePerKg !== null && wholesalePerKg <= 0) {
          wholesalePerKg = null;
        }
      }
    }
    priceLookup.set(row.slug, weights);
    wholesaleLookup.set(row.slug, wholesalePerKg);
  }

  const changed: PriceRefreshResult["changed"] = [];
  const updatedItems = items.map((item) => {
    const rawLivePrice = priceLookup.get(item.slug)?.get(item.weightLabel);
    // Treat a 0 / negative / non-finite live price as "no valid price" and
    // keep the existing one. Without this, `0 ?? old` is 0 (nullish only
    // catches null/undefined) — a misconfigured/zeroed Sanity price would
    // silently make the cart line free.
    const livePrice =
      typeof rawLivePrice === "number" && rawLivePrice > 0
        ? rawLivePrice
        : null;
    const liveWholesale = wholesaleLookup.get(item.slug) ?? null;
    const priceChanged = livePrice != null && livePrice !== item.unitPrice;
    const wholesaleChanged =
      liveWholesale !== (item.wholesalePerKg ?? null);
    if (!priceChanged && !wholesaleChanged) return item;
    if (priceChanged) {
      changed.push({
        id: item.id,
        name: item.name,
        weightLabel: item.weightLabel,
        oldPrice: item.unitPrice,
        newPrice: livePrice!,
      });
    }
    return {
      ...item,
      unitPrice: livePrice ?? item.unitPrice,
      wholesalePerKg: liveWholesale,
    };
  });

  return { updatedItems, changed };
}
