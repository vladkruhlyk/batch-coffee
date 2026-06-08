"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  Grid2x2,
  Square,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Container } from "@/components/layout/container";
import { ProductCard } from "@/components/shop/product-card";
import { FilterSidebar } from "@/components/shop/filter-sidebar";
import {
  EMPTY_FILTERS,
  SORT_OPTIONS,
  type ShopFilters,
  type SortKey,
} from "@/components/shop/filters-config";
import { cn } from "@/lib/utils";
import { EASING } from "@/lib/easing";
import {
  CATEGORIES,
  getStartingPrice,
  type CategoryKey,
  type Product,
} from "@/data/products";

interface ShopCatalogProps {
  products: Product[];
  /** Categories preselected from the URL (e.g. /shop?category=drip). The
   *  server page parses the query and hands us a normalized list. */
  initialCategories?: CategoryKey[];
}

/**
 * Main catalogue — filter sidebar + product grid.
 *
 * All filtering / sorting is client-side — the dataset is small and it lets
 * us give instant feedback without navigation. If the catalogue grows past
 * ~100 products we can move to URL-synced params + server fetch.
 */
export function ShopCatalog({
  products,
  initialCategories = [],
}: ShopCatalogProps) {
  const [filters, setFilters] = useState<ShopFilters>(() => ({
    ...EMPTY_FILTERS,
    categories: initialCategories,
  }));
  const [sort, setSort] = useState<SortKey>("popular");
  const [sortOpen, setSortOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Mobile-only grid density: 1 = one big card per row, 2 = two compact.
  // Desktop is unaffected (always sm:2 / xl:3). Default 2 — denser, more
  // products visible at a glance, which is what most shoppers expect.
  const [mobileCols, setMobileCols] = useState<1 | 2>(2);

  // Price slider bounds — exact starting prices of the cheapest and most
  // expensive SKUs in the catalogue. Not rounded: the user wants the
  // extremes to read as real product prices, not nice-but-fake numbers.
  // Adapts automatically when products are added/removed.
  const priceBounds = useMemo(() => {
    if (products.length === 0) return { min: 0, max: 1000 };
    const prices = products.map(getStartingPrice);
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
    };
  }, [products]);

  // Derive the available filter options from the full dataset. Coffee-only
  // fields (country / process / roast) may be absent on gear / gifts — filter
  // them out before building the set so the sidebar doesn't list `undefined`.
  const options = useMemo(() => {
    const countries = Array.from(
      new Set(
        products
          .map((p) => p.country)
          .filter((c): c is string => Boolean(c)),
      ),
    ).sort();
    const processes = Array.from(
      new Set(
        products
          .map((p) => p.process)
          .filter((p): p is NonNullable<typeof p> => Boolean(p)),
      ),
    ).sort();
    const roasts = Array.from(
      new Set(products.flatMap((p) => p.roasts ?? [])),
    ).sort();
    return { countries, processes, roasts };
  }, [products]);

  // Apply filters + sort — category is just another filter group now.
  const filtered = useMemo(() => {
    const matches = products.filter((p) => {
      if (filters.categories.length && !filters.categories.includes(p.category))
        return false;
      if (filters.countries.length) {
        if (!p.country || !filters.countries.includes(p.country)) return false;
      }
      if (filters.processes.length) {
        if (!p.process || !filters.processes.includes(p.process)) return false;
      }
      if (filters.roasts.length) {
        if (!p.roasts || !p.roasts.some((r) => filters.roasts.includes(r)))
          return false;
      }
      // Taste meters — any active meter filter implicitly excludes non-coffee
      // SKUs (gear / gifts / grinders don't have meters).
      if (filters.acidity.length) {
        if (!p.meters || !filters.acidity.includes(p.meters.acidity))
          return false;
      }
      if (filters.sweetness.length) {
        if (!p.meters || !filters.sweetness.includes(p.meters.sweetness))
          return false;
      }
      if (filters.bitterness.length) {
        if (!p.meters || !filters.bitterness.includes(p.meters.bitterness))
          return false;
      }
      if (filters.priceRange) {
        const [lo, hi] = filters.priceRange;
        const price = getStartingPrice(p);
        if (price < lo || price > hi) return false;
      }
      if (filters.inStockOnly && !p.inStock) return false;
      return true;
    });

    const sorted = [...matches];
    switch (sort) {
      case "price-asc":
        sorted.sort((a, b) => getStartingPrice(a) - getStartingPrice(b));
        break;
      case "price-desc":
        sorted.sort((a, b) => getStartingPrice(b) - getStartingPrice(a));
        break;
      case "new":
        sorted.sort((a, b) => {
          const aNew = a.badge === "Новий" ? 1 : 0;
          const bNew = b.badge === "Новий" ? 1 : 0;
          return bNew - aNew;
        });
        break;
      case "popular":
      default:
        sorted.sort((a, b) => {
          const aBest = a.badge === "Bestseller" ? 1 : 0;
          const bBest = b.badge === "Bestseller" ? 1 : 0;
          return bBest - aBest;
        });
        break;
    }
    return sorted;
  }, [products, filters, sort]);

  const activeFilterCount =
    filters.categories.length +
    filters.countries.length +
    filters.processes.length +
    filters.roasts.length +
    filters.acidity.length +
    filters.sweetness.length +
    filters.bitterness.length +
    (filters.priceRange ? 1 : 0) +
    (filters.inStockOnly ? 1 : 0);

  const resetFilters = () => setFilters(EMPTY_FILTERS);

  return (
    <Container size="wide" className="pt-28 lg:pt-36 pb-[var(--section-gap)]">
      {/* Breadcrumbs */}
      <nav
        aria-label="Хлібні крихти"
        className="flex flex-wrap items-center gap-2 text-[11px] tracking-[0.2em] uppercase text-[var(--color-text-muted)] mb-10"
      >
        <Link
          href="/"
          className="hover:text-[var(--color-text-primary)] transition-colors"
        >
          Головна
        </Link>
        <span aria-hidden>/</span>
        <span className="text-[var(--color-text-primary)]">Каталог</span>
      </nav>

      {/* Heading */}
      <div className="grid lg:grid-cols-12 gap-8 mb-12 lg:mb-16">
        <div className="lg:col-span-8">
          <h1 className="font-display font-semibold text-[clamp(2rem,4.5vw,4.25rem)] leading-[1.02] tracking-[-0.04em]">
            Уся кава, яку ми
            <span className="block text-[var(--color-text-secondary)] font-medium">
              зараз обсмажуємо.
            </span>
          </h1>
        </div>
        <div className="lg:col-span-4 lg:col-start-9 lg:pt-4">
          <p className="text-[var(--color-text-secondary)] leading-relaxed">
            Свіжі лоти, моносорти й бленди. Обери категорію, країну походження,
            метод заварювання чи профіль обсмажки — і ми покажемо тільки те, що
            тобі підходить.
          </p>
          {/* Secondary CTA — points at the compare tool. Catalog is the
              most natural place to discover it; from the footer it feels
              buried. Subtle underlined link rather than a button, since
              the toolbar below already has two pill controls. */}
          <Link
            href="/compare"
            className="mt-5 inline-flex items-center gap-2 text-[11px] tracking-[0.3em] uppercase border-b border-[var(--color-text-primary)] pb-1 hover:opacity-60 transition-opacity"
          >
            Порівняти кави →
          </Link>
        </div>
      </div>

      {/* Mobile-only category chip row — horizontal scroll, mirrors
          the desktop sidebar's category checkboxes but in a one-line
          format that's faster on a phone. Each pill toggles the
          corresponding category in the same `filters.categories`
          state so behaviour stays consistent across breakpoints. */}
      <div className="lg:hidden -mx-6 mb-6 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-2 px-6 w-max">
          <button
            type="button"
            onClick={() =>
              setFilters((f) => ({ ...f, categories: [] }))
            }
            className={cn(
              "shrink-0 inline-flex items-center rounded-full px-4 py-2 text-sm whitespace-nowrap transition-colors",
              filters.categories.length === 0
                ? "bg-[var(--color-text-primary)] text-[var(--color-text-inverse)]"
                : "border border-[var(--color-border-strong)] text-[var(--color-text-primary)] hover:border-[var(--color-text-primary)]",
            )}
          >
            Усі
          </button>
          {CATEGORIES.map((cat) => {
            const active = filters.categories.includes(cat.key);
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => {
                  setFilters((f) => ({
                    ...f,
                    categories: active
                      ? f.categories.filter((k) => k !== cat.key)
                      : [...f.categories, cat.key],
                  }));
                }}
                className={cn(
                  "shrink-0 inline-flex items-center rounded-full px-4 py-2 text-sm whitespace-nowrap transition-colors",
                  active
                    ? "bg-[var(--color-text-primary)] text-[var(--color-text-inverse)]"
                    : "border border-[var(--color-border-strong)] text-[var(--color-text-primary)] hover:border-[var(--color-text-primary)]",
                )}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-5 border-y border-[var(--color-border-default)] mb-10 lg:mb-14">
        <div className="flex items-center gap-5">
          <span className="text-sm text-[var(--color-text-secondary)] tabular-nums">
            {filtered.length}{" "}
            <span className="text-[var(--color-text-muted)]">
              {plural(filtered.length, ["товар", "товари", "товарів"])}
            </span>
          </span>

          {/* Mobile filter trigger */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="lg:hidden inline-flex items-center gap-2 rounded-full border border-[var(--color-border-strong)] px-4 py-2 text-sm hover:border-[var(--color-text-primary)] transition-colors"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Фільтри
            {activeFilterCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] text-[10px] font-medium h-5 min-w-5 px-1.5">
                {activeFilterCount}
              </span>
            )}
          </button>

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={resetFilters}
              className="hidden lg:inline text-xs tracking-[0.2em] uppercase text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Скинути всі
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Mobile grid-density toggle — 1 vs 2 columns. Hidden on lg+
              where the responsive grid already handles density. */}
          <div className="lg:hidden inline-flex items-center rounded-full border border-[var(--color-border-strong)] p-1">
            <button
              type="button"
              onClick={() => setMobileCols(1)}
              aria-label="Одна колонка"
              aria-pressed={mobileCols === 1}
              className={cn(
                "grid h-8 w-8 place-items-center rounded-full transition-colors",
                mobileCols === 1
                  ? "bg-[var(--color-text-primary)] text-[var(--color-text-inverse)]"
                  : "text-[var(--color-text-muted)]",
              )}
            >
              <Square className="h-4 w-4" strokeWidth={1.8} />
            </button>
            <button
              type="button"
              onClick={() => setMobileCols(2)}
              aria-label="Дві колонки"
              aria-pressed={mobileCols === 2}
              className={cn(
                "grid h-8 w-8 place-items-center rounded-full transition-colors",
                mobileCols === 2
                  ? "bg-[var(--color-text-primary)] text-[var(--color-text-inverse)]"
                  : "text-[var(--color-text-muted)]",
              )}
            >
              <Grid2x2 className="h-4 w-4" strokeWidth={1.8} />
            </button>
          </div>

          {/* Sort */}
          <div className="relative">
          <button
            type="button"
            onClick={() => setSortOpen((o) => !o)}
            aria-expanded={sortOpen}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-strong)] px-4 py-2 text-sm hover:border-[var(--color-text-primary)] transition-colors"
          >
            <span className="text-[var(--color-text-muted)] hidden sm:inline">
              Сортувати:
            </span>
            <span>{SORT_OPTIONS.find((o) => o.key === sort)?.label}</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-300",
                sortOpen && "rotate-180",
              )}
            />
          </button>
          <AnimatePresence>
            {sortOpen && (
              <motion.ul
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: EASING.smooth }}
                className="absolute right-0 z-30 mt-2 min-w-[230px] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] shadow-lg"
              >
                {SORT_OPTIONS.map((opt) => {
                  const active = opt.key === sort;
                  return (
                    <li key={opt.key}>
                      <button
                        type="button"
                        onClick={() => {
                          setSort(opt.key);
                          setSortOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center justify-between px-4 py-2.5 text-sm transition-colors",
                          active
                            ? "bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
                            : "hover:bg-[var(--color-bg-secondary)]",
                        )}
                      >
                        <span>{opt.label}</span>
                        {active && (
                          <span className="block h-1.5 w-1.5 rounded-full bg-[var(--color-text-primary)]" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </motion.ul>
            )}
          </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="grid lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Desktop sidebar — sticks below the fixed header and scrolls
            independently of the page when the filter list outgrows the
            viewport. `overscroll-behavior: contain` prevents the inner
            scroll from chaining to the page once it reaches an edge.
            `data-lenis-prevent` opts this container out of the global
            Lenis smooth-scroll so wheel/trackpad events scroll natively
            instead of being eaten by the root smooth scroller. */}
        <aside className="hidden lg:block lg:col-span-3">
          <div
            data-lenis-prevent
            className="sticky top-28 max-h-[calc(100vh-9rem)] overflow-y-auto pr-2 -mr-2 [overscroll-behavior:contain]"
          >
            <FilterSidebar
              products={products}
              options={options}
              priceBounds={priceBounds}
              filters={filters}
              onChange={setFilters}
              onClear={resetFilters}
            />
          </div>
        </aside>

        {/* Grid */}
        <div className="lg:col-span-9">
          {filtered.length === 0 ? (
            <EmptyState onReset={resetFilters} />
          ) : (
            <div
              className={cn(
                "grid sm:grid-cols-2 xl:grid-cols-3 sm:gap-5 lg:gap-8",
                // Mobile density from the toggle. Tighter gap when 2-up
                // so the compact cards don't feel cramped.
                mobileCols === 2 ? "grid-cols-2 gap-3" : "grid-cols-1 gap-5",
              )}
            >
              {filtered.map((p) => (
                <ProductCard key={p.slug} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            aria-hidden
          />
        )}
        {drawerOpen && (
          <motion.div
            key="drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.4, ease: EASING.smooth }}
            className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-[var(--color-bg-primary)] flex flex-col lg:hidden"
            role="dialog"
            aria-label="Фільтри"
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-border-default)]">
              <span className="text-sm tracking-[0.2em] uppercase">Фільтри</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Закрити"
                className="grid h-10 w-10 place-items-center rounded-full hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div
              data-lenis-prevent
              className="flex-1 overflow-y-auto px-6 py-6"
            >
              <FilterSidebar
                products={products}
                options={options}
                priceBounds={priceBounds}
                filters={filters}
                onChange={setFilters}
                onClear={resetFilters}
              />
            </div>

            <div className="border-t border-[var(--color-border-default)] px-6 py-5 flex items-center gap-3">
              <button
                type="button"
                onClick={resetFilters}
                className="flex-1 rounded-full border border-[var(--color-border-strong)] py-3.5 text-sm hover:border-[var(--color-text-primary)] transition-colors"
              >
                Очистити
              </button>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="flex-[2] rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] py-3.5 text-sm hover:opacity-85 transition-opacity"
              >
                Показати {filtered.length}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Container>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-5 py-16 border-t border-[var(--color-border-default)]">
      <h3 className="font-display text-2xl lg:text-3xl font-semibold tracking-[-0.02em]">
        Нічого не знайшлося.
      </h3>
      <p className="text-[var(--color-text-secondary)] max-w-md leading-relaxed">
        За обраними фільтрами зараз немає доступної кави. Спробуй скинути — і
        подивитися усе, що ми обсмажуємо.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="inline-flex rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] px-7 py-3.5 text-sm hover:opacity-85 transition-opacity"
      >
        Скинути фільтри
      </button>
    </div>
  );
}

function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}
