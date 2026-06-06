"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import { useState } from "react";
import { TasteMeters } from "./taste-meters";
import { QuantityStepper } from "./quantity-stepper";
import { getWholesalePerKg, WHOLESALE_MIN_KG } from "@/lib/wholesale";
import { formatPrice, cn } from "@/lib/utils";
import { EASING } from "@/lib/easing";
import { useAddToCart } from "@/lib/use-add-to-cart";
import type { Product } from "@/data/products";

interface ProductCardProps {
  product: Product;
}

/**
 * Product card — interactive commerce tile for grid listings.
 *
 * Structure (onelove-inspired, adapted to BATCH's rounded + neutral palette):
 *   - process chip on image (bottom-left)
 *   - taste meters strip (3 × 5 dots)
 *   - title + tasting notes line
 *   - interactive weight pills — price reflects the selected weight
 *   - interactive roast pills — when the product offers multiple profiles
 *   - price + quick add-to-cart button (uses current selections)
 */
export function ProductCard({ product }: ProductCardProps) {
  const [weightIndex, setWeightIndex] = useState(0);
  const [roastIndex, setRoastIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const addToCart = useAddToCart();

  const weight = product.weights[weightIndex];
  const roast = product.roasts?.[roastIndex];
  const hasRoasts = (product.roasts?.length ?? 0) > 0;

  // Wholesale state — derived from current weight × quantity. If the
  // total reaches the 3kg threshold and the SKU sells in kilo packs,
  // the displayed price drops to the wholesale rate and we show a
  // success badge. Below threshold we surface a hint line so the buyer
  // knows the offer exists.
  const wholesalePerKg = getWholesalePerKg(product);
  const currentKg = (weight.grams * quantity) / 1000;
  const wholesaleEligible =
    wholesalePerKg !== null && currentKg >= WHOLESALE_MIN_KG;
  const retailTotal = weight.price * quantity;
  const wholesaleTotal = wholesaleEligible
    ? Math.round(wholesalePerKg! * currentKg)
    : null;
  const displayPrice = wholesaleTotal ?? retailTotal;
  const savings = wholesaleTotal ? retailTotal - wholesaleTotal : 0;

  // Pass the click event so useAddToCart can grab the button rect for the
  // fly-to-cart ghost. Without an event, the hook falls back to opening
  // the drawer for feedback.
  const handleAddToCart = (e: React.MouseEvent<HTMLButtonElement>) => {
    addToCart(product, { weightIndex, roast, quantity }, e);
  };

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] transition-colors duration-500 hover:border-[var(--color-border-strong)]">
      {/* Image — whole top half is a link for usability */}
      <Link
        href={`/shop/${product.slug}`}
        className="relative block aspect-square overflow-hidden bg-[var(--color-bg-secondary)]"
        aria-label={product.name}
      >
        <motion.div
          whileHover={{ scale: 1.04 }}
          transition={{ duration: 0.9, ease: EASING.smooth }}
          className="absolute inset-0"
        >
          <div
            aria-hidden
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: product.gallery[0] }}
          />
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.1] mix-blend-overlay"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            }}
          />
        </motion.div>

        {/* Badge top-left */}
        {product.badge && (
          <span className="absolute top-4 left-4 inline-flex items-center rounded-full bg-[var(--color-bg-primary)] px-3 py-1.5 text-[10px] tracking-[0.22em] uppercase text-[var(--color-text-primary)]">
            {product.badge}
          </span>
        )}

      </Link>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-5 p-5 lg:p-6">
        {product.meters && (
          <TasteMeters meters={product.meters} variant="bar-compact" />
        )}

        <Link href={`/shop/${product.slug}`} className="group/title block">
          <h3 className="font-display text-xl lg:text-[22px] font-semibold leading-[1.1] tracking-[-0.02em] transition-opacity duration-300 group-hover/title:opacity-60">
            {product.name}
          </h3>
          <p className="mt-1.5 text-sm leading-snug text-[var(--color-text-secondary)]">
            {product.notes?.length
              ? product.notes.join(", ")
              : product.shortDescription}
          </p>
        </Link>

        {/* Interactive variant pills */}
        <div className="flex flex-col gap-2.5">
          {/* Weights — always shown (every product has at least one). */}
          <div className="flex flex-wrap gap-2">
            {product.weights.map((w, i) => (
              <VariantPill
                key={w.label}
                active={i === weightIndex}
                onClick={() => setWeightIndex(i)}
              >
                {w.label}
              </VariantPill>
            ))}
          </div>
          {/* Roasts — omitted for non-coffee products. */}
          {hasRoasts && (
            <div className="flex flex-wrap gap-2">
              {product.roasts!.map((r, i) => (
                <VariantPill
                  key={r}
                  active={i === roastIndex}
                  onClick={() => setRoastIndex(i)}
                  // single-option roast → keep visible but not interactive
                  disabled={product.roasts!.length === 1}
                >
                  {r}
                </VariantPill>
              ))}
            </div>
          )}
        </div>

        {/* Price + qty + add. The qty stepper sits between the price and
            the cart button so the eye reads "ціна × кількість → додати"
            left-to-right. Compact size keeps the row from outgrowing the
            card on narrow grids. */}
        <div className="mt-auto flex flex-col gap-1.5 pt-2">
          <div className="flex items-center justify-between gap-3">
            {/* Price stack — wholesale puts the retail figure on its own
                line below so the row never outgrows the card width.
                Without stacking, 12kg-level prices (5 digits each side)
                crash into the stepper. */}
            <div className="flex flex-col min-w-0 leading-none">
              <span className="font-display text-xl font-semibold tabular-nums tracking-tight">
                {formatPrice(displayPrice)}
              </span>
              {wholesaleTotal && (
                <span className="mt-1 text-[11px] text-[var(--color-text-muted)] line-through tabular-nums">
                  {formatPrice(retailTotal)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <QuantityStepper
                size="compact"
                value={quantity}
                onChange={setQuantity}
              />
              <button
                type="button"
                onClick={handleAddToCart}
                aria-label={`Додати ${product.name} (${weight.label}${roast ? `, ${roast}` : ""}) × ${quantity} у кошик`}
                className="grid h-11 w-11 place-items-center rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] transition-opacity duration-300 hover:opacity-80"
              >
                <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={1.6} />
              </button>
            </div>
          </div>

          {/* Wholesale state line. Two states, both compact, both
              attached to the price row so there's no floating orphan: */}
          {wholesalePerKg && !wholesaleTotal && (
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--color-text-muted)]">
              Гурт від {WHOLESALE_MIN_KG} кг —{" "}
              <span className="text-[var(--color-text-primary)] font-medium tabular-nums">
                {formatPrice(wholesalePerKg)}/кг
              </span>
            </p>
          )}
          {wholesaleTotal && (
            <p className="inline-flex items-center gap-2 text-[10px] tracking-[0.18em] uppercase text-emerald-700">
              ✓ Гуртова знижка{" "}
              <span className="tabular-nums">−{formatPrice(savings)}</span>
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

interface VariantPillProps {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function VariantPill({ active, disabled, onClick, children }: VariantPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center rounded-full px-4 py-1.5 text-[11px] tracking-[0.1em] uppercase transition-all duration-300",
        active
          ? "bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] border border-[var(--color-text-primary)]"
          : "bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] border border-[var(--color-border-strong)] hover:border-[var(--color-text-primary)]",
        disabled && "cursor-default hover:border-[var(--color-border-strong)]",
      )}
    >
      {children}
    </button>
  );
}
