"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Calendar, Check, Pause, Play, Repeat, Settings2, XOctagon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSubscription, type Subscription } from "@/lib/subscription-store";
import { formatPrice, cn } from "@/lib/utils";
import { EASING } from "@/lib/easing";

/** Available cadences shown in the "Змінити графік" picker. Mirrored from
 *  `/subscription/setup` — keep these two lists in sync if you add/remove
 *  intervals. Real fix: lift to a shared constants file when the variants
 *  start drifting. */
const INTERVAL_OPTIONS = [
  { days: 14, label: "Раз на 2 тижні" },
  { days: 21, label: "Раз на 3 тижні" },
  { days: 28, label: "Раз на місяць" },
] as const;

/**
 * Subscriptions tab — manage the active coffee subscription.
 *
 * Today we model a single active subscription per user (the mock data only
 * returns one). When we move to Supabase + multiple subscriptions this maps
 * to `subscriptions[]` and we render a card per row. The interactions —
 * pause, change schedule, cancel — already live as local state here so
 * we can wire them to real mutations without UI changes.
 */
/**
 * Top-level page — wraps the inner component in <Suspense> so Next.js
 * can statically prerender this route. `useSearchParams()` inside
 * `SubscriptionsInner` is a CSR-only API; the static build pass throws
 * without the boundary.
 */
export default function SubscriptionsPage() {
  return (
    <Suspense fallback={null}>
      <SubscriptionsInner />
    </Suspense>
  );
}

