"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Container } from "@/components/layout/container";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { SectionKicker } from "@/components/layout/section-kicker";
import { TasteMeters } from "@/components/shop/taste-meters";
import { isCoffeeCategory, type Product } from "@/data/products";
import { client as sanityClient } from "@/sanity/lib/client";
import { adaptProduct, type SanityProduct } from "@/sanity/lib/adapters";
import { PRODUCTS_QUERY } from "@/sanity/queries";
import { formatPrice, cn } from "@/lib/utils";
import { EASING } from "@/lib/easing";

const MAX_COMPARE = 3;

/**
 * Compare tool — pick up to 3 coffee SKUs and view them side-by-side.
 *
 * Side-by-side view shows: thumbnail, name, taste profile chart, weights
 * starting price, origin, process, roast, recommended brewing method.
 * Mobile: cards stack vertically; desktop: 3-column grid.
 */
export default function ComparePage() {
  // Pull the live catalogue from Sanity (same source as shop + search),
  // not the static seed array — otherwise newly published products never
  // show up here. Filtered to coffee categories + products with weights.
  const [products, setProducts] = useState<Product[]>([]);
  const fetchedRef = useRef(false);
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    sanityClient
      .fetch<SanityProduct[]>(PRODUCTS_QUERY)
      .then((raw) =>
        setProducts(
          raw
            .map(adaptProduct)
            .filter((p) => p.weights && p.weights.length > 0),
        ),
      )
      .catch(() => {
        fetchedRef.current = false;
      });
  }, []);

  const candidates = useMemo(
    () => products.filter((p) => isCoffeeCategory(p.category)),
    [products],
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const items = selected
    .map((slug) => candidates.find((p) => p.slug === slug))
    .filter((p): p is Product => p !== undefined);

  const add = (slug: string) => {
    setSelected((prev) =>
      prev.includes(slug)
        ? prev
        : [...prev, slug].slice(0, MAX_COMPARE),
    );
    setPickerOpen(false);
  };
  const remove = (slug: string) =>
    setSelected((prev) => prev.filter((s) => s !== slug));

  return (
    <>
      <Header />
      <main className="flex-1">
        <Container size="wide" className="pt-28 lg:pt-36 pb-[var(--section-gap)]">
          {/* Hero */}
          <header className="grid lg:grid-cols-12 gap-8 mb-16 lg:mb-20">
            <div className="lg:col-span-8">
              <SectionKicker label="Порівняння кав" />
              <h1 className="font-display font-semibold text-[clamp(2rem,4.5vw,4rem)] leading-[1.02] tracking-[-0.04em] mt-10">
                Не знаєш, з чого почати?
                <span className="block text-[var(--color-text-secondary)] font-medium">
                  Порівняй смаком.
                </span>
              </h1>
            </div>
            <div className="lg:col-span-4 lg:col-start-9 lg:pt-6">
              <p className="text-[var(--color-text-secondary)] leading-relaxed">
                Обери до трьох сортів — побачиш смакові профілі, обробку,
                рекомендовані методи й ціни поруч. Менше колупання, швидше
                рішення.
              </p>
            </div>
          </header>

          {/* Slot grid — up to 3 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-7">
            {Array.from({ length: MAX_COMPARE }).map((_, i) => {
              const item = items[i];
              if (item) {
                return (
                  <CompareCard
                    key={item.slug}
                    product={item}
                    onRemove={() => remove(item.slug)}
                  />
                );
              }
              return (
                <EmptySlot
                  key={`slot-${i}`}
                  onClick={() => setPickerOpen(true)}
                />
              );
            })}
          </div>

          {/* Picker drawer — full-screen on mobile, modal-ish on desktop */}
          <AnimatePresence>
            {pickerOpen && (
              <motion.div
                key="overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm"
                onClick={() => setPickerOpen(false)}
              />
            )}
            {pickerOpen && (
              <motion.div
                key="picker"
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 30, opacity: 0 }}
                transition={{ duration: 0.35, ease: EASING.smooth }}
                className="fixed inset-x-3 bottom-3 lg:inset-x-auto lg:left-1/2 lg:bottom-auto lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-[640px] z-50 rounded-[var(--radius-2xl)] bg-[var(--color-bg-primary)] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.35)] max-h-[80vh] flex flex-col"
              >
                <header className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-border-default)]">
                  <span className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]">
                    Обрати товар
                  </span>
                  <button
                    type="button"
                    onClick={() => setPickerOpen(false)}
                    aria-label="Закрити"
                    className="grid h-9 w-9 place-items-center rounded-full hover:bg-[var(--color-bg-secondary)] transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </header>
                <ul className="flex-1 overflow-y-auto p-3">
                  {candidates.map((p) => {
                    const already = selected.includes(p.slug);
                    return (
                      <li key={p.slug}>
                        <button
                          type="button"
                          disabled={already}
                          onClick={() => add(p.slug)}
                          className={cn(
                            "w-full flex items-center gap-4 rounded-[var(--radius-lg)] p-3 text-left transition-colors",
                            already
                              ? "opacity-50 cursor-not-allowed"
                              : "hover:bg-[var(--color-bg-secondary)]",
                          )}
                        >
                          <span
                            aria-hidden
                            className="block h-12 w-12 shrink-0 rounded-[var(--radius-md)]"
                            style={{ backgroundImage: p.gallery[0] }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-display text-base font-semibold leading-tight">
                              {p.name}
                            </p>
                            <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">
                              {p.origin ?? p.shortDescription}
                            </p>
                          </div>
                          {already && (
                            <span className="text-[10px] tracking-[0.25em] uppercase text-[var(--color-text-muted)]">
                              Обрано
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </Container>
      </main>
      <Footer />
    </>
  );
}

function CompareCard({
  product,
  onRemove,
}: {
  product: Product;
  onRemove: () => void;
}) {
  const startingPrice = Math.min(...product.weights.map((w) => w.price));
  return (
    <article className="relative flex flex-col rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] overflow-hidden">
      <button
        type="button"
        onClick={onRemove}
        aria-label="Прибрати з порівняння"
        className="absolute top-3 right-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-[var(--color-bg-primary)]/90 backdrop-blur-sm hover:bg-[var(--color-bg-primary)] transition-colors"
      >
        <X className="h-4 w-4" />
      </button>

      <Link
        href={`/shop/${product.slug}`}
        className="block aspect-square overflow-hidden bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: product.gallery[0] }}
        aria-label={product.name}
      />

      <div className="flex flex-col flex-1 p-5 lg:p-6 gap-5">
        <div>
          <Link
            href={`/shop/${product.slug}`}
            className="font-display text-xl font-semibold tracking-[-0.02em] hover:opacity-70 transition-opacity"
          >
            {product.name}
          </Link>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {product.origin ?? product.shortDescription}
          </p>
        </div>

        {product.meters && (
          <TasteMeters meters={product.meters} variant="bar-compact" />
        )}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm pt-4 border-t border-[var(--color-border-default)]">
          <Row label="Обробка" value={product.process ?? "—"} />
          <Row label="Обсмажка" value={product.roasts?.join(", ") ?? "—"} />
          <Row
            label="Метод"
            value={product.brewing?.[0]?.method ?? "—"}
          />
          <Row label="Висота" value={product.altitude ?? "—"} />
        </dl>

        <div className="mt-auto pt-4 border-t border-[var(--color-border-default)] flex items-baseline justify-between">
          <span className="text-[10px] tracking-[0.22em] uppercase text-[var(--color-text-muted)]">
            Від
          </span>
          <span className="font-display text-2xl font-semibold tabular-nums">
            {formatPrice(startingPrice)}
          </span>
        </div>

        <Link
          href={`/shop/${product.slug}`}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] px-5 py-3 text-sm tracking-[0.12em] uppercase hover:opacity-85 transition-opacity"
        >
          На сторінку товару
        </Link>
      </div>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] tracking-[0.22em] uppercase text-[var(--color-text-muted)]">
        {label}
      </dt>
      <dd className="mt-1 font-medium text-sm truncate">{value}</dd>
    </div>
  );
}

function EmptySlot({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center justify-center gap-5 min-h-[400px] lg:min-h-[600px] rounded-[var(--radius-xl)] border-2 border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-primary)] p-6 hover:border-[var(--color-text-primary)] transition-colors"
    >
      <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] group-hover:bg-[var(--color-text-primary)] group-hover:text-[var(--color-text-inverse)] transition-colors">
        <Plus className="h-5 w-5" />
      </span>
      <p className="font-display text-lg font-semibold text-center">
        Додати каву
      </p>
      <p className="text-sm text-[var(--color-text-secondary)] text-center max-w-[14ch]">
        Обери сорт з каталогу
      </p>
    </button>
  );
}
