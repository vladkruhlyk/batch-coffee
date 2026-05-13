"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, ShoppingBag, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { FreeShippingProgress } from "@/components/cart/free-shipping-progress";
import { EASING } from "@/lib/easing";
import { formatPrice, cn } from "@/lib/utils";
import {
  getCartSubtotal,
  useCart,
  type CartItem,
} from "@/lib/cart-store";

/**
 * Cart drawer — slide-over sheet from the right edge.
 *
 * Rendered once at the root of the app so it can be opened from anywhere
 * (header button, ProductCard quick-add, PDP CTA) without prop drilling.
 * Cart store is the single source of truth; this component is purely a
 * view over it.
 *
 * Structure:
 *   ┌──────────────────────────────┐
 *   │ header  (count + close)      │  sticky
 *   ├──────────────────────────────┤
 *   │ scrollable list of items     │  flex-1 overflow-auto
 *   │   · thumb · name · qty · ×   │
 *   ├──────────────────────────────┤
 *   │ footer (subtotal + CTA)      │  sticky
 *   └──────────────────────────────┘
 */
export function CartDrawer() {
  const items = useCart((s) => s.items);
  const open = useCart((s) => s.open);
  const closeCart = useCart((s) => s.closeCart);
  const remove = useCart((s) => s.remove);
  const setQuantity = useCart((s) => s.setQuantity);
  const clear = useCart((s) => s.clear);

  // Lock body scroll while open. Mirrors the existing mobile-menu pattern.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close on Escape — standard modal behaviour.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCart();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeCart]);

  // Safety-net: auto-close when the route changes. Without this, clicking
  // a navigating element inside the drawer leaves the drawer up over the
  // new page — looks like "переход не работает" from the user's POV.
  // Skip the very first render so opening the drawer on a stable route
  // doesn't immediately close it.
  const pathname = usePathname();
  const prevPath = useRef(pathname);
  useEffect(() => {
    if (prevPath.current !== pathname) {
      prevPath.current = pathname;
      if (open) closeCart();
    }
  }, [pathname, open, closeCart]);

  const subtotal = getCartSubtotal(items);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const isEmpty = items.length === 0;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="cart-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: EASING.smooth }}
            onClick={closeCart}
            className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-sm"
            aria-hidden
          />

          {/* Panel */}
          <motion.aside
            key="cart-panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.55, ease: EASING.expoOut }}
            className="fixed inset-y-0 right-0 z-[120] flex w-full max-w-[460px] flex-col bg-[var(--color-bg-primary)] shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Кошик"
          >
            {/* Header */}
            <header className="flex items-center justify-between border-b border-[var(--color-border-default)] px-6 py-5 lg:px-8">
              <div className="flex items-baseline gap-3">
                <h2 className="font-display text-2xl font-semibold tracking-tight">
                  Кошик
                </h2>
                <span className="text-[11px] tracking-[0.22em] uppercase text-[var(--color-text-muted)] tabular-nums">
                  {count} {pluralizeItems(count)}
                </span>
              </div>
              <button
                type="button"
                onClick={closeCart}
                aria-label="Закрити кошик"
                className="grid h-10 w-10 place-items-center rounded-full hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                <X className="h-5 w-5" strokeWidth={1.5} />
              </button>
            </header>

            {/* Body */}
            {isEmpty ? (
              <EmptyState onClose={closeCart} />
            ) : (
              <ul className="flex-1 overflow-y-auto px-6 py-4 lg:px-8">
                <AnimatePresence initial={false}>
                  {items.map((item) => (
                    <motion.li
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 40, height: 0, marginTop: 0 }}
                      transition={{ duration: 0.35, ease: EASING.smooth }}
                      className="border-b border-[var(--color-border-default)] py-5 first:pt-0 last:border-b-0"
                    >
                      <CartLine
                        item={item}
                        onRemove={() => remove(item.id)}
                        onQuantity={(n) => setQuantity(item.id, n)}
                      />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}

            {/* Footer */}
            {!isEmpty && (
              <footer className="border-t border-[var(--color-border-default)] px-6 py-6 lg:px-8 lg:py-7">
                {/* Free-shipping nudge — compact strip so the drawer's
                    vertical real estate stays focused on the CTA. */}
                <FreeShippingProgress
                  amount={subtotal}
                  variant="compact"
                  className="mb-5"
                />
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]">
                    Підсумок
                  </span>
                  <span className="font-display text-2xl font-semibold tabular-nums tracking-tight">
                    {formatPrice(subtotal)}
                  </span>
                </div>
                <p className="mt-2 text-[11px] tracking-[0.15em] uppercase text-[var(--color-text-muted)]">
                  Доставку розрахуємо на наступному кроці
                </p>
                <Button
                  href="/checkout"
                  variant="primary"
                  size="lg"
                  className="mt-5 w-full justify-center"
                  onClick={closeCart}
                >
                  Оформити замовлення
                </Button>
                <div className="mt-4 flex items-center justify-between text-[11px] tracking-[0.2em] uppercase">
                  <button
                    type="button"
                    onClick={closeCart}
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                  >
                    Продовжити покупки
                  </button>
                  <button
                    type="button"
                    onClick={clear}
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                  >
                    Очистити
                  </button>
                </div>
              </footer>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

interface CartLineProps {
  item: CartItem;
  onRemove: () => void;
  onQuantity: (n: number) => void;
}

function CartLine({ item, onRemove, onQuantity }: CartLineProps) {
  const lineTotal = item.unitPrice * item.quantity;
  const variantBits = [item.weightLabel, item.roast, item.grind].filter(
    (b): b is string => Boolean(b && b !== "Не молоти"),
  );

  return (
    <div className="flex gap-4">
      {/* Thumb — reuses the gradient from the gallery */}
      <Link
        href={`/shop/${item.slug}`}
        className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-bg-secondary)]"
        aria-label={item.name}
      >
        <span
          aria-hidden
          className="absolute inset-0"
          style={{ backgroundImage: item.thumb }}
        />
      </Link>

      {/* Meat */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <Link
            href={`/shop/${item.slug}`}
            className="font-display text-[15px] font-semibold leading-snug tracking-[-0.01em] transition-opacity hover:opacity-70"
          >
            {item.name}
          </Link>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Прибрати ${item.name}`}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
        {variantBits.length > 0 && (
          <p className="mt-1 text-xs tracking-wide text-[var(--color-text-muted)]">
            {variantBits.join(" · ")}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between">
          <QuantityStepper
            value={item.quantity}
            onChange={onQuantity}
          />
          <span className="font-display text-sm font-semibold tabular-nums">
            {formatPrice(lineTotal)}
          </span>
        </div>
      </div>
    </div>
  );
}

interface QuantityStepperProps {
  value: number;
  onChange: (v: number) => void;
}

function QuantityStepper({ value, onChange }: QuantityStepperProps) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-[var(--color-border-default)] p-0.5">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        aria-label="Зменшити"
        className={cn(
          "grid h-7 w-7 place-items-center rounded-full text-[var(--color-text-primary)] transition-colors",
          "hover:bg-[var(--color-bg-secondary)] disabled:opacity-40 disabled:pointer-events-none",
        )}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-[2ch] text-center text-sm font-display font-medium tabular-nums">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        aria-label="Збільшити"
        className="grid h-7 w-7 place-items-center rounded-full text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function EmptyState({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="grid h-20 w-20 place-items-center rounded-full bg-[var(--color-bg-secondary)]">
        <ShoppingBag className="h-8 w-8 text-[var(--color-text-muted)]" strokeWidth={1.4} />
      </div>
      <div>
        <h3 className="font-display text-xl font-semibold tracking-tight">
          Тут поки тихо
        </h3>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Оберіть каву з нашої останньої обсмажки — вона ще тепла.
        </p>
      </div>
      {/* Plain Link styled like a primary button — Button component's link
          variant doesn't accept onClick, so we hand-roll one to also close
          the drawer (otherwise it would stay open over the new page). */}
      <Link
        href="/shop"
        onClick={onClose}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-text-primary)] px-7 py-3.5 text-sm font-sans tracking-wide text-[var(--color-text-inverse)] hover:bg-[var(--color-accent-hover)] transition-colors duration-300"
      >
        До каталогу
      </Link>
    </div>
  );
}

/** Ukrainian pluralization for "товар" — 1, 2-4, 5+ forms. */
function pluralizeItems(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "товар";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "товари";
  return "товарів";
}
