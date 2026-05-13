"use client";

import { motion } from "framer-motion";
import { Check, Truck } from "lucide-react";
import { EASING } from "@/lib/easing";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/shipping";
import { formatPrice, cn } from "@/lib/utils";

interface FreeShippingProgressProps {
  /** Current cart total against which the threshold is measured. */
  amount: number;
  /** "card" = full editorial card, used on /cart and inside the drawer.
   *  "compact" = single-line strip for tighter spaces (checkout summary). */
  variant?: "card" | "compact";
  className?: string;
}

/**
 * Free-shipping progress nudge. Two visual states:
 *
 *   - Below threshold → "До безкоштовної доставки залишилось X грн" with
 *     an animated yellow fill rising from 0 → percent reached.
 *   - At/above threshold → success copy "Доставка вже безкоштовна" with
 *     the rail filled solid and a checkmark over the truck icon.
 *
 * The yellow fill colour intentionally matches our taste-meter flame
 * (`#E9D358`) — keeps the page's accent palette tight rather than
 * introducing a new "primary" tone for commerce signals.
 */
export function FreeShippingProgress({
  amount,
  variant = "card",
  className,
}: FreeShippingProgressProps) {
  const reached = amount >= FREE_SHIPPING_THRESHOLD;
  const missing = Math.max(0, FREE_SHIPPING_THRESHOLD - amount);
  const percent = Math.min(100, (amount / FREE_SHIPPING_THRESHOLD) * 100);

  // Compact: single horizontal line. Used inside the checkout summary
  // rail where vertical space matters more than visual punch.
  if (variant === "compact") {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <p className="text-xs leading-relaxed">
          {reached ? (
            <span className="text-emerald-700 font-medium">
              Доставка вже безкоштовна 🎉
            </span>
          ) : (
            <>
              <span className="text-[var(--color-text-secondary)]">
                До безкоштовної доставки:
              </span>{" "}
              <span className="font-display font-semibold tabular-nums">
                {formatPrice(missing)}
              </span>
            </>
          )}
        </p>
        <Rail percent={percent} reached={reached} />
      </div>
    );
  }

  return (
    <article
      className={cn(
        "rounded-[var(--radius-xl)] border bg-[var(--color-bg-secondary)] px-5 py-5 lg:px-6 lg:py-6 transition-colors duration-500",
        reached
          ? "border-emerald-300 bg-emerald-50/60"
          : "border-[var(--color-border-default)]",
        className,
      )}
    >
      <div className="flex items-center gap-5">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] mb-2">
            Безкоштовна доставка
          </p>
          {reached ? (
            <p className="font-display text-lg lg:text-xl font-semibold leading-snug">
              Готово — доставка{" "}
              <span className="text-emerald-700">безкоштовна</span>.
            </p>
          ) : (
            <p className="font-display text-lg lg:text-xl font-semibold leading-snug">
              Залишилось{" "}
              <span className="tabular-nums">{formatPrice(missing)}</span>
              <span className="block text-[var(--color-text-secondary)] font-medium">
                до безкоштовної доставки
              </span>
            </p>
          )}
        </div>

        {/* Truck icon + FREE badge — fades to a solid filled state once
            the user crosses the threshold. */}
        <div className="relative shrink-0">
          <span
            className={cn(
              "absolute -top-3 -right-2 z-10 inline-flex items-center text-[9px] tracking-[0.18em] uppercase rounded-full px-2 py-0.5 transition-colors duration-300",
              reached
                ? "bg-emerald-600 text-white"
                : "bg-[var(--color-text-primary)] text-[var(--color-text-inverse)]",
            )}
          >
            {reached ? (
              <span className="inline-flex items-center gap-1">
                <Check className="h-2.5 w-2.5" strokeWidth={3} /> free
              </span>
            ) : (
              "free"
            )}
          </span>
          <span
            className={cn(
              "grid h-14 w-14 lg:h-16 lg:w-16 place-items-center rounded-full transition-colors duration-500",
              reached
                ? "bg-emerald-600 text-white"
                : "bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]",
            )}
          >
            <Truck className="h-6 w-6 lg:h-7 lg:w-7" strokeWidth={1.5} />
          </span>
        </div>
      </div>

      <Rail className="mt-5" percent={percent} reached={reached} />
    </article>
  );
}

/**
 * Inner progress rail — same shape for both variants. Animates the fill
 * on mount and whenever `percent` changes; the easing matches the rest
 * of the site so movement reads as one family.
 */
function Rail({
  percent,
  reached,
  className,
}: {
  percent: number;
  reached: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative h-[3px] rounded-full overflow-hidden bg-[var(--color-border-strong)]/40",
        className,
      )}
      aria-label="Прогрес до безкоштовної доставки"
    >
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{
          backgroundColor: reached ? "#059669" : "#E9D358",
        }}
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ duration: 0.9, ease: EASING.smooth }}
      />
    </div>
  );
}
