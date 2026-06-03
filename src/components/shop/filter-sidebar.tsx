"use client";

import { Check } from "lucide-react";
import { useId } from "react";
import { cn, formatPrice } from "@/lib/utils";
import {
  CATEGORIES,
  getStartingPrice,
  type CategoryKey,
  type ProcessKind,
  type Product,
  type RoastProfile,
} from "@/data/products";
import {
  METER_LEVELS,
  PRICE_STEP,
  type ShopFilters,
} from "./filters-config";

interface FilterSidebarProps {
  /** Full catalogue — used to show per-option counts */
  products: Product[];
  options: {
    countries: string[];
    processes: ProcessKind[];
    roasts: RoastProfile[];
  };
  /** Absolute slider bounds, derived from the catalogue by the parent. */
  priceBounds: { min: number; max: number };
  filters: ShopFilters;
  onChange: (next: ShopFilters) => void;
  onClear: () => void;
}

/**
 * Filter sidebar — renders all filter groups.
 *
 * Groups:
 *  1. Країна походження (multi)
 *  2. Обробка (multi)
 *  3. Обсмажка (multi)
 *  4. Ціна (single bucket)
 *  5. В наявності (switch)
 *
 * Counts next to each option reflect how many products would be visible if
 * that option were selected (combined with all currently-active filters in
 * OTHER groups). This follows standard e-commerce behaviour — selecting one
 * country doesn't zero-out the others.
 */
export function FilterSidebar({
  products,
  options,
  priceBounds,
  filters,
  onChange,
  onClear,
}: FilterSidebarProps) {
  const activeCount =
    filters.categories.length +
    filters.countries.length +
    filters.processes.length +
    filters.roasts.length +
    filters.acidity.length +
    filters.sweetness.length +
    filters.bitterness.length +
    (filters.priceRange ? 1 : 0) +
    (filters.inStockOnly ? 1 : 0);

  const toggle = <K extends keyof ShopFilters>(
    key: K,
    value: ShopFilters[K] extends Array<infer U> ? U : never,
  ) => {
    const current = filters[key] as unknown as Array<typeof value>;
    const exists = current.includes(value);
    const next = exists
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange({ ...filters, [key]: next });
  };

  /**
   * How many products match when we pretend `candidate` is added to group
   * `key`. Used to render counts — greys out an option that would produce 0.
   */
  const countFor = <K extends keyof Omit<ShopFilters, "inStockOnly" | "priceBucket">>(
    key: K,
    candidate: string,
  ): number => {
    return products.filter((p) => {
      // Apply filters from OTHER groups (not the current one).
      if (
        key !== "categories" &&
        filters.categories.length &&
        !filters.categories.includes(p.category)
      )
        return false;
      if (key !== "countries" && filters.countries.length) {
        if (!p.country || !filters.countries.includes(p.country)) return false;
      }
      if (key !== "processes" && filters.processes.length) {
        if (!p.process || !filters.processes.includes(p.process)) return false;
      }
      if (key !== "roasts" && filters.roasts.length) {
        if (!p.roasts || !p.roasts.some((r) => filters.roasts.includes(r)))
          return false;
      }
      // Meter filters always apply — they aren't keyed in countFor since we
      // don't render counts on meter pills, but they still narrow which
      // products contribute to other-group counts.
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

      // Own group — candidate must match this product.
      switch (key) {
        case "categories":
          return p.category === (candidate as CategoryKey);
        case "countries":
          return p.country === candidate;
        case "processes":
          return p.process === (candidate as ProcessKind);
        case "roasts":
          return p.roasts?.includes(candidate as RoastProfile) ?? false;
        default:
          return false;
      }
    }).length;
  };

  return (
    <div className="flex flex-col gap-9">
      {/* Sidebar header */}
      <div className="flex items-baseline justify-between">
        <h2 className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]">
          Фільтри
        </h2>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] tracking-[0.2em] uppercase text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            Скинути ({activeCount})
          </button>
        )}
      </div>

      {/* Category — primary product-type axis. Sits above everything else
          so it visually reads as the most important filter. */}
      <FilterGroup title="Категорія">
        <ul className="flex flex-col gap-1">
          {CATEGORIES.map((c) => (
            <li key={c.key}>
              <CheckRow
                active={filters.categories.includes(c.key)}
                count={countFor("categories", c.key)}
                onClick={() => toggle("categories", c.key)}
              >
                {c.label}
              </CheckRow>
            </li>
          ))}
        </ul>
      </FilterGroup>

      {/* Country */}
      <FilterGroup title="Країна">
        <ul className="flex flex-col gap-1">
          {options.countries.map((c) => {
            const active = filters.countries.includes(c);
            const count = countFor("countries", c);
            if (!active && count === 0) return null;
            return (
              <li key={c}>
                <CheckRow
                  active={active}
                  count={count}
                  onClick={() => toggle("countries", c)}
                >
                  {c}
                </CheckRow>
              </li>
            );
          })}
        </ul>
      </FilterGroup>

      {/* Process */}
      <FilterGroup title="Обробка">
        <ul className="flex flex-col gap-1">
          {options.processes.map((p) => {
            const active = filters.processes.includes(p);
            const count = countFor("processes", p);
            if (!active && count === 0) return null;
            return (
              <li key={p}>
                <CheckRow
                  active={active}
                  count={count}
                  onClick={() => toggle("processes", p)}
                >
                  {p}
                </CheckRow>
              </li>
            );
          })}
        </ul>
      </FilterGroup>

      {/* Roast */}
      <FilterGroup title="Обсмажка">
        <ul className="flex flex-col gap-1">
          {options.roasts.map((r) => {
            const active = filters.roasts.includes(r);
            const count = countFor("roasts", r);
            if (!active && count === 0) return null;
            return (
              <li key={r}>
                <CheckRow
                  active={active}
                  count={count}
                  onClick={() => toggle("roasts", r)}
                >
                  {r}
                </CheckRow>
              </li>
            );
          })}
        </ul>
      </FilterGroup>

      {/* Taste profile — three multi-select pill rows on a 1-5 scale.
          Picking any value implicitly excludes non-coffee SKUs (gear /
          gifts / grinders don't have meters). */}
      <FilterGroup title="Кислотність">
        <MeterPills
          values={filters.acidity}
          onChange={(next) => onChange({ ...filters, acidity: next })}
        />
      </FilterGroup>
      <FilterGroup title="Солодкість">
        <MeterPills
          values={filters.sweetness}
          onChange={(next) => onChange({ ...filters, sweetness: next })}
        />
      </FilterGroup>
      <FilterGroup title="Гіркота">
        <MeterPills
          values={filters.bitterness}
          onChange={(next) => onChange({ ...filters, bitterness: next })}
        />
      </FilterGroup>

      {/* Price — dual-thumb range slider. Bounds come from the parent
          (derived from the catalogue), value is null when at the full
          range so the active-filter count doesn't tick up on idle. */}
      <FilterGroup title="Ціна">
        <PriceRangeSlider
          bounds={priceBounds}
          value={filters.priceRange}
          onChange={(next) => onChange({ ...filters, priceRange: next })}
        />
      </FilterGroup>

      {/* In-stock toggle. Native-style switch:
            - Thumb is pure white (not bg-primary) so it has contrast against
              both the off track (beige) and the on track (dark brown).
            - Position is driven by `left` rather than `translate-x` — keeps
              it independent of any framer-motion transform stacking on the
              same element and makes the resting offsets more predictable. */}
      <FilterGroup title="Наявність">
        <button
          type="button"
          onClick={() =>
            onChange({ ...filters, inStockOnly: !filters.inStockOnly })
          }
          aria-pressed={filters.inStockOnly}
          className="flex items-center gap-3 text-sm"
        >
          <span
            className={cn(
              "relative block h-6 w-11 rounded-full transition-colors duration-300",
              filters.inStockOnly
                ? "bg-[var(--color-text-primary)]"
                : "bg-[var(--color-border-strong)]",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.18)] transition-[left] duration-300",
                filters.inStockOnly ? "left-[22px]" : "left-0.5",
              )}
            />
          </span>
          <span className="text-[var(--color-text-primary)]">
            Тільки в наявності
          </span>
        </button>
      </FilterGroup>
    </div>
  );
}

