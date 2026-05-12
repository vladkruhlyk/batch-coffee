import type { CategoryKey, ProcessKind, RoastProfile } from "@/data/products";

/**
 * Shared filter configuration — types and constants used by both the
 * catalogue page and the filter sidebar. Lives in its own module to avoid
 * circular imports between the two.
 */

/** Step size (UAH) for the price range slider. Doubles as the minimum gap
 *  between min and max so the two thumbs can't lock together. Small enough
 *  to land on real catalog prices (which aren't always round multiples) but
 *  big enough that drags feel snappy. */
export const PRICE_STEP = 10;

export interface ShopFilters {
  /** Primary axis — top-level product type. Empty = show all categories. */
  categories: CategoryKey[];
  countries: string[];
  processes: ProcessKind[];
  roasts: RoastProfile[];
  /** Taste profile filters — multi-select on a 1-5 scale. Picking e.g.
   *  [3, 4, 5] shows products whose meter value is in the set. Empty array
   *  means "no filter on this dimension". Non-coffee SKUs (no meters) are
   *  automatically excluded as soon as any meter filter is active. */
  acidity: number[];
  sweetness: number[];
  bitterness: number[];
  /** [min, max] in UAH (inclusive). `null` means no price constraint — kept
   *  separate from "[absMin, absMax]" so the active-filter count knows when
   *  the user has actually narrowed the range. */
  priceRange: [number, number] | null;
  inStockOnly: boolean;
}

export const EMPTY_FILTERS: ShopFilters = {
  categories: [],
  countries: [],
  processes: [],
  roasts: [],
  acidity: [],
  sweetness: [],
  bitterness: [],
  priceRange: null,
  inStockOnly: false,
};

/** Possible meter values, in display order. Matches the 1-5 scale on
 *  `TasteMeters` in `data/products.ts`. */
export const METER_LEVELS = [1, 2, 3, 4, 5] as const;

export type SortKey = "popular" | "price-asc" | "price-desc" | "new";

export const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "popular", label: "Популярні" },
  { key: "new", label: "Спочатку новинки" },
  { key: "price-asc", label: "Дешевші спочатку" },
  { key: "price-desc", label: "Дорожчі спочатку" },
];
