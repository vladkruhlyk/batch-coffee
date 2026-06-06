"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  CornerDownLeft,
  Search as SearchIcon,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { EASING } from "@/lib/easing";
import { useSearch } from "@/lib/search-store";
import { cn, formatPrice } from "@/lib/utils";
import { CATEGORIES, getStartingPrice, type Product } from "@/data/products";
import { client as sanityClient } from "@/sanity/lib/client";
import { adaptProduct, type SanityProduct } from "@/sanity/lib/adapters";
import { PRODUCTS_QUERY } from "@/sanity/queries";

/**
 * Cmd+K-style full-screen search overlay.
 *
 * UX notes:
 *  - Backdrop uses `backdrop-blur-xl` for depth, panel floats ~10vh from top
 *    (not dead-center — feels lighter, aligns with modern search UIs like
 *    Linear / Vercel).
 *  - Input auto-focuses on open. Escape closes. Arrow ↑ / ↓ cycle results,
 *    Enter navigates to the highlighted result.
 *  - Results list uses AnimatePresence + layout transitions for a buttery
 *    re-rank as the query changes.
 *  - When the query is empty, shows category quick-links + a small "popular"
 *    strip (bestsellers) so the surface never feels dead.
 *
 * Cmd+K (or Ctrl+K) toggles from anywhere on the page — handled in
 * {@link SearchHotkeys} which is mounted alongside this component.
 */
