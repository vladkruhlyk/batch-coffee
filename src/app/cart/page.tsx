"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Minus, Plus, ShoppingBag, Tag, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Container } from "@/components/layout/container";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { FreeShippingProgress } from "@/components/cart/free-shipping-progress";
import {
  useCart,
  getCartSubtotal,
  getCartCount,
  getEffectiveItems,
  type EffectiveCartItem,
} from "@/lib/cart-store";
import { discountFromSnapshot, type PromoSnapshot } from "@/lib/promo";
import {
  mergeRefreshedPrices,
  refreshCartPrices,
} from "@/lib/refresh-cart-prices";
import { FREE_SHIPPING_THRESHOLD, DELIVERY_BASE } from "@/lib/shipping";
import { formatPrice, cn } from "@/lib/utils";
import { EASING } from "@/lib/easing";

/**
 * Cart page — full-page review of the basket before checkout.
 *
 * The mini-drawer (`CartDrawer`) is for quick edits while browsing; this
 * page is the place where the user actually decides. We surface promo
 * codes, free-shipping nudges, and the line-by-line item editor on the
 * left, then summarise everything in a sticky right rail on desktop /
 * fixed bottom bar on mobile.
 *
 * Promo codes are managed in Sanity Studio. "Застосувати" POSTs the code
 * to `/api/promo/validate`, which resolves + validates it server-side and
 * returns a display snapshot we keep in the cart store. The real discount
 * is re-validated independently at order creation.
 */
