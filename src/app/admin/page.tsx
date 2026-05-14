"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Loader2,
  PackageOpen,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  listOrders,
  statusLabel,
  statusTone,
  type Order,
} from "@/lib/orders";
import { cn, formatPrice } from "@/lib/utils";

/**
 * Admin dashboard — at-a-glance view of how the shop is doing.
 *
 * Three timeframe cards (today / this week / this month) showing
 * order count, gross revenue, and average order value. A
 * fulfilment queue widget below highlights anything currently
 * needing attention (pending / paid / packing).
 *
 * Data strategy: one query for the last 30 days, partitioned in
 * memory; one query for the open-status queue. Both are tiny
 * payloads at shop scale, so we don't bother with a server-side
 * RPC.
 */
export default function AdminDashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [queue, setQueue] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listOrders({ limit: 500 }),
      // We could do this in one query but two keeps the code easier
      // to extend (e.g. separate queue card later). RLS bypasses the
      // round-trip cost anyway.
      Promise.all([
        listOrders({ status: "pending" }),
        listOrders({ status: "paid" }),
        listOrders({ status: "packing" }),
      ]).then((groups) => groups.flat()),
    ])
      .then(([all, openQueue]) => {
        if (cancelled) return;
        setOrders(all);
        setQueue(openQueue);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Не вдалось завантажити.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const buckets = useMemo(() => bucketOrders(orders), [orders]);

  if (loading) {
    return (
      <div className="grid place-items-center py-20 text-[var(--color-text-muted)]">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-display text-3xl lg:text-4xl font-semibold tracking-[-0.025em]">
          Огляд
        </h1>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Швидкий зріз того, що відбувається в магазині.
        </p>
      </header>

      {error && (
        <p className="text-sm text-rose-700 rounded-[var(--radius-lg)] border border-rose-200 bg-rose-50 px-4 py-3">
          {error}
        </p>
      )}

      {/* KPI cards */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
        <KpiCard
          eyebrow="Сьогодні"
          stats={buckets.today}
          icon={<TrendingUp className="h-4 w-4" strokeWidth={1.6} />}
        />
        <KpiCard
          eyebrow="Цей тиждень"
          stats={buckets.week}
          icon={<Wallet className="h-4 w-4" strokeWidth={1.6} />}
        />
        <KpiCard
          eyebrow="Цей місяць"
          stats={buckets.month}
          icon={<PackageOpen className="h-4 w-4" strokeWidth={1.6} />}
        />
      </section>

      {/* Fulfilment queue */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-semibold">
            Потребує уваги
          </h2>
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            Всі замовлення <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {queue.length === 0 ? (
          <p className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-primary)] py-10 px-5 text-center text-sm text-[var(--color-text-secondary)]">
            Все під контролем — нема чого пакувати.
          </p>
        ) : (
          <QueueTable orders={queue} />
        )}
      </section>

      {/* Recent orders */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-semibold">Останні</h2>
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            Всі замовлення <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {orders.length === 0 ? (
          <p className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-primary)] py-10 px-5 text-center text-sm text-[var(--color-text-secondary)]">
            Замовлень поки немає.
          </p>
        ) : (
          <QueueTable orders={orders.slice(0, 8)} />
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------

interface Bucket {
  count: number;
  revenue: number;
  aov: number;
}

function bucketOrders(orders: Order[]): {
  today: Bucket;
  week: Bucket;
  month: Bucket;
} {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const week = new Date(today);
  week.setDate(week.getDate() - 7);
  const month = new Date(today);
  month.setDate(month.getDate() - 30);

  const aggregate = (since: Date): Bucket => {
    const filtered = orders.filter((o) => {
      if (o.status === "cancelled") return false;
      return new Date(o.createdAt) >= since;
    });
    const revenue = filtered.reduce((sum, o) => sum + o.total, 0);
    return {
      count: filtered.length,
      revenue,
      aov: filtered.length === 0 ? 0 : Math.round(revenue / filtered.length),
    };
  };

  return {
    today: aggregate(today),
    week: aggregate(week),
    month: aggregate(month),
  };
}

function KpiCard({
  eyebrow,
  stats,
  icon,
}: {
  eyebrow: string;
  stats: Bucket;
  icon: React.ReactNode;
}) {
  return (
    <article className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-5 lg:p-6">
      <div className="flex items-center justify-between">
        <span className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]">
          {eyebrow}
        </span>
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]">
          {icon}
        </span>
      </div>
      <p className="mt-5 font-display text-3xl lg:text-4xl font-semibold tabular-nums">
        {formatPrice(stats.revenue)}
      </p>
      <dl className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[var(--color-text-secondary)]">
        <div className="flex items-center gap-2">
          <dt>Замовлень</dt>
          <dd className="font-display text-sm font-semibold text-[var(--color-text-primary)] tabular-nums">
            {stats.count}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt>AOV</dt>
          <dd className="font-display text-sm font-semibold text-[var(--color-text-primary)] tabular-nums">
            {stats.count === 0 ? "—" : formatPrice(stats.aov)}
          </dd>
        </div>
      </dl>
    </article>
  );
}

function QueueTable({ orders }: { orders: Order[] }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] tracking-[0.18em] uppercase text-[var(--color-text-muted)] border-b border-[var(--color-border-default)]">
            <th className="py-3 px-5 font-medium">Номер</th>
            <th className="py-3 px-5 font-medium">Клієнт</th>
            <th className="py-3 px-5 font-medium">Дата</th>
            <th className="py-3 px-5 font-medium">Статус</th>
            <th className="py-3 px-5 font-medium text-right">Сума</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const tone = statusTone(order.status);
            return (
              <tr
                key={order.id}
                className="border-b last:border-0 border-[var(--color-border-default)] hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                <td className="py-3 px-5 font-display tabular-nums">
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="font-semibold hover:opacity-70 transition-opacity"
                  >
                    {order.number}
                  </Link>
                </td>
                <td className="py-3 px-5">
                  {order.recipientFirstName} {order.recipientLastName}
                </td>
                <td className="py-3 px-5 text-[var(--color-text-secondary)] tabular-nums">
                  {formatShortDate(order.createdAt)}
                </td>
                <td className="py-3 px-5">
                  <span
                    className={cn(
                      "inline-flex items-center text-[10px] tracking-[0.2em] uppercase rounded-full px-2.5 py-1",
                      tone.bg,
                      tone.text,
                    )}
                  >
                    {statusLabel(order.status)}
                  </span>
                </td>
                <td className="py-3 px-5 text-right font-display font-semibold tabular-nums">
                  {formatPrice(order.total)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