export function SearchOverlay() {
  const open = useSearch((s) => s.open);
  const closeSearch = useSearch((s) => s.closeSearch);

  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  // Track highlighted item by slug, not index — makes the "active" anchor
  // stable when results re-rank, and sidesteps the need for an effect to
  // clamp a stale index when results shrink.
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  // All products — fetched from Sanity (the live catalogue), not the
  // hardcoded demo data. Loaded lazily the first time the overlay opens
  // and cached for the session. Without this the search would only ever
  // surface the old seed products, never anything added in Studio.
  const [products, setProducts] = useState<Product[]>([]);
  const fetchedRef = useRef(false);
  useEffect(() => {
    if (!open || fetchedRef.current) return;
    fetchedRef.current = true;
    sanityClient
      .fetch<SanityProduct[]>(PRODUCTS_QUERY)
      .then((raw) => setProducts(raw.map(adaptProduct)))
      .catch(() => {
        // Search just stays empty on a fetch failure — no crash.
        fetchedRef.current = false;
      });
  }, [open]);

  // Filter + score products by query.
  const results = useMemo(() => {
    return filterProducts(products, query);
  }, [products, query]);

  // Derived highlight index. Falls back to 0 (the first result) when the
  // tracked slug is no longer present — no setState-in-effect needed.
  const activeIndex = (() => {
    if (!activeSlug) return 0;
    const found = results.findIndex((p) => p.slug === activeSlug);
    return found === -1 ? 0 : found;
  })();

  // Reset state whenever the overlay closes.
  useEffect(() => {
    if (!open) {
      // Small delay lets the exit animation finish before the text jumps.
      const t = setTimeout(() => {
        setQuery("");
        setActiveSlug(null);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Focus the input when we open.
  useEffect(() => {
    if (!open) return;
    // next frame — let the element mount first.
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Safety-net: auto-close on any route change. Most overlay links already
  // call `closeSearch` via onPick, but any future Link added inside the
  // overlay would otherwise leave it stuck open after navigation.
  const pathname = usePathname();
  const prevPath = useRef(pathname);
  useEffect(() => {
    if (prevPath.current !== pathname) {
      prevPath.current = pathname;
      if (open) closeSearch();
    }
  }, [pathname, open, closeSearch]);

  // Keyboard — ↑/↓/Enter/Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeSearch();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (results.length === 0) return;
        const next = results[(activeIndex + 1) % results.length];
        setActiveSlug(next.slug);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (results.length === 0) return;
        const next =
          results[(activeIndex - 1 + results.length) % results.length];
        setActiveSlug(next.slug);
        return;
      }
      if (e.key === "Enter") {
        const pick = results[activeIndex];
        if (pick) {
          e.preventDefault();
          closeSearch();
          // Soft-nav via location — we don't have the router instance in this
          // closure and keeping overlay framework-agnostic keeps it portable.
          window.location.href = `/shop/${pick.slug}`;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, activeIndex, closeSearch]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="search-root"
          className="fixed inset-0 z-[130] flex items-start justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Пошук"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: EASING.smooth }}
            onClick={closeSearch}
            className="absolute inset-0 bg-[var(--color-text-primary)]/55 backdrop-blur-xl"
            aria-hidden
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: -24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.97 }}
            transition={{ duration: 0.5, ease: EASING.expoOut }}
            className="relative mt-[8vh] w-[min(720px,94vw)] overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] shadow-2xl"
          >
            {/* Input row */}
            <div className="flex items-center gap-3 border-b border-[var(--color-border-default)] px-5 py-4 lg:px-6">
              <SearchIcon
                className="h-5 w-5 shrink-0 text-[var(--color-text-muted)]"
                strokeWidth={1.5}
              />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Знайти каву, країну, смак…"
                // `focus-visible:outline-none` is required: the global
                // `:focus-visible` rule in globals.css adds a 2px outline
                // around any focused element, and plain `outline-none`
                // doesn't override the pseudo-class selector.
                className="flex-1 bg-transparent font-display text-lg lg:text-xl outline-none focus:outline-none focus-visible:outline-none placeholder:text-[var(--color-text-muted)]"
                autoComplete="off"
                spellCheck={false}
                aria-label="Пошуковий запит"
              />
              <kbd className="hidden sm:inline-flex items-center rounded-md border border-[var(--color-border-default)] px-2 py-1 text-[10px] font-medium tracking-wider text-[var(--color-text-muted)]">
                ESC
              </kbd>
              <button
                type="button"
                onClick={closeSearch}
                aria-label="Закрити пошук"
                className="sm:hidden grid h-9 w-9 place-items-center rounded-full hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>

            {/* Body */}
            <div className="max-h-[min(60vh,560px)] overflow-y-auto p-3 lg:p-4">
              {query.trim() === "" ? (
                <EmptyState onPick={closeSearch} />
              ) : results.length === 0 ? (
                <NoResults query={query} />
              ) : (
                <ul className="flex flex-col gap-1">
                  <AnimatePresence initial={false}>
                    {results.map((product, i) => (
                      <motion.li
                        key={product.slug}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25, ease: EASING.smooth }}
                      >
                        <ResultRow
                          product={product}
                          active={i === activeIndex}
                          onHover={() => setActiveSlug(product.slug)}
                          onPick={closeSearch}
                          query={query}
                        />
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>

            {/* Footer hints */}
            <div className="hidden md:flex items-center justify-between gap-4 border-t border-[var(--color-border-default)] px-5 py-3 text-[11px] tracking-wide text-[var(--color-text-muted)]">
              <div className="flex items-center gap-4">
                <span className="inline-flex items-center gap-1.5">
                  <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-[var(--color-border-default)] px-1 text-[10px]">
                    ↑
                  </kbd>
                  <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-[var(--color-border-default)] px-1 text-[10px]">
                    ↓
                  </kbd>
                  навігація
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <kbd className="inline-flex h-5 items-center justify-center rounded border border-[var(--color-border-default)] px-1.5 text-[10px]">
                    <CornerDownLeft className="h-3 w-3" strokeWidth={1.8} />
                  </kbd>
                  обрати
                </span>
              </div>
              <span className="uppercase tracking-[0.2em]">BATCH search</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/*  Hotkey mount — toggles overlay on Cmd+K / Ctrl+K / `/`             */
/* ------------------------------------------------------------------ */

/**
 * Listens globally for the Cmd/Ctrl+K chord and toggles the search overlay.
 * Separate component so it can be mounted as a sibling without coupling to
 * SearchOverlay's own effect wiring.
 */
export function SearchHotkeys() {
  const toggleSearch = useSearch((s) => s.toggleSearch);
  const open = useSearch((s) => s.open);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggleSearch();
        return;
      }
      // `/` opens search as long as the user isn't already typing somewhere.
      if (
        !open &&
        e.key === "/" &&
        !isTypingTarget(e.target)
      ) {
        e.preventDefault();
        toggleSearch();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleSearch, open]);

  return null;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

interface ResultRowProps {
  product: Product;
  active: boolean;
  query: string;
  onHover: () => void;
  onPick: () => void;
}

function ResultRow({ product, active, query, onHover, onPick }: ResultRowProps) {
  const price = getStartingPrice(product);
  const categoryLabel =
    CATEGORIES.find((c) => c.key === product.category)?.label ?? product.category;

  // Short descriptor beneath the name — tasting notes if coffee, otherwise
  // the short description.
  const descriptor = product.notes?.length
    ? product.notes.join(", ")
    : product.shortDescription;

  return (
    <Link
      href={`/shop/${product.slug}`}
      onClick={onPick}
      onMouseEnter={onHover}
      onFocus={onHover}
      aria-current={active ? "true" : undefined}
      className={cn(
        "group flex items-center gap-4 rounded-[var(--radius-lg)] p-3 transition-colors",
        active
          ? "bg-[var(--color-bg-secondary)]"
          : "hover:bg-[var(--color-bg-secondary)]/60",
      )}
    >
      {/* Thumb */}
      <span
        aria-hidden
        className="h-12 w-12 shrink-0 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: product.gallery[0] }}
      />

      {/* Text */}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-baseline gap-2">
          <span className="font-display text-[15px] font-semibold leading-snug tracking-[-0.01em] text-[var(--color-text-primary)]">
            <Highlight text={product.name} query={query} />
          </span>
          <span className="text-[10px] tracking-[0.22em] uppercase text-[var(--color-text-muted)]">
            {categoryLabel}
          </span>
        </span>
        <span className="truncate text-xs text-[var(--color-text-secondary)]">
          {descriptor}
        </span>
      </span>

      {/* Price + arrow */}
      <span className="flex items-center gap-3">
        <span className="font-display text-sm font-semibold tabular-nums tracking-tight text-[var(--color-text-primary)]">
          {formatPrice(price)}
        </span>
        <ArrowUpRight
          className={cn(
            "h-4 w-4 transition-all",
            active
              ? "translate-x-0.5 -translate-y-0.5 text-[var(--color-text-primary)]"
              : "text-[var(--color-text-muted)]",
          )}
          strokeWidth={1.6}
        />
      </span>
    </Link>
  );
}

function EmptyState({ onPick }: { onPick: () => void }) {
  return (
    <div className="p-3">
      <p className="px-2 pb-3 text-[11px] tracking-[0.22em] uppercase text-[var(--color-text-muted)]">
        Категорії
      </p>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {CATEGORIES.map((c) => (
          <li key={c.key}>
            <Link
              href={`/shop?category=${c.key}`}
              onClick={onPick}
              className="flex items-center justify-between gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border-default)] px-3 py-2.5 text-sm transition-colors hover:border-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]"
            >
              <span>{c.label}</span>
              <ArrowUpRight
                className="h-3.5 w-3.5 text-[var(--color-text-muted)]"
                strokeWidth={1.5}
              />
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-5 px-2 text-xs text-[var(--color-text-muted)]">
        Почніть вводити назву, країну або смак — наприклад, «ефіопія», «мед»,
        «еспресо».
      </p>
    </div>
  );
}

function NoResults({ query }: { query: string }) {
  return (
    <div className="px-4 py-14 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--color-bg-secondary)]">
        <SearchIcon className="h-6 w-6 text-[var(--color-text-muted)]" strokeWidth={1.4} />
      </div>
      <p className="mt-4 font-display text-lg font-semibold tracking-tight">
        Нічого не знайшли для «{query}»
      </p>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        Спробуйте іншу назву, країну або смакову ноту.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Highlight + filter helpers                                         */
/* ------------------------------------------------------------------ */

/** Case-insensitive substring highlight. Splits on the first occurrence. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase();
  if (!q) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="bg-[var(--color-text-primary)]/10 text-[var(--color-text-primary)]">
        {text.slice(idx, idx + q.length)}
      </span>
      {text.slice(idx + q.length)}
    </>
  );
}

/**
 * Quick-and-dirty scorer: exact name prefix > name substring > notes >
 * country / region > short description. No fuzzy matching yet — products
 * aren't big enough to warrant it.
 */
function filterProducts(products: Product[], rawQuery: string): Product[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return [];

  const scored: Array<{ product: Product; score: number }> = [];
  for (const p of products) {
    const name = p.name.toLowerCase();
    const bag = [
      p.origin ?? "",
      p.country ?? "",
      p.region ?? "",
      p.shortDescription,
      (p.notes ?? []).join(" "),
      p.category,
    ]
      .join(" ")
      .toLowerCase();

    let score = 0;
    if (name.startsWith(q)) score += 100;
    if (name.includes(q)) score += 40;
    if ((p.notes ?? []).some((n) => n.toLowerCase().includes(q))) score += 30;
    if ((p.country ?? "").toLowerCase().includes(q)) score += 20;
    if (bag.includes(q)) score += 5;

    if (score > 0) scored.push({ product: p, score });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((s) => s.product);
}
