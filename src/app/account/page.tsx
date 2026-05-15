"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Loader2,
  Package,
  Repeat,
  Sparkles,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";
import {
  listOrders,
  statusLabel,
  statusTone,
  type Order,
} from "@/lib/orders";
import { useAuth } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

/**
 * Account dashboard — the landing tab inside the cabinet.
 *
 * Three snapshot cards: subscription teaser, loyalty teaser, last
 * order. Now backed by real data:
 *
 *   - Subscription: still mocked-state-free — neither the recurring
 *     flow nor the per-user subscription rows exist yet, so every
 *     user sees the same "скоро" placeholder card. Removing it
 *     entirely would leave a half-empty grid; keeping it preserves
 *     the visual rhythm and tells customers what's coming.
 *   - Loyalty: same shape — 0 balls until the program ships.
 *   - Last order: read from Supabase via listOrders(). Empty-state
 *     prompt when the customer has nothing yet.
 */
export default function AccountPage() {
  const user = useAuth((s) => s.user);
  const hydrated = useAuth((s) => s.hydrated);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hydrated || !user) return;
    let cancelled = false;
    listOrders({ limit: 1 })
      .then((data) => {
        if (!cancelled) setOrders(data);
      })
      .catch(() => {
        /* fail silently — empty-state will show */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, user]);

  const lastOrder = orders[0] ?? null;
  const loyaltyPoints = 0; // Real accrual lands when the bonus
  //                          program ships; everyone shows 0 today.

  return (
    <div className="flex flex-col gap-5 lg:gap-7">
      {/* Subscription + loyalty — two snapshot cards side by side */}
      <div className="grid sm:grid-cols-2 gap-5 lg:gap-7">
        <SubscriptionPlaceholderCard />
        <LoyaltyCard points={loyaltyPoints} />
      </div>

      {/* Last order — full-width card with item previews. */}
      {loading ? (
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] py-10 grid place-items-center text-[var(--color-text-muted)]">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : lastOrder ? (
        <LastOrderCard order={lastOrder} />
      ) : (
        <EmptyOrdersCard />
      )}

      {/* Quick links — compact row, secondary actions */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Link
          href="/shop"
          className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] px-5 py-4 text-sm hover:border-[var(--color-text-primary)] transition-colors"
        >
          <span>{lastOrder ? "Купити каву ще раз" : "У каталог"}</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/account/profile"
          className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] px-5 py-4 text-sm hover:border-[var(--color-text-primary)] transition-colors"
        >
          <span>
            Дозаповнити профіль
            {user?.firstName ? "" : " (імʼя ще не вказане)"}
          </span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function SubscriptionPlaceholderCard() {
  return (
    <article className="relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-6 lg:p-7">
      <div className="flex items-start justify-between gap-3 mb-5">
        <span className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] inline-flex items-center gap-2">
          <Repeat className="h-3.5 w-3.5" /> Підписка
        </span>
        <span className="inline-flex items-center text-[10px] tracking-[0.25em] uppercase rounded-full px-2.5 py-1 bg-amber-100 text-amber-800">
          Скоро
        </span>
      </div>
      <p className="font-display text-lg font-semibold leading-tight">
        Свіжа кава щомісяця, без зайвих рухів.
      </p>
      <p className="mt-3 text-sm text-[var(--color-text-secondary)] leading-relaxed">
        Підписка отримає автосписання й автодоставку — як тільки ми
        підключимо платіжку. Знижку для підписників теж відразу
        активуємо.
      </p>
      <span className="mt-6 self-start inline-flex items-center gap-2 text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] pb-1 border-b border-dashed border-[var(--color-border-default)]">
        Запис у вейтлист — скоро
      </span>
    </article>
  );
}

function LoyaltyCard({ points }: { points: number }) {
  return (
    <article className="relative overflow-hidden rounded-[var(--radius-xl)] bg-[var(--color-bg-dark)] text-[var(--color-text-inverse)] p-6 lg:p-7">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 85% 20%, rgba(201,144,86,0.28) 0%, transparent 55%)",
        }}
      />
      <div className="relative">
        <span className="text-[11px] tracking-[0.3em] uppercase text-white/55 inline-flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5" /> Бали лояльності
        </span>
        <p className="mt-5 font-display text-5xl lg:text-6xl font-semibold tabular-nums leading-none">
          {points}
        </p>
        <p className="mt-3 text-sm text-white/60 leading-relaxed">
          1 ₴ = 1 бал. Витрачай на знижку при оформленні — підключимо
          коли запустимо бонусну програму.
        </p>
      </div>
    </article>
  );
}

function LastOrderCard({ order }: { order: Order }) {
  const tone = statusTone(order.status);
  return (
    <article className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-6 lg:p-7">
      <div className="flex items-start justify-between gap-3 mb-5">
        <span className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] inline-flex items-center gap-2">
          <Package className="h-3.5 w-3.5" /> Останнє замовлення
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

      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <p className="font-display text-xl font-semibold tabular-nums">
            {order.number}
          </p>
          <p className="mt-1 text-[11px] tracking-[0.2em] uppercase text-[var(--color-text-muted)]">
            {new Date(order.createdAt).toLocaleDateString("uk-UA", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="flex-1" />
        <p className="font-display text-xl font-semibold tabular-nums">
          {formatPrice(order.total)}
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href={`/order/${order.number}?token=${order.viewToken}`}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] px-5 py-2.5 text-sm hover:opacity-85 transition-opacity"
        >
          Деталі замовлення →
        </Link>
        <Link
          href="/account/orders"
          className="inline-flex items-center gap-2 text-[11px] tracking-[0.3em] uppercase border-b border-[var(--color-text-primary)] pb-1 hover:opacity-60 transition-opacity"
        >
          Усі замовлення <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  );
}

function EmptyOrdersCard() {
  return (
    <article className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-primary)] p-8 lg:p-10 text-center">
      <span className="grid mx-auto h-10 w-10 place-items-center rounded-full bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]">
        <Package className="h-4 w-4" strokeWidth={1.6} />
      </span>
      <p className="mt-4 font-display text-lg font-semibold">
        Замовлень поки немає.
      </p>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)] max-w-md mx-auto leading-relaxed">
        Це твій кабінет. Сюди прилітатимуть замовлення, бали лояльності й
        майбутня підписка. Перший крок — обрати каву в каталозі.
      </p>
      <Link
        href="/shop"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] px-6 py-3 text-sm tracking-[0.12em] uppercase hover:opacity-85 transition-opacity"
      >
        У каталог
      </Link>
    </article>
  );
}
