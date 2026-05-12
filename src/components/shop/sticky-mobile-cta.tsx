"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { EASING } from "@/lib/easing";
import { formatPrice } from "@/lib/utils";

interface StickyMobileCTAProps {
  /** Localised product title shown above the price. */
  name: string;
  /** Final price (already adjusted for active weight × quantity). */
  totalPrice: number;
  /** Short variant summary, e.g. "250 г · Еспресо". Optional — when absent
   *  the bar shows just the name. */
  variantLabel?: string;
  /** Background gradient for the tiny thumb on the left side. Reuses the
   *  product gallery's primary gradient so the bar feels visually tied to
   *  the SKU. */
  thumb?: string;
  /** Element ref for the in-page primary CTA. The sticky bar appears only
   *  when this element scrolls out of view — avoids two CTAs fighting for
   *  attention while the user is already looking at the original. */
  primaryCtaRef: RefObject<HTMLElement | null>;
  /** Called when the sticky button is tapped. The parent passes in the
   *  same handler that the in-page CTA uses, so cart state + fly animation
   *  fire identically from either trigger. */
  onAddToCart: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** Stock state — disables the button + dims the bar when out of stock. */
  inStock: boolean;
}

/**
 * Mobile-only sticky CTA bar. Pinned to the bottom of the viewport on
 * phones / small tablets; vanishes on `lg:` because desktop already
 * has the primary CTA on screen at any reasonable scroll position.
 *
 * Show/hide is driven by an IntersectionObserver on the in-page CTA
 * (passed via ref). The bar only appears when the original button is
 * scrolled out of view — typical pattern from Apple/Nike PDPs. Avoids
 * the redundant "two buy buttons in the same fold" feel.
 *
 * Safe-area inset is honoured so the bar doesn't hide behind the iPhone
 * home indicator.
 */
export function StickyMobileCTA({
  name,
  totalPrice,
  variantLabel,
  thumb,
  primaryCtaRef,
  onAddToCart,
  inStock,
}: StickyMobileCTAProps) {
  const [show, setShow] = useState(false);
  // Track the previous primary-cta presence so we don't flash the bar in
  // on first paint before the observer reports.
  const observed = useRef(false);

  useEffect(() => {
    const target = primaryCtaRef.current;
    if (!target || typeof IntersectionObserver === "undefined") return;

    const io = new IntersectionObserver(
      ([entry]) => {
        observed.current = true;
        // Show the bar exactly when the primary CTA leaves the viewport.
        // A small `rootMargin` on the bottom would let us reveal earlier,
        // but here that just creates flicker — leave it sharp.
        setShow(!entry.isIntersecting);
      },
      { threshold: 0 },
    );
    io.observe(target);
    return () => io.disconnect();
  }, [primaryCtaRef]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          // Phones / small tablets only. The breakpoint mirrors the PDP's
          // single-column → two-column switch at `lg:`.
          className="lg:hidden fixed inset-x-0 bottom-0 z-[120] pointer-events-none"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.35, ease: EASING.smooth }}
        >
          <div
            className="pointer-events-auto mx-3 mb-3 rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)]/95 backdrop-blur-md shadow-[0_8px_28px_-8px_rgba(0,0,0,0.25)]"
            style={{
              // Respect the iPhone home indicator without padding the
              // visible card itself — push the whole layer up via margin.
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
          >
            <div className="flex items-center gap-3 px-3 py-3">
              {/* Tiny SKU thumb — uses the product's primary gradient so the
                  bar feels rooted in this product's visual identity. */}
              {thumb && (
                <span
                  aria-hidden
                  className="h-12 w-12 shrink-0 rounded-[var(--radius-md)]"
                  style={{ backgroundImage: thumb }}
                />
              )}

              <div className="min-w-0 flex-1">
                <p className="font-display text-sm font-semibold leading-tight truncate">
                  {name}
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)] tabular-nums truncate">
                  {variantLabel ? `${variantLabel} · ` : ""}
                  <span className="text-[var(--color-text-primary)] font-medium">
                    {formatPrice(totalPrice)}
                  </span>
                </p>
              </div>

              <button
                type="button"
                onClick={onAddToCart}
                disabled={!inStock}
                className="shrink-0 inline-flex items-center gap-2 rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] px-5 py-3 text-sm font-medium transition-opacity duration-300 hover:opacity-85 disabled:opacity-50"
                aria-label={`Купити ${name}`}
              >
                <ShoppingBag className="h-4 w-4" strokeWidth={1.8} />
                <span>Купити</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
