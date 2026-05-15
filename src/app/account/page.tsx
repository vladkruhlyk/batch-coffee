"use client";

import Link from "next/link";
import { ArrowRight, Calendar, Package, Repeat, Sparkles } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import {
  getMockOrders,
  getMockSubscription,
  statusLabel,
  statusTone,
} from "@/data/mock-account";
import { useAuth } from "@/lib/auth-store";

/**
 * Account dashboard — the landing tab inside the cabinet.
 *
 * Three snapshot cards: subscription, loyalty points, last order. Each
 * card answers "what's happening right now" without forcing the user to
 * drill into a sub-page. Tapping any CTA navigates to the full surface.
 */
export default function AccountPage() {
  const user = useAuth((s) => s.user);
  const orders = getMockOrders();
  const subscription = getMockSubscription();
  const lastOrder = orders[0];

  // Demo loyalty number — tied to subscription cycles for variety. Replace
  // with a real `getLoyaltyPoints()` once the program ships.
  const loyaltyPoints = (subscription?.cyclesShipped ?? 0) * 75 + 230;

  return (
    <div className="flex flex-col gap-5 lg:gap-7">
      {/* Subscription + loyalty — two snapshot cards side by side */}
      <div className="grid sm:grid-cols-2 gap-5 lg:gap-7">
        {subscription && (
          <article className="relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-6 lg:p-7">
            <div className="flex items-start justify-between gap-3 mb-5">
              <span className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] inline-flex items-center gap-2">
                <Repeat className="h-3.5 w-3.5" /> Підписка
              </span>
              {/* Was "Активна" green pill while subscription was mocked
                  as live. Until the recurring flow ships, the card shows
                  a "Скоро" placeholder so we don't tell every user they
                  have an active sub when they don't. */}
              <span className="inline-flex items-center text-[10px] tracking-[0.25em] uppercase rounded-full px-2.5 py-1 bg-amber-100 text-amber-800">
                Скоро
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span
                aria-hidden
                className="block h-14 w-14 shrink-0 rounded-[var(--radius-lg)]"
                style={{ backgroundImage: subscription.thumb }}
              />
              <div className="min-w-0">
                <h3 className="font-display text-lg font-semibold leading-tight">
                  {subscription.productName}
                </h3>
                <p className="mt-0.5 text-sm text-[var(--color-text-muted)] truncate">
                  {subscription.weightLabel}
                  {subscription.roast ? ` · ${subscription.roast}` : ""} · раз
                  на {subscription.intervalDays} днів
                </p>
              </div>
            </div>
            {/* `flex` (not `inline-flex`) — keeps the row at block-level so
                the "Керувати" link below starts on its own line instead of
                snapping inline next to the date. */}
            <p className="mt-5 text-sm text-[var(--color-text-secondary)] flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
              <span>
                Наступне списання{" "}
                <span className="text-[var(--color-text-primary)] font-medium">
                  {formatRelativeDate(subscription.nextDate)}
                </span>
              </span>
            </p>
            {/* "Керувати" was a deep link into /account/subscriptions
                management. Replaced by a non-interactive label so the
                user can't get into the management UI before subscriptions
                actually run. Put the Link back once subscriptions ship. */}
            <span className="mt-6 self-start inline-flex items-center gap-2 text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] pb-1 border-b border-dashed border-[var(--color-border-default)]">
              Керування — скоро
            </span>
          </article>
        )}

        {/* Loyalty card — dark contrast tile, echoes the newsletter block. */}
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
              {loyaltyPoints}
            </p>
            {/* Drop the previous `max-w-xs` cap — at 320px the line breaks
                fell mid-phrase ("оформленні — підключимо коли чекаут вийде
                у / бій."). Card itself constrains width via the grid. */}
            <p className="mt-3 text-sm text-white/60 leading-relaxed">
              1 ₴ = 1 бал. Витрачай на знижку при оформленні — підключимо
              коли чекаут вийде у бій.
            </p>
          </div>
        </article>
      </div>

      {/* Last order — full-width card with item previews. */}
      {lastOrder && (
        <article className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-6 lg:p-7">
          <div className="flex items-start justify-between gap-3 mb-5">
            <span className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] inline-flex items-center gap-2">
              <Package className="h-3.5 w-3.5" /> Останнє замовлення
            </span>
            <span
              className={`inline-flex items-center text-[10px] tracking-[0.25em] uppercase rounded-full px-2.5 py-1 ${statusTone(lastOrder.status)}`}
            >
              {statusLabel(lastOrder.status)}
            </span>
          </div>

          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <p className="font-display text-xl font-semibold tabular-nums">
                {lastOrder.number}
              </p>
              <p className="mt-1 text-[11px] tracking-[0.2em] uppercase text-[var(--color-text-muted)]">
                {new Date(lastOrder.createdAt).toLocaleDateString("uk-UA", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <div className="flex-1" />
            <p className="font-display text-xl font-semibold tabular-nums">
              {formatPrice(lastOrder.total)}
            </p>
          </div>

          <ul className="mt-6 flex flex-wrap gap-3">
            {lastOrder.items.map((item) => (
              <li
                key={item.slug + item.weightLabel + (item.roast ?? "")}
                className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--color-bg-secondary)] px-3 py-2.5"
              >
                <span
                  aria-hidden
                  className="block h-9 w-9 shrink-0 rounded-md"
                  style={{ backgroundImage: item.thumb }}
                />
                <div className="text-sm leading-tight">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-[var(--color-text-muted)] tabular-nums">
                    {item.weightLabel} · {item.quantity} шт
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <Link
            href="/account/orders"
            className="mt-6 inline-flex items-center gap-2 text-[11px] tracking-[0.3em] uppercase border-b border-[var(--color-text-primary)] pb-1 hover:opacity-60 transition-opacity"
          >
            Усі замовлення <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </article>
      )}

      {/* Quick links — compact row, secondary actions */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Link
          href="/shop"
          className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] px-5 py-4 text-sm hover:border-[var(--color-text-primary)] transition-colors"
        >
          <span>Купити каву ще раз</span>
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

/**
 * Human "next billing" line — "сьогодні", "завтра", "через 5 днів",
 * or a calendar date when more than a week out. Kept inline so the
 * dashboard doesn't pull a date library just for this one usage.
 */
function formatRelativeDate(iso: string): string {
  const target = new Date(iso);
  const today = new Date();
  // Compare at day granularity — billing happens at midnight UTC on the
  // scheduled date, but the user thinks in local "tomorrow / next Friday".
  const dayMs = 1000 * 60 * 60 * 24;
  const diff = Math.round(
    (target.getTime() - today.getTime()) / dayMs,
  );
  if (diff <= 0) return "сьогодні";
  if (diff === 1) return "завтра";
  if (diff <= 7) return `через ${diff} ${pluralDays(diff)}`;
  return target.toLocaleDateString("uk-UA", {
    day: "2-digit",
    month: "long",
  });
}

function pluralDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "дні";
  return "днів";
}