export default function CartPage() {
  const items = useCart((s) => s.items);
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);
  const replaceItems = useCart((s) => s.replaceItems);
  // Promo lives in the store now (persisted) so checkout can read it and
  // send the *code* to the server, which recomputes the authoritative
  // discount. The input text + error/loading stay local to this page.
  const promo = useCart((s) => s.promo);
  const setPromo = useCart((s) => s.setPromo);
  const [promoInput, setPromoInput] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  // Refresh prices against live Sanity on mount — without this, a
  // customer landing on /cart directly (not via checkout) sees the
  // localStorage-snapshotted prices, which may be stale.
  const refreshedRef = useRef(false);
  useEffect(() => {
    if (refreshedRef.current || items.length === 0) return;
    refreshedRef.current = true;
    refreshCartPrices(items)
      .then(({ updatedItems, changed }) => {
        if (changed.length === 0) return;
        // Merge by id against the LIVE store — the user may have edited
        // quantities / removed lines while the fetch was in flight, and a
        // blind replace would silently undo those edits.
        replaceItems(
          mergeRefreshedPrices(useCart.getState().items, updatedItems),
        );
      })
      .catch((err) => {
        // Stale prices are the fallback — no crash, but do leave a trace
        // so Sanity outages are visible in logs.
        console.error("cart price refresh failed:", err);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subtotal = getCartSubtotal(items);
  const effectiveItems = getEffectiveItems(items);
  const wholesaleActive = effectiveItems.some((i) => i.wholesaleActive);
  const count = getCartCount(items);
  const discount = discountFromSnapshot(promo, subtotal);
  const eligibleForFreeShipping = subtotal - discount >= FREE_SHIPPING_THRESHOLD;
  const shipping = eligibleForFreeShipping ? 0 : DELIVERY_BASE;
  const total = subtotal - discount + shipping;

  const applyPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = promoInput.trim();
    if (!code || promoLoading) return;
    setPromoLoading(true);
    setPromoError(null);
    try {
      // Read the LIVE subtotal at request time (not the render-closure
      // value), so editing the cart while the request is in flight
      // validates against the real basket.
      const liveSubtotal = getCartSubtotal(useCart.getState().items);
      const res = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, subtotal: liveSubtotal }),
      });
      const data = (await res.json()) as
        | { ok: true; snapshot: PromoSnapshot }
        | { ok: false; reason: string };
      if (data.ok) {
        setPromo(data.snapshot);
        setPromoError(null);
      } else {
        setPromo(null);
        setPromoError(data.reason || "Цей промокод не діє. Перевір ще раз.");
      }
    } catch {
      setPromoError("Не вдалось перевірити промокод. Спробуй ще раз.");
    } finally {
      setPromoLoading(false);
    }
  };

  return (
    <>
      <Header />
      <main className="flex-1">
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
            <span className="text-[var(--color-text-primary)]">Кошик</span>
          </nav>

          {/* Title */}
          <header className="grid lg:grid-cols-12 gap-8 mb-12 lg:mb-16">
            <div className="lg:col-span-8">
              <h1 className="font-display font-semibold text-[clamp(2rem,4.5vw,3.75rem)] leading-[1.02] tracking-[-0.04em]">
                Кошик
              </h1>
              {count > 0 && (
                <p className="mt-3 text-[var(--color-text-secondary)]">
                  {count} {plural(count, ["позиція", "позиції", "позицій"])} ·
                  Останній погляд перед оформленням.
                </p>
              )}
            </div>
          </header>

          {items.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid lg:grid-cols-12 gap-8 lg:gap-12">
              {/* Items list */}
              <div className="lg:col-span-8">
                {/* Free-shipping nudge — always shown so the user sees
                    the threshold and the success state both. The
                    component handles its own conditional copy. */}
                <FreeShippingProgress
                  amount={subtotal - discount}
                  variant="card"
                  className="mb-5"
                />

                {wholesaleActive && (
                  <p className="mb-3 inline-flex items-center gap-2 self-start rounded-full bg-emerald-100 px-3 py-1 text-[10px] tracking-[0.18em] uppercase text-emerald-800">
                    Гуртова ціна активна
                  </p>
                )}

                <ul className="flex flex-col gap-3">
                  <AnimatePresence initial={false}>
                    {effectiveItems.map((item) => (
                      <motion.li
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        transition={{ duration: 0.35, ease: EASING.smooth }}
                      >
                        <CartLine
                          item={item}
                          onQty={(n) => setQuantity(item.id, n)}
                          onRemove={() => remove(item.id)}
                        />
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>

                {/* Continue shopping */}
                <Link
                  href="/shop"
                  className="mt-6 inline-flex items-center gap-2 text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  ← Продовжити покупки
                </Link>
              </div>

              {/* Summary rail */}
              <aside className="lg:col-span-4">
                <div className="sticky top-28 rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-6 lg:p-7">
                  <h2 className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]">
                    Підсумок
                  </h2>

                  {/* Promo */}
                  <form onSubmit={applyPromo} className="mt-5">
                    <label
                      htmlFor="promo"
                      className="text-[10px] tracking-[0.22em] uppercase text-[var(--color-text-muted)] inline-flex items-center gap-2 mb-2"
                    >
                      <Tag className="h-3 w-3" /> Промокод
                    </label>
                    {promo ? (
                      <div className="flex items-center justify-between gap-3 rounded-full bg-[var(--color-bg-secondary)] px-4 py-2">
                        <span className="font-display text-sm font-medium">
                          {promo.code}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setPromo(null);
                            setPromoInput("");
                            setPromoError(null);
                          }}
                          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                        >
                          Прибрати
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 border-b border-[var(--color-border-strong)] focus-within:border-[var(--color-text-primary)] pb-2 transition-colors">
                          <input
                            id="promo"
                            value={promoInput}
                            onChange={(e) => {
                              setPromoInput(e.target.value);
                              if (promoError) setPromoError(null);
                            }}
                            placeholder="Введи код"
                            disabled={promoLoading}
                            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-text-muted)] disabled:opacity-60"
                          />
                          <button
                            type="submit"
                            disabled={promoLoading || !promoInput.trim()}
                            className="text-xs tracking-[0.12em] uppercase text-[var(--color-text-primary)] hover:opacity-70 transition-opacity disabled:opacity-40"
                          >
                            {promoLoading ? "..." : "Застосувати"}
                          </button>
                        </div>
                        {promoError && (
                          <p className="mt-2 text-xs text-rose-700">
                            {promoError}
                          </p>
                        )}
                      </>
                    )}
                  </form>

                  {/* Totals */}
                  <dl className="mt-7 pt-6 border-t border-[var(--color-border-default)] flex flex-col gap-3 text-sm">
                    <div className="flex items-center justify-between">
                      <dt className="text-[var(--color-text-secondary)]">
                        Сума товарів
                      </dt>
                      <dd className="tabular-nums">{formatPrice(subtotal)}</dd>
                    </div>
                    {discount > 0 && promo && (
                      <div className="flex items-center justify-between text-emerald-700">
                        <dt>Знижка ({promo.code})</dt>
                        <dd className="tabular-nums">
                          −{formatPrice(discount)}
                        </dd>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <dt className="text-[var(--color-text-secondary)]">
                        Доставка
                      </dt>
                      <dd className="tabular-nums">
                        {shipping === 0 ? (
                          <span className="text-emerald-700">Безкоштовно</span>
                        ) : (
                          formatPrice(shipping)
                        )}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-5 pt-5 border-t border-[var(--color-border-default)] flex items-baseline justify-between">
                    <span className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]">
                      До сплати
                    </span>
                    <span className="font-display text-2xl lg:text-3xl font-semibold tabular-nums">
                      {formatPrice(total)}
                    </span>
                  </div>

                  <Link
                    href="/checkout"
                    className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] px-6 py-4 text-sm tracking-[0.12em] uppercase hover:opacity-85 transition-opacity"
                  >
                    Оформити замовлення
                    <ArrowRight className="h-4 w-4" />
                  </Link>

                  <p className="mt-4 text-[11px] text-[var(--color-text-muted)] leading-relaxed text-center">
                    Безпечна оплата через LiqPay · Доставка Новою Поштою
                  </p>
                </div>
              </aside>
            </div>
          )}
        </Container>
      </main>
      <Footer />
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CartLine({
  item,
  onQty,
  onRemove,
}: {
  item: EffectiveCartItem;
  onQty: (n: number) => void;
  onRemove: () => void;
}) {
  return (
    <article className="flex items-center gap-4 lg:gap-5 rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-4 lg:p-5">
      <Link
        href={`/shop/${item.slug}`}
        className="block h-20 w-20 lg:h-24 lg:w-24 shrink-0 rounded-[var(--radius-lg)] overflow-hidden bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: item.thumb }}
        aria-label={item.name}
      />

      <div className="flex-1 min-w-0">
        <Link
          href={`/shop/${item.slug}`}
          className="font-display text-base lg:text-lg font-semibold leading-tight hover:opacity-70 transition-opacity"
        >
          {item.name}
        </Link>
        <p className="mt-1 text-xs text-[var(--color-text-muted)] tabular-nums">
          {item.weightLabel}
          {item.roast ? ` · ${item.roast}` : ""}
          {item.grind ? ` · ${item.grind}` : ""}
        </p>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)] tabular-nums flex items-center gap-2">
          {item.wholesaleActive && (
            <span className="text-[var(--color-text-muted)] line-through">
              {formatPrice(item.unitPrice)}
            </span>
          )}
          <span
            className={cn(
              item.wholesaleActive &&
                "text-[var(--color-text-primary)] font-medium",
            )}
          >
            {formatPrice(item.effectiveUnitPrice)} / шт
          </span>
        </p>
      </div>

      {/* Quantity stepper — inline, narrow */}
      <div className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border-strong)] p-0.5 shrink-0">
        <button
          type="button"
          onClick={() => onQty(Math.max(1, item.quantity - 1))}
          disabled={item.quantity <= 1}
          aria-label="Зменшити"
          className="grid h-8 w-8 place-items-center rounded-full hover:bg-[var(--color-bg-secondary)] transition-colors disabled:opacity-40"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-[2ch] text-center text-sm font-display font-medium tabular-nums">
          {item.quantity}
        </span>
        <button
          type="button"
          onClick={() => onQty(item.quantity + 1)}
          aria-label="Збільшити"
          className="grid h-8 w-8 place-items-center rounded-full hover:bg-[var(--color-bg-secondary)] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Line total — hidden on small mobile to keep row compact */}
      <div className="hidden sm:block text-right shrink-0 min-w-[5ch]">
        {item.wholesaleActive && (
          <p className="text-[11px] text-[var(--color-text-muted)] line-through tabular-nums">
            {formatPrice(item.unitPrice * item.quantity)}
          </p>
        )}
        <p className="font-display text-base lg:text-lg font-semibold tabular-nums">
          {formatPrice(item.effectiveUnitPrice * item.quantity)}
        </p>
      </div>

      <button
        type="button"
        onClick={onRemove}
        aria-label="Видалити"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-rose-700 hover:bg-rose-50 transition-colors"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </article>
  );
}

