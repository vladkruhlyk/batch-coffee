"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2, RotateCcw, Truck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  listOrders,
  statusLabel,
  statusTone,
  type Order,
  type OrderStatus,
  type OrderItem,
  getOrderWithItems,
} from "@/lib/orders";
import { PRODUCTS } from "@/data/products";
import { useCart } from "@/lib/cart-store";
import { useAuth } from "@/lib/auth-store";
import { formatPrice, cn } from "@/lib/utils";
import { EASING } from "@/lib/easing";

type Filter = "all" | "active" | "delivered";

const FILTER_LABELS: Record<Filter, string> = {
  all: "Усі",
  active: "Активні",
  delivered: "Доставлені",
};

const ACTIVE_STATUSES: OrderStatus[] = ["pending", "paid", "packing", "shipped"];

/**
 * Customer orders tab — now on real Supabase data.
 *
 * RLS narrows `listOrders()` to "own" automatically, so we don't pass
 * the user id explicitly. Items load lazily when a row is expanded —
 * keeps the initial payload small even for customers with many orders.
 */
export default function OrdersPage() {
  const router = useRouter();
  const addToCart = useCart((s) => s.add);
  const user = useAuth((s) => s.user);
  const hydrated = useAuth((s) => s.hydrated);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [itemsCache, setItemsCache] = useState<Record<string, OrderItem[]>>({});
  const [loadingItems, setLoadingItems] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated || !user) return;
    let cancelled = false;
    listOrders()
      .then((data) => {
        if (cancelled) return;
        setOrders(data);
        // Auto-open the most recent one — same as before.
        if (data.length > 0) setOpenId(data[0].id);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Не вдалось завантажити.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, user]);

  // Lazy-load items when an order opens for the first time.
  const expand = async (orderId: string) => {
    if (openId === orderId) {
      setOpenId(null);
      return;
    }
    setOpenId(orderId);
    if (!itemsCache[orderId]) {
      setLoadingItems(orderId);
      try {
        const fresh = await getOrderWithItems(orderId);
        if (fresh) {
          setItemsCache((prev) => ({ ...prev, [orderId]: fresh.items }));
        }
      } catch {
        // Surface only if needed — failing to load items in expand is
        // mostly recoverable on the next click.
      } finally {
        setLoadingItems(null);
      }
    }
  };

  /**
   * "Повторити замовлення" — replay items into the active cart and route
   * to /cart. Looks up the live Product (not the line snapshot) so the
   * price stays current. Items whose slug was delisted are skipped.
   */
  const reorder = async (order: Order) => {
    const items = itemsCache[order.id] ?? (
      (await getOrderWithItems(order.id))?.items ?? []
    );
    let added = 0;
    for (const item of items) {
      const product = PRODUCTS.find((p) => p.slug === item.productSlug);
      if (!product) continue;
      const weightIndex = product.weights.findIndex(
        (w) => w.label === item.weightLabel,
      );
      if (weightIndex < 0) continue;
      addToCart(product, {
        weightIndex,
        roast: item.roast ?? undefined,
        quantity: item.quantity,
      });
      added += 1;
    }
    if (added > 0) router.push("/cart");
  };

  const visible = useMemo(() => {
    if (filter === "all") return orders;
    if (filter === "active")
      return orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
    return orders.filter((o) => o.status === "delivered");
  }, [orders, filter]);

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-[-0.025em]">
            Замовлення
          </h2>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Історія, статуси доставки, повторне замовлення.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(FILTER_LABELS) as Filter[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={cn(
                "rounded-full px-4 py-2 text-xs tracking-wide transition-all duration-300",
                filter === key
                  ? "bg-[var(--color-text-primary)] text-[var(--color-text-inverse)]"
                  : "border border-[var(--color-border-strong)] text-[var(--color-text-primary)] hover:border-[var(--color-text-primary)]",
              )}
            >
              {FILTER_LABELS[key]}
            </button>
          ))}
        </div>
      </header>

      {error && (
        <p className="text-sm text-rose-700 rounded-[var(--radius-lg)] border border-rose-200 bg-rose-50 px-4 py-3">
          {error}
        </p>
      )}

      {loading ? (
        <div className="grid place-items-center py-14 text-[var(--color-text-muted)]">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((order) => {
            const isOpen = openId === order.id;
            const tone = statusTone(order.status);
            const items = itemsCache[order.id] ?? [];
            return (
              <li
                key={order.id}
                className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] overflow-hidden"
              >
                {/* Header row — always visible */}
                <button
                  type="button"
                  onClick={() => expand(order.id)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center gap-4 px-5 py-4 lg:px-7 lg:py-5 text-left hover:bg-[var(--color-bg-secondary)] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-display text-base lg:text-lg font-semibold tabular-nums">
                        {order.number}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center text-[10px] tracking-[0.25em] uppercase rounded-full px-2.5 py-1",
                          tone.bg,
                          tone.text,
                        )}
                      >
                        {statusLabel(order.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] tracking-[0.2em] uppercase text-[var(--color-text-muted)]">
                      {new Date(order.createdAt).toLocaleDateString("uk-UA", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <span className="font-display text-base lg:text-lg font-semibold tabular-nums">
                    {formatPrice(order.total)}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform duration-300",
                      isOpen && "rotate-180",
                    )}
                  />
                </button>

                {/* Expanded body */}
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="body"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: EASING.smooth }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-6 lg:px-7 lg:pb-7 border-t border-[var(--color-border-default)] pt-5">
                        {loadingItems === order.id && items.length === 0 ? (
                          <div className="grid place-items-center py-8 text-[var(--color-text-muted)]">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        ) : items.length > 0 ? (
                          <ul className="flex flex-col gap-3">
                            {items.map((it) => (
                              <li
                                key={it.id}
                                className="flex items-center gap-4"
                              >
                                <span
                                  aria-hidden
                                  className="block h-12 w-12 shrink-0 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)]"
                                  style={
                                    it.thumb
                                      ? { backgroundImage: it.thumb }
                                      : undefined
                                  }
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium leading-tight">
                                    {it.productName}
                                  </p>
                                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5 tabular-nums">
                                    {it.weightLabel}
                                    {it.roast ? ` · ${it.roast}` : ""} ·{" "}
                                    {it.quantity} шт
                                  </p>
                                </div>
                                <p className="text-sm font-display font-semibold tabular-nums shrink-0">
                                  {formatPrice(it.lineTotal)}
                                </p>
                              </li>
                            ))}
                          </ul>
                        ) : null}

                        {/* Meta — delivery + tracking */}
                        <dl className="mt-6 grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                          <div>
                            <dt className="text-[10px] tracking-[0.22em] uppercase text-[var(--color-text-muted)]">
                              Доставка
                            </dt>
                            <dd className="mt-1 text-[var(--color-text-primary)]">
                              {order.deliveryMethod === "pickup"
                                ? `Самовивіз · ${order.deliveryAddress}`
                                : `${order.deliveryCity ? order.deliveryCity + ", " : ""}${order.deliveryAddress}`}
                            </dd>
                          </div>
                          {order.trackingNumber && (
                            <div>
                              <dt className="text-[10px] tracking-[0.22em] uppercase text-[var(--color-text-muted)]">
                                ТТН
                              </dt>
                              <dd className="mt-1 inline-flex items-center gap-2 font-mono tabular-nums">
                                <Truck className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                                {order.trackingNumber}
                              </dd>
                            </div>
                          )}
                        </dl>

                        {/* Actions */}
                        <div className="mt-6 flex flex-wrap items-center gap-3">
                          <Link
                            href={`/order/${order.number}`}
                            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] px-5 py-2.5 text-sm hover:opacity-85 transition-opacity"
                          >
                            Деталі →
                          </Link>
                          <button
                            type="button"
                            onClick={() => reorder(order)}
                            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-strong)] px-5 py-2.5 text-sm text-[var(--color-text-primary)] hover:border-[var(--color-text-primary)] transition-colors"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Повторити замовлення
                          </button>
                          {order.trackingNumber && (
                            <a
                              href={`https://novaposhta.ua/tracking/?cargo_number=${order.trackingNumber}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                            >
                              Відстежити в Нової Пошти →
                            </a>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-primary)] py-14 px-6 text-center">
      <p className="font-display text-xl font-semibold">Поки порожньо.</p>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)] max-w-sm mx-auto leading-relaxed">
        Тут зʼявляться твої замовлення — пакування, відправлення, доставка.
      </p>
      <Link
        href="/shop"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] px-5 py-2.5 text-sm hover:opacity-85 transition-opacity"
      >
        У каталог
      </Link>
    </div>
  );
}
