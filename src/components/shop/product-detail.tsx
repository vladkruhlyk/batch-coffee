"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
} from "lucide-react";
import { useRef, useState } from "react";
import { Container } from "@/components/layout/container";
import { TasteMeters } from "@/components/shop/taste-meters";
import { BrewingRecipe } from "@/components/shop/brewing-recipe";
import { OriginPanel } from "@/components/shop/origin-panel";
import { QuantityStepper } from "@/components/shop/quantity-stepper";
import { StickyMobileCTA } from "@/components/shop/sticky-mobile-cta";
import { Button } from "@/components/ui/button";
import { formatPrice, cn } from "@/lib/utils";
import { EASING } from "@/lib/easing";
import { useAddToCart } from "@/lib/use-add-to-cart";
import {
  getWholesalePerKg,
  WHOLESALE_MIN_KG,
  WHOLESALE_DISCOUNT_PERCENT,
} from "@/lib/wholesale";
import type { GrindOption, Product } from "@/data/products";

interface ProductDetailProps {
  product: Product;
}

/**
 * Product detail client component — handles gallery, variation selection,
 * grind, quantity, and add-to-cart intent. Cart wiring is stubbed for now
 * (console.info) — will hook into the cart store once that lands.
 */
export function ProductDetail({ product }: ProductDetailProps) {
  const [weightIndex, setWeightIndex] = useState(0);
  const [roastIndex, setRoastIndex] = useState(0);
  // Drip packs and capsules are pre-portioned — grinds is absent. Fall back
  // to "Не молоти" so the cart payload still type-checks.
  const [grind, setGrind] = useState<GrindOption>(
    product.grinds?.[0] ?? "Не молоти",
  );
  const [quantity, setQuantity] = useState(1);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [grindOpen, setGrindOpen] = useState(false);
  // Watched by the mobile sticky CTA — when this CTA scrolls out of view
  // we pop the sticky bar in. Refs the wrapping <Button>, which is a
  // forwardRef accepting either `button` or `a`.
  const primaryCtaRef = useRef<HTMLButtonElement | HTMLAnchorElement | null>(
    null,
  );
  const addToCart = useAddToCart();

  const activeWeight = product.weights[weightIndex];
  const activeRoast = product.roasts?.[roastIndex];
  const hasRoasts = (product.roasts?.length ?? 0) > 0;
  const retailTotal = activeWeight.price * quantity;

  // Wholesale derived state — same logic as the product card. When
  // weight × qty crosses 3kg on a kilo-pack SKU, the customer gets the
  // wholesale per-kilo rate and the headline price drops accordingly.
  const wholesalePerKg = getWholesalePerKg(product);
  const currentKg = (activeWeight.grams * quantity) / 1000;
  const wholesaleActive =
    wholesalePerKg !== null && currentKg >= WHOLESALE_MIN_KG;
  const wholesaleTotal = wholesaleActive
    ? Math.round(wholesalePerKg! * currentKg)
    : null;
  const totalPrice = wholesaleTotal ?? retailTotal;
  const wholesaleSavings = wholesaleTotal ? retailTotal - wholesaleTotal : 0;
  // How much more weight the user needs to add to unlock the discount.
  // Only computed when wholesale is available and not yet active.
  const kgToWholesale =
    wholesalePerKg && !wholesaleActive
      ? WHOLESALE_MIN_KG - currentKg
      : 0;

  const handleAddToCart = (e: React.MouseEvent<HTMLButtonElement>) => {
    addToCart(
      product,
      {
        weightIndex,
        roast: activeRoast,
        // Only pass grind when the product actually offers it — avoids
        // polluting the line-item id with "Не молоти" for drip/capsules.
        grind: product.grinds ? grind : undefined,
        quantity,
      },
      e,
    );
  };

  const prevSlide = () =>
    setGalleryIndex((i) => (i - 1 + product.gallery.length) % product.gallery.length);
  const nextSlide = () =>
    setGalleryIndex((i) => (i + 1) % product.gallery.length);

  return (
    <Container size="wide" className="pt-28 lg:pt-36 pb-[var(--section-gap)]">
      {/* Breadcrumbs */}
      <nav
        aria-label="Хлібні крихти"
        className="flex flex-wrap items-center gap-2 text-[11px] tracking-[0.2em] uppercase text-[var(--color-text-muted)] mb-10 lg:mb-14"
      >
        <Link
          href="/"
          className="hover:text-[var(--color-text-primary)] transition-colors"
        >
          Головна
        </Link>
        <span aria-hidden>/</span>
        <Link
          href="/shop"
          className="hover:text-[var(--color-text-primary)] transition-colors"
        >
          Каталог
        </Link>
        <span aria-hidden>/</span>
        <span className="text-[var(--color-text-primary)]">{product.name}</span>
      </nav>

      {/* Main split — gallery | info */}
      <div className="grid lg:grid-cols-12 gap-8 lg:gap-16">
        {/* LEFT — gallery */}
        <div className="lg:col-span-7">
          <div className="relative aspect-square overflow-hidden rounded-[var(--radius-2xl)] bg-[var(--color-bg-secondary)]">
            <AnimatePresence mode="sync">
              <motion.div
                key={galleryIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: EASING.smooth }}
                className="absolute inset-0"
                aria-hidden
              >
                <div
                  className="absolute inset-0"
                  style={{ backgroundImage: product.gallery[galleryIndex] }}
                />
                <div
                  className="absolute inset-0 opacity-[0.1] mix-blend-overlay"
                  style={{
                    backgroundImage:
                      "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
                  }}
                />
              </motion.div>
            </AnimatePresence>

            {/* Nav arrows */}
            {product.gallery.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={prevSlide}
                  aria-label="Попереднє фото"
                  className="absolute top-1/2 left-4 -translate-y-1/2 h-11 w-11 rounded-full bg-[var(--color-bg-primary)]/90 backdrop-blur-sm text-[var(--color-text-primary)] grid place-items-center hover:bg-[var(--color-bg-primary)] transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={nextSlide}
                  aria-label="Наступне фото"
                  className="absolute top-1/2 right-4 -translate-y-1/2 h-11 w-11 rounded-full bg-[var(--color-bg-primary)]/90 backdrop-blur-sm text-[var(--color-text-primary)] grid place-items-center hover:bg-[var(--color-bg-primary)] transition-colors"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}

            {/* Dots */}
            {product.gallery.length > 1 && (
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2">
                {product.gallery.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Фото ${i + 1}`}
                    onClick={() => setGalleryIndex(i)}
                    className={cn(
                      "h-1 rounded-full transition-all duration-500",
                      i === galleryIndex
                        ? "w-8 bg-[var(--color-text-primary)]"
                        : "w-4 bg-[var(--color-text-primary)]/30 hover:bg-[var(--color-text-primary)]/60",
                    )}
                  />
                ))}
              </div>
            )}

            {product.badge && (
              <span className="absolute top-5 left-5 inline-flex items-center rounded-full bg-[var(--color-bg-primary)] px-4 py-2 text-[10px] tracking-[0.22em] uppercase text-[var(--color-text-primary)]">
                {product.badge}
              </span>
            )}
          </div>

          {/* Origin spec card — fills the empty space below the gallery on
              desktop. Hides itself when the SKU has no origin info (gear,
              gifts), so the column collapses cleanly. */}
          <OriginPanel product={product} />
        </div>

        {/* RIGHT — info */}
        <div className="lg:col-span-5 lg:pl-4">
          <h1 className="font-display font-semibold text-[clamp(2rem,4vw,3.25rem)] leading-[1.05] tracking-[-0.035em]">
            {product.name}
          </h1>

          <p className="mt-6 text-base leading-relaxed text-[var(--color-text-secondary)]">
            {product.story}
          </p>

          {/* Tasting notes — coffee SKUs only. The kicker label keeps the
              chips consistent with the rest of the right column (Вага /
              Обсмажка / Помел / Спосіб приготування), so they don't read
              as a stray strip floating after the story. */}
          {product.notes && product.notes.length > 0 && (
            <div className="mt-7">
              <h3 className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] mb-3">
                Смаковий профіль
              </h3>
              <div className="flex flex-wrap gap-2">
                {product.notes.map((note) => (
                  <span
                    key={note}
                    className="inline-flex items-center rounded-full border border-[var(--color-border-default)] px-3.5 py-1.5 text-xs tracking-wide text-[var(--color-text-secondary)]"
                  >
                    {note}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Taste meters — coffee SKUs only. Uses the flame+bar variant
              on the PDP: more expressive than dots and reads fast at a
              glance. */}
          {product.meters && (
            <div className="mt-10 pt-8 border-t border-[var(--color-border-default)]">
              <TasteMeters meters={product.meters} variant="bar" />
            </div>
          )}

          {/* Brewing recipe — coffee SKUs only. Skipped for drip / capsules
              (they ARE the brewing method) and non-coffee gear. */}
          {product.brewing && product.brewing.length > 0 && (
            <div className="mt-10 pt-8 border-t border-[var(--color-border-default)]">
              <BrewingRecipe brewing={product.brewing} />
            </div>
          )}

          {/* Weight / quantity variants. The label adapts so the section
              reads naturally per category: coffee in bags → "Вага", drip
              packs / capsules → "Кількість", gear / grinders / gifts →
              "Варіант". */}
          <div className="mt-10">
            <h3 className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] mb-4">
              {(() => {
                switch (product.category) {
                  case "beans":
                  case "ground":
                    return "Вага";
                  case "drip":
                  case "capsules":
                    return "Кількість";
                  default:
                    return "Варіант";
                }
              })()}
            </h3>
            <div className="flex flex-wrap gap-2">
              {product.weights.map((w, i) => {
                const active = i === weightIndex;
                return (
                  <button
                    key={w.label}
                    type="button"
                    onClick={() => setWeightIndex(i)}
                    className={cn(
                      "rounded-full px-5 py-2.5 text-sm transition-all duration-300",
                      active
                        ? "bg-[var(--color-text-primary)] text-[var(--color-text-inverse)]"
                        : "border border-[var(--color-border-strong)] text-[var(--color-text-primary)] hover:border-[var(--color-text-primary)]",
                    )}
                  >
                    {w.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Roast profile — only when the product has at least one. */}
          {hasRoasts && (
            <div className="mt-8">
              <h3 className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] mb-4">
                Обсмажка
              </h3>
              <div className="flex flex-wrap gap-2">
                {product.roasts!.map((r, i) => {
                  const active = i === roastIndex;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRoastIndex(i)}
                      disabled={product.roasts!.length === 1}
                      aria-pressed={active}
                      className={cn(
                        "rounded-full px-5 py-2.5 text-sm transition-all duration-300",
                        active
                          ? "bg-[var(--color-text-primary)] text-[var(--color-text-inverse)]"
                          : "border border-[var(--color-border-strong)] text-[var(--color-text-primary)] hover:border-[var(--color-text-primary)]",
                        product.roasts!.length === 1 && "cursor-default",
                      )}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Grind dropdown — skipped for pre-portioned products. */}
          {product.grinds && product.grinds.length > 0 && (
          <div className="mt-8 relative">
            <h3 className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] mb-4">
              Помел
            </h3>
            <button
              type="button"
              onClick={() => setGrindOpen((o) => !o)}
              aria-expanded={grindOpen}
              className="flex w-full items-center justify-between rounded-full border border-[var(--color-border-strong)] px-5 py-3.5 text-sm hover:border-[var(--color-text-primary)] transition-colors"
            >
              <span>{grind}</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-300",
                  grindOpen && "rotate-180",
                )}
              />
            </button>
            <AnimatePresence>
              {grindOpen && (
                <motion.ul
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25, ease: EASING.smooth }}
                  className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] shadow-lg"
                >
                  {product.grinds.map((g) => {
                    const active = g === grind;
                    return (
                      <li key={g}>
                        <button
                          type="button"
                          onClick={() => {
                            setGrind(g);
                            setGrindOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center justify-between px-5 py-3 text-sm transition-colors",
                            active
                              ? "bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
                              : "hover:bg-[var(--color-bg-secondary)]",
                          )}
                        >
                          <span>{g}</span>
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
          )}

          {/* Stock */}
          <div className="mt-10 flex items-center gap-2 text-xs tracking-[0.2em] uppercase">
            <span
              className={cn(
                "block h-1.5 w-1.5 rounded-full",
                product.inStock ? "bg-emerald-500" : "bg-[var(--color-border-strong)]",
              )}
              aria-hidden
            />
            <span
              className={cn(
                product.inStock ? "text-emerald-600" : "text-[var(--color-text-muted)]",
              )}
            >
              {product.inStock ? "В наявності" : "Немає в наявності"}
            </span>
          </div>

          {/* Price + qty + CTA. Price reflects wholesale rate when the
              3kg threshold is crossed; retail total is then shown as a
              strikethrough so the saving is obvious. */}
          <div className="mt-6 flex flex-wrap items-center gap-5">
            <div className="flex items-baseline gap-3">
              <span className="font-display text-[clamp(1.5rem,2.5vw,2.25rem)] font-semibold tabular-nums tracking-tight">
                {formatPrice(totalPrice)}
              </span>
              {wholesaleTotal && (
                <span className="text-base font-medium text-[var(--color-text-muted)] line-through tabular-nums">
                  {formatPrice(retailTotal)}
                </span>
              )}
            </div>
            <QuantityStepper value={quantity} onChange={setQuantity} />
          </div>

          {/* Wholesale state — two flavours sharing the same slot below
              the price row so the layout stays stable:
                - Before threshold: muted hint with the per-kg target and
                  a small progress bar showing how close the customer is.
                - After threshold: green success card with the saving
                  amount. */}
          {wholesalePerKg && !wholesaleActive && (
            <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-5 py-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[11px] tracking-[0.28em] uppercase text-[var(--color-text-muted)]">
                  Гуртова ціна від {WHOLESALE_MIN_KG} кг
                </p>
                <p className="font-display text-base font-semibold tabular-nums">
                  {formatPrice(wholesalePerKg)}
                  <span className="ml-1 text-xs font-medium text-[var(--color-text-muted)]">
                    /кг
                  </span>
                </p>
              </div>
              <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                Додай ще{" "}
                <span className="text-[var(--color-text-primary)] font-medium tabular-nums">
                  {kgToWholesale.toFixed(2).replace(/\.?0+$/, "")} кг
                </span>{" "}
                — і отримаєш знижку −{WHOLESALE_DISCOUNT_PERCENT}%.
              </p>
              <div className="mt-3 h-[3px] rounded-full bg-[var(--color-border-strong)]/40 overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${Math.min(100, (currentKg / WHOLESALE_MIN_KG) * 100)}%`,
                    backgroundColor: "#E9D358",
                  }}
                />
              </div>
            </div>
          )}
          {wholesaleActive && (
            <div className="mt-4 rounded-[var(--radius-lg)] border border-emerald-300 bg-emerald-50/70 px-5 py-4">
              <p className="text-[11px] tracking-[0.28em] uppercase text-emerald-700">
                ✓ Гуртова знижка активована
              </p>
              <p className="mt-2 text-sm text-emerald-900">
                Економія{" "}
                <span className="font-display font-semibold tabular-nums">
                  {formatPrice(wholesaleSavings)}
                </span>{" "}
                · ціна {formatPrice(wholesalePerKg!)} за кілограм при{" "}
                <span className="tabular-nums">
                  {currentKg.toFixed(2).replace(/\.?0+$/, "")} кг
                </span>
                .
              </p>
            </div>
          )}

          <Button
            ref={primaryCtaRef}
            variant="primary"
            size="lg"
            className="mt-6 w-full justify-center"
            onClick={handleAddToCart}
          >
            <ShoppingBag className="h-4 w-4" />
            Купити
          </Button>

          {/* Bottom strapline — adapts to category. "Obsmazheno tsoho
              tyzhnia" only makes sense for coffee SKUs (beans / ground /
              drip / capsules); grinders, gear and gifts get a generic
              shipping note instead. Detection mirrors the same predicate
              we use in the data layer so it stays in sync. */}
          {(() => {
            const coffeeCategories = new Set([
              "beans",
              "ground",
              "drip",
              "capsules",
            ]);
            const isCoffee = coffeeCategories.has(product.category);
            return (
              <p className="mt-6 text-xs tracking-[0.15em] uppercase text-[var(--color-text-muted)]">
                {isCoffee
                  ? "Обсмажено цього тижня · Доставка 1–2 дні"
                  : "Відправка день у день · Доставка 1–2 дні"}
              </p>
            );
          })()}
        </div>
      </div>

      {/* Sticky bottom-of-screen CTA — phones only, appears once the
          primary "Купити" scrolls out of view. Same handler as the
          original button, so cart state + fly animation are identical. */}
      <StickyMobileCTA
        name={product.name}
        totalPrice={totalPrice}
        variantLabel={[
          activeWeight.label,
          activeRoast,
          product.grinds && grind !== "Не молоти" ? grind : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        thumb={product.gallery[0]}
        primaryCtaRef={primaryCtaRef}
        onAddToCart={handleAddToCart}
        inStock={product.inStock}
      />
    </Container>
  );
}
