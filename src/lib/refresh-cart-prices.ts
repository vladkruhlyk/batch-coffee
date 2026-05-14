import { client as sanityClient } from "@/sanity/lib/client";
import type { CartItem } from "./cart-store";

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
      weights
    }`,
    { slugs },
  );

  // slug → weightLabel → currentPrice
  const lookup = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const weights = new Map<string, number>();
    for (const w of row.weights ?? []) {
      weights.set(w.label, w.price);
    }
    lookup.set(row.slug, weights);
  }

  const changed: PriceRefreshResult["changed"] = [];
  const updatedItems = items.map((item) => {
    const live = lookup.get(item.slug)?.get(item.weightLabel);
    if (live == null || live === item.unitPrice) return item;
    changed.push({
      id: item.id,
      name: item.name,
      weightLabel: item.weightLabel,
      oldPrice: item.unitPrice,
      newPrice: live,
    });
    return { ...item, unitPrice: live };
  });

  return { updatedItems, changed };
}