interface MeterPillsProps {
  values: number[];
  onChange: (next: number[]) => void;
}

/**
 * Five-pill row for a 1-5 taste-meter dimension. Multi-select: tap each pill
 * to toggle it. Picking {3,4,5} reads as "show me bright/sweet/bitter
 * coffees", picking {1,2} reads as "show me low / mild". Counts are
 * deliberately omitted to keep the row compact — for three meters that's
 * three 5-pill rows in the sidebar, and number badges next to every pill
 * makes it feel busy fast.
 */
function MeterPills({ values, onChange }: MeterPillsProps) {
  const toggle = (n: number) => {
    if (values.includes(n)) {
      onChange(values.filter((v) => v !== n));
    } else {
      // Keep the array sorted so saved/restored state is canonical and
      // doesn't churn referentially when the user re-selects.
      onChange([...values, n].sort((a, b) => a - b));
    }
  };

  return (
    <div className="flex gap-2">
      {METER_LEVELS.map((n) => {
        const active = values.includes(n);
        return (
          <button
            key={n}
            type="button"
            onClick={() => toggle(n)}
            aria-pressed={active}
            className={cn(
              "h-9 w-9 rounded-full font-display text-sm font-medium tabular-nums transition-all duration-300",
              active
                ? "bg-[var(--color-text-primary)] text-[var(--color-text-inverse)]"
                : "border border-[var(--color-border-strong)] text-[var(--color-text-primary)] hover:border-[var(--color-text-primary)]",
            )}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

interface PriceRangeSliderProps {
  bounds: { min: number; max: number };
  value: [number, number] | null;
  onChange: (next: [number, number] | null) => void;
}

/**
 * Dual-thumb range slider built on two stacked native `<input type="range">`.
 *
 * Why native inputs instead of pointer-events from scratch:
 *   - free keyboard handling, screen reader hints, touch behaviour
 *   - no extra dependency for a single use site
 *
 * The two inputs occupy the same track (absolute, full-bleed). Their tracks
 * are made transparent so only the thumbs are visible; a separate <div>
 * renders the rail + active fill between the thumbs. Pointer events on the
 * inputs are disabled at the input level and re-enabled only on the thumb
 * pseudo-element, so empty parts of the track don't intercept clicks.
 *
 * When the range matches `[bounds.min, bounds.max]` exactly we pass `null`
 * to the parent — that way the catalog's "active filter" pill doesn't show
 * a price chip when nothing has actually been narrowed down.
 */
function PriceRangeSlider({ bounds, value, onChange }: PriceRangeSliderProps) {
  const labelMinId = useId();
  const labelMaxId = useId();
  const { min: absMin, max: absMax } = bounds;
  const span = Math.max(1, absMax - absMin);

  // Resolve current values — fall back to absolute bounds when no range
  // has been picked yet.
  const lo = value?.[0] ?? absMin;
  const hi = value?.[1] ?? absMax;
  const loPct = ((lo - absMin) / span) * 100;
  const hiPct = ((hi - absMin) / span) * 100;

  const commit = (nextLo: number, nextHi: number) => {
    // Snap-to-bounds — if the user has dragged both ends to the extremes,
    // treat that as "no filter" so the chip count stays accurate.
    if (nextLo <= absMin && nextHi >= absMax) {
      onChange(null);
      return;
    }
    onChange([nextLo, nextHi]);
  };

  const handleMin = (raw: number) => {
    // Keep min strictly below max with at least one PRICE_STEP gap, otherwise
    // the thumbs lock together and become un-grabbable.
    const next = Math.min(raw, hi - PRICE_STEP);
    commit(Math.max(absMin, next), hi);
  };
  const handleMax = (raw: number) => {
    const next = Math.max(raw, lo + PRICE_STEP);
    commit(lo, Math.min(absMax, next));
  };

  return (
    <div className="flex flex-col gap-4 pt-1">
      {/* Numeric readout — the slider has no built-in tick labels, so the
          UAH amounts up top do that job. tabular-nums keeps digit widths
          stable while dragging. */}
      <div className="flex items-baseline justify-between font-display text-sm tabular-nums">
        <span>{formatPrice(lo)}</span>
        <span className="text-[var(--color-text-muted)]">{formatPrice(hi)}</span>
      </div>

      {/* Track + thumbs. Outer div sets the click target height (24px) so
          the thumbs are easy to grab without making the visual rail thick. */}
      <div className="relative h-6">
        {/* Inactive rail */}
        <div
          aria-hidden
          className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-[var(--color-border-strong)]"
        />
        {/* Active fill between the thumbs */}
        <div
          aria-hidden
          className="absolute top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-[var(--color-text-primary)]"
          style={{ left: `${loPct}%`, right: `${100 - hiPct}%` }}
        />

        <input
          id={labelMinId}
          type="range"
          min={absMin}
          max={absMax}
          step={PRICE_STEP}
          value={lo}
          onChange={(e) => handleMin(Number(e.target.value))}
          aria-label="Мінімальна ціна"
          className="batch-range-input"
        />
        <input
          id={labelMaxId}
          type="range"
          min={absMin}
          max={absMax}
          step={PRICE_STEP}
          value={hi}
          onChange={(e) => handleMax(Number(e.target.value))}
          aria-label="Максимальна ціна"
          className="batch-range-input"
        />
      </div>

      {/* Range bounds — fine print so the user knows the slider's full span
          without having to drag to either end. */}
      <div className="flex items-baseline justify-between text-[10px] tracking-[0.18em] uppercase text-[var(--color-text-muted)]">
        <span>{formatPrice(absMin)}</span>
        <span>{formatPrice(absMax)}</span>
      </div>
    </div>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="font-display text-sm font-semibold tracking-wide mb-4">
        {title}
      </h3>
      {children}
    </section>
  );
}

interface CheckRowProps {
  active: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}

function CheckRow({ active, count, onClick, children }: CheckRowProps) {
  const disabled = !active && count === 0;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "group flex w-full items-start justify-between gap-3 py-1.5 text-left text-sm transition-opacity",
        disabled && "opacity-40 cursor-not-allowed",
      )}
    >
      <span className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className={cn(
            "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors",
            active
              ? "bg-[var(--color-text-primary)] border-[var(--color-text-primary)] text-[var(--color-text-inverse)]"
              : "border-[var(--color-border-strong)] group-hover:border-[var(--color-text-primary)]",
          )}
        >
          {active && <Check className="h-3 w-3" strokeWidth={3} />}
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 break-words leading-snug transition-colors",
            active
              ? "text-[var(--color-text-primary)]"
              : "text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]",
          )}
        >
          {children}
        </span>
      </span>
      <span className="mt-0.5 shrink-0 text-[11px] tabular-nums text-[var(--color-text-muted)]">
        {count}
      </span>
    </button>
  );
}