/* Old `ShippingNudge` removed — replaced by the shared
 * `<FreeShippingProgress />` component so cart, drawer, and checkout
 * all show the same nudge in the same place. */

function EmptyState() {
  return (
    <div className="rounded-[var(--radius-2xl)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-primary)] py-20 px-6 text-center">
      <ShoppingBag
        className="h-12 w-12 mx-auto text-[var(--color-text-muted)]"
        strokeWidth={1.2}
      />
      <h2 className="mt-6 font-display text-2xl lg:text-3xl font-semibold tracking-[-0.02em]">
        Поки порожньо.
      </h2>
      <p className="mt-3 text-[var(--color-text-secondary)] max-w-sm mx-auto leading-relaxed">
        Обери каву з каталогу — а ми вже почнемо обсмажувати. Або глянь
        бестселери на головній.
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] px-7 py-3.5 text-sm tracking-[0.12em] uppercase hover:opacity-85 transition-opacity"
        >
          У каталог
        </Link>
        <Link
          href="/subscription"
          className="inline-flex items-center gap-2 text-sm tracking-[0.12em] uppercase pb-1 border-b border-[var(--color-text-primary)] hover:opacity-70 transition-opacity"
        >
          Або підписатися
        </Link>
      </div>
    </div>
  );
}

function plural(n: number, forms: [string, string, string]): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
  return forms[2];
}