function SubscriptionsInner() {
  const sub = useSubscription((s) => s.current);
  const hydrated = useSubscription((s) => s.hydrated);
  const storeTogglePause = useSubscription((s) => s.togglePause);
  const storeCancel = useSubscription((s) => s.cancel);
  const storeReset = useSubscription((s) => s.reset);
  const storeUpdate = useSubscription((s) => s.update);

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(false);

  // Welcome banner after fresh signup — read once, dismiss on render. Avoids
  // leaving ?welcome=1 stuck in the URL.
  const params = useSearchParams();
  const showWelcome = params.get("welcome") === "1";
  const [welcomeVisible, setWelcomeVisible] = useState(showWelcome);
  useEffect(() => {
    if (showWelcome) {
      const t = window.setTimeout(() => setWelcomeVisible(false), 5000);
      return () => window.clearTimeout(t);
    }
  }, [showWelcome]);

  // Wait for hydration so we don't flash the empty state for users who
  // actually have a subscription persisted.
  if (!hydrated) return null;
  if (!sub) return <EmptyState />;

  const isPaused = sub.status === "paused";
  const isCancelled = sub.status === "cancelled";

  return (
    <div className="flex flex-col gap-7">
      <AnimatePresence>
        {welcomeVisible && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4, ease: EASING.smooth }}
            className="rounded-[var(--radius-xl)] border border-emerald-200 bg-emerald-50 px-5 py-4 overflow-hidden"
          >
            <p className="text-sm font-display font-semibold text-emerald-900">
              Підписку оформлено!
            </p>
            <p className="mt-1 text-xs text-emerald-800/85 leading-relaxed">
              Перше списання — за {sub.intervalDays} днів. Все керується звідси.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <header>
        <h2 className="font-display text-3xl font-semibold tracking-[-0.025em]">
          Підписка
        </h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Керуй регулярними доставками — пауза, графік, сорт, скасування.
        </p>
      </header>

      {/* Main subscription card */}
      <article className="relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-6 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <span className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] inline-flex items-center gap-2">
            <Repeat className="h-3.5 w-3.5" /> Активна підписка
          </span>
          <StatusPill status={sub.status} />
        </div>

        <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <span
            aria-hidden
            className="block h-20 w-20 shrink-0 rounded-[var(--radius-lg)]"
            style={{ backgroundImage: sub.thumb }}
          />
          <div className="min-w-0">
            <h3 className="font-display text-2xl font-semibold leading-tight">
              {sub.productName}
            </h3>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {sub.weightLabel}
              {sub.roast ? ` · ${sub.roast}` : ""} · раз на {sub.intervalDays}{" "}
              днів
            </p>
            <p className="mt-3 font-display text-xl font-semibold tabular-nums">
              {formatPrice(sub.pricePerCycle)} <span className="text-sm font-medium text-[var(--color-text-muted)]">/ доставка</span>
            </p>
          </div>
        </div>

        {!isCancelled && (
          <dl className="mt-7 pt-6 border-t border-[var(--color-border-default)] grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <div className="flex items-start gap-3">
              <Calendar className="h-4 w-4 shrink-0 text-[var(--color-text-muted)] mt-0.5" />
              <div>
                <dt className="text-[10px] tracking-[0.22em] uppercase text-[var(--color-text-muted)]">
                  Наступне списання
                </dt>
                <dd className="mt-1">
                  {isPaused ? (
                    <span className="text-[var(--color-text-muted)]">
                      На паузі
                    </span>
                  ) : (
                    new Date(sub.nextDate).toLocaleDateString("uk-UA", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })
                  )}
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Repeat className="h-4 w-4 shrink-0 text-[var(--color-text-muted)] mt-0.5" />
              <div>
                <dt className="text-[10px] tracking-[0.22em] uppercase text-[var(--color-text-muted)]">
                  Доставок здійснено
                </dt>
                <dd className="mt-1 tabular-nums">
                  {sub.cyclesShipped}
                </dd>
              </div>
            </div>
          </dl>
        )}

        {/* Actions */}
        {!isCancelled && (
          <div className="mt-7 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={storeTogglePause}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-strong)] px-5 py-2.5 text-sm hover:border-[var(--color-text-primary)] transition-colors"
            >
              {isPaused ? (
                <>
                  <Play className="h-3.5 w-3.5" /> Відновити
                </>
              ) : (
                <>
                  <Pause className="h-3.5 w-3.5" /> Призупинити
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setEditingSchedule((o) => !o)}
              aria-expanded={editingSchedule}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-strong)] px-5 py-2.5 text-sm hover:border-[var(--color-text-primary)] transition-colors"
            >
              <Settings2 className="h-3.5 w-3.5" /> Змінити графік
            </button>
            <Link
              href="/subscription/setup"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-strong)] px-5 py-2.5 text-sm hover:border-[var(--color-text-primary)] transition-colors"
            >
              <Repeat className="h-3.5 w-3.5" /> Замінити сорт
            </Link>
            <button
              type="button"
              onClick={() => setConfirmCancel(true)}
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm text-rose-700 hover:bg-rose-50 transition-colors"
            >
              <XOctagon className="h-3.5 w-3.5" /> Скасувати
            </button>
          </div>
        )}

        {/* Schedule picker — inline, no modal. Shifts the existing "next
            date" forward/back when interval changes so the new cadence
            takes effect from the current cycle, not retroactively. */}
        <AnimatePresence>
          {editingSchedule && !isCancelled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: EASING.smooth }}
              className="mt-6 overflow-hidden"
            >
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-5 py-4">
                <p className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] mb-3">
                  Як часто доставляти
                </p>
                <div className="flex flex-wrap gap-2">
                  {INTERVAL_OPTIONS.map((opt) => {
                    const active = opt.days === sub.intervalDays;
                    return (
                      <button
                        key={opt.days}
                        type="button"
                        onClick={() => {
                          if (active) {
                            setEditingSchedule(false);
                            return;
                          }
                          // Push next-billing date out by the new interval
                          // counted from today — feels predictable to the
                          // user, no surprise charges.
                          const next = new Date();
                          next.setDate(next.getDate() + opt.days);
                          storeUpdate({
                            intervalDays: opt.days,
                            nextDate: next.toISOString(),
                          });
                          setEditingSchedule(false);
                        }}
                        aria-pressed={active}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-all duration-300",
                          active
                            ? "bg-[var(--color-text-primary)] text-[var(--color-text-inverse)]"
                            : "border border-[var(--color-border-strong)] hover:border-[var(--color-text-primary)]",
                        )}
                      >
                        {active && <Check className="h-3.5 w-3.5" />}
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isCancelled && (
          <div className="mt-7 flex flex-col gap-4">
            <p className="text-sm text-[var(--color-text-secondary)]">
              Підписку скасовано. Дякуємо, що були з нами{" "}
              <span className="tabular-nums">{sub.cyclesShipped}</span>{" "}
              доставок.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/subscription/setup"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] px-5 py-2.5 text-sm hover:opacity-85 transition-opacity"
              >
                Оформити нову
              </Link>
              <button
                type="button"
                onClick={storeReset}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-strong)] px-5 py-2.5 text-sm hover:border-[var(--color-text-primary)] transition-colors"
              >
                Прибрати з історії
              </button>
            </div>
          </div>
        )}

        {/* Cancel confirmation — inline, no modal */}
        <AnimatePresence>
          {confirmCancel && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: EASING.smooth }}
              className="mt-6 overflow-hidden"
            >
              <div className="rounded-[var(--radius-lg)] border border-rose-200 bg-rose-50 px-5 py-4">
                <p className="text-sm text-rose-900 font-medium">
                  Точно скасовуємо підписку?
                </p>
                <p className="mt-1 text-xs text-rose-800/80">
                  Поточна знижка та бонуси буде втрачено. Можна оформити нову
                  в будь-який момент.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      storeCancel();
                      setConfirmCancel(false);
                    }}
                    className="rounded-full bg-rose-700 text-white px-4 py-2 text-xs hover:bg-rose-800 transition-colors"
                  >
                    Так, скасувати
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmCancel(false)}
                    className="rounded-full bg-white px-4 py-2 text-xs text-rose-900 hover:bg-rose-100 transition-colors"
                  >
                    Залишити
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </article>

      {/* Demo-mode hint — visible only while everything is local. */}
      <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
        Демо-режим: реальних списань зараз нема. Коли підключимо LiqPay
        recurring tokens — це саме інтерфейс, але дії стають справжніми.
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: Subscription["status"] }) {
  const map = {
    active: { label: "Активна", tone: "bg-emerald-100 text-emerald-800" },
    paused: { label: "На паузі", tone: "bg-amber-100 text-amber-900" },
    cancelled: { label: "Скасована", tone: "bg-rose-100 text-rose-800" },
  } as const;
  const cfg = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center text-[10px] tracking-[0.25em] uppercase rounded-full px-2.5 py-1",
        cfg.tone,
      )}
    >
      {cfg.label}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-primary)] py-14 px-6 text-center">
      <p className="font-display text-xl font-semibold">
        У тебе немає активної підписки.
      </p>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)] max-w-md mx-auto leading-relaxed">
        Оформи підписку — і свіжа кава приходитиме автоматично, з гнучким
        графіком, на твоїх умовах.
      </p>
      <Link
        href="/subscription/setup"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] px-6 py-3 text-sm hover:opacity-85 transition-opacity"
      >
        Оформити підписку
      </Link>
    </div>
  );
}
