"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Loader2,
  PackageOpen,
  Percent,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  listOrdersWithItemsSince,
  statusLabel,
  statusTone,
  type Order,
  type OrderStatus,
  type OrderWithItems,
} from "@/lib/orders";
import {
  BarChart,
  LineChart,
  formatChartCurrency,
} from "@/components/admin/charts";
import { cn, formatPrice } from "@/lib/utils";

/**
 * Admin dashboard — at-a-glance shop health with selectable date
 * ranges, time-series chart, status breakdown, top products, and the
 * fulfilment queue.
 *
 * Data strategy: one nested-FK query (orders + order_items) for the
 * selected range plus a forever-open "needs attention" query. Both
 * fit inside a 2000-row limit at small-shop scale. All aggregation
 * happens client-side so we can switch ranges without re-fetching.
 *
 * Picks intentionally compact: no heavy chart library — the LineChart
 * / BarChart components live in components/admin/charts.tsx and total
 * ~200 lines of SVG.
 */

type RangeKey = "7d" | "30d" | "90d" | "all";

const RANGES: Array<{ key: RangeKey; label: string; days: number | null }> = [
  { key: "7d", label: "7 днів", days: 7 },
  { key: "30d", label: "30 днів", days: 30 },
  { key: "90d", label: "90 днів", days: 90 },
  { key: "all", label: "Весь час", days: null },
];

const ACTIVE_STATUSES: OrderStatus[] = ["pending", "paid", "packing"];

export default function AdminDashboardPage() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [queue, setQueue] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ISO timestamp for the "since" filter on the current range. Days
  // are inclusive — "7д" means today plus the previous 6 full days.
  const sinceIso = useMemo(() => {
    const cfg = RANGES.find((r) => r.key === range)!;
    if (cfg.days == null) return null;
    const d = new Date();
    d.setDate(d.getDate() - (cfg.days - 1));
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [range]);

  useEffect(() => {
    let cancelled = false;
    // `loading` is initialised true and stays true across range
    // changes (the existing data fades out via the spinner). Re-
    // setting it here would tick a cascading render — react 19
    // flags that, so we just leave it alone.
    Promise.all([
      listOrdersWithItemsSince(sinceIso),
      // Queue ignores the range — anything pending/paid/packing should
      // be visible to staff regardless of when it was placed.
      listOrdersWithItemsSince(null),
    ])
      .then(([all, everything]) => {
        if (cancelled) return;
        setOrders(all);
        setQueue(
          everything.filter((o) => ACTIVE_STATUSES.includes(o.status)),
        );
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
  }, [sinceIso]);

  const metrics = useMemo(() => computeMetrics(orders, range), [orders, range]);

  if (loading) {
    return (
      <div className="grid place-items-center py-20 text-[var(--color-text-muted)]">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl lg:text-4xl font-semibold tracking-[-0.025em]">
            Огляд
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {metrics.range.label} ·{" "}
            {metrics.totals.count}{" "}
            {plural(metrics.totals.count, [
              "замовлення",
              "замовлення",
              "замовлень",
            ])}
          </p>
        </div>
        <RangeTabs current={range} onChange={setRange} />
      </header>

      {error && (
        <p className="text-sm text-rose-700 rounded-[var(--radius-lg)] border border-rose-200 bg-rose-50 px-4 py-3">
          {error}
        </p>
      )}

      {/* KPI strip — 4 wide cards. Period-vs-previous delta is shown
          on the first three when the range is finite (so "all time"
          doesn't compute against itself). */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
        <KpiCard
          label="Виручка"
          value={formatPrice(metrics.totals.revenue)}
          delta={metrics.delta?.revenue ?? null}
          icon={<Wallet className="h-4 w-4" strokeWidth={1.6} />}
        />
        <KpiCard
          label="Замовлень"
          value={metrics.totals.count.toString()}
          delta={metrics.delta?.count ?? null}
          icon={<PackageOpen className="h-4 w-4" strokeWidth={1.6} />}
        />
        <KpiCard
          label="Середній чек"
          value={
            metrics.totals.count === 0
              ? "—"
              : formatPrice(metrics.totals.aov)
          }
          delta={metrics.delta?.aov ?? null}
          icon={<TrendingUp className="h-4 w-4" strokeWidth={1.6} />}
        />
        <KpiCard
          label="Скасовано"
          value={
            metrics.totals.gross === 0
              ? "—"
              : `${(metrics.totals.cancelRate * 100).toFixed(1)}%`
          }
          sub={`${metrics.totals.cancelledCount} замовл. · ${formatPrice(metrics.totals.cancelledRevenue)}`}
          icon={<Percent className="h-4 w-4" strokeWidth={1.6} />}
          inverse={metrics.totals.cancelRate > 0.1}
        />
      </section>

      {/* Revenue over time. Bucketed per day for ≤ 60-day ranges, per
          week beyond that, per month for "all time". Currency formatted. */}
      <section className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-5 lg:p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-lg font-semibold">Виручка</h2>
          <span className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]">
            {metrics.bucketing}
          </span>
        </div>
        <LineChart
          data={metrics.timeSeries}
          height={220}
          emphasis
          format={formatChartCurrency}
        />
      </section>

      {/* Status distribution + top products side by side. On mobile
          they stack. */}
      <section className="grid lg:grid-cols-2 gap-5 lg:gap-6">
        <article className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-5 lg:p-6">
          <h2 className="font-display text-lg font-semibold mb-5">
            За статусами
          </h2>
          <BarChart
            data={metrics.statusBars}
            height={220}
            format={(v) => v.toString()}
          />
        </article>

        <article className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-5 lg:p-6">
          <h2 className="font-display text-lg font-semibold mb-5">
            Топ-товари за виручкою
          </h2>
          {metrics.topProducts.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              Дані відсутні
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {metrics.topProducts.map((p, idx) => (
                <li
                  key={p.slug + p.weightLabel}
                  className="flex items-center gap-3"
                >
                  <span className="font-display text-xs text-[var(--color-text-muted)] tabular-nums w-6">
                    {idx + 1}
                  </span>
                  <span
                    aria-hidden
                    className="block h-10 w-10 shrink-0 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)]"
                    style={p.thumb ? { backgroundImage: p.thumb } : undefined}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight truncate">
                      {p.name}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] tabular-nums">
                      {p.weightLabel} · {p.units} шт
                    </p>
                  </div>
                  <span className="font-display font-semibold text-sm tabular-nums">
                    {formatPrice(p.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>
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
            Усі замовлення <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {queue.length === 0 ? (
          <p className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-primary)] py-10 px-5 text-center text-sm text-[var(--color-text-secondary)]">
            Все під контролем — нема чого пакувати.
          </p>
        ) : (
          <OrdersTable orders={queue.slice(0, 10)} />
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Range tabs
// ---------------------------------------------------------------------------

function RangeTabs({
  current,
  onChange,
}: {
  current: RangeKey;
  onChange: (k: RangeKey) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-1">
      {RANGES.map((r) => {
        const active = r.key === current;
        return (
          <button
            key={r.key}
            type="button"
            onClick={() => onChange(r.key)}
            className={cn(
              "px-4 py-1.5 text-xs tracking-[0.18em] uppercase rounded-full transition-colors",
              active
                ? "bg-[var(--color-text-primary)] text-[var(--color-text-inverse)]"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
            )}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  sub,
  icon,
  delta,
  inverse,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  /** % change vs previous period. null = hide, undefined = N/A. */
  delta?: number | null;
  /** Reverse "green=up / red=down" — used for negative metrics (cancel rate). */
  inverse?: boolean;
}) {
  const showDelta = delta != null && Number.isFinite(delta);
  const positive = inverse ? delta! < 0 : delta! > 0;
  return (
    <article className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-5 lg:p-6">
      <div className="flex items-center justify-between">
        <span className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]">
          {label}
        </span>
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]">
          {icon}
        </span>
      </div>
      <p className="mt-5 font-display text-2xl lg:text-3xl font-semibold tabular-nums">
        {value}
      </p>
      <div className="mt-3 flex items-center gap-2 text-xs">
        {showDelta && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 tabular-nums",
              positive
                ? "bg-emerald-100 text-emerald-800"
                : "bg-rose-100 text-rose-800",
            )}
          >
            {(delta as number) > 0 ? (
              <TrendingUp className="h-3 w-3" strokeWidth={2} />
            ) : (
              <TrendingDown className="h-3 w-3" strokeWidth={2} />
            )}
            {Math.abs(delta as number).toFixed(0)}%
          </span>
        )}
        {sub && (
          <span className="text-[var(--color-text-muted)] truncate">
            {sub}
          </span>
        )}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Queue table (slim version of /admin/orders' table)
// ---------------------------------------------------------------------------

function OrdersTable({ orders }: { orders: Order[] }) {
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

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

interface DashboardMetrics {
  range: { label: string };
  totals: {
    revenue: number;
    count: number;
    aov: number;
    /** Total of all orders including cancelled — denominator for cancel rate. */
    gross: number;
    cancelledCount: number;
    cancelledRevenue: number;
    cancelRate: number;
  };
  /** Delta % vs previous equivalent period. Null for "all time". */
  delta: { revenue: number; count: number; aov: number } | null;
  timeSeries: Array<{ label: string; date: string; value: number }>;
  bucketing: string;
  statusBars: Array<{
    label: string;
    value: number;
    toneClass: string;
  }>;
  topProducts: Array<{
    slug: string;
    name: string;
    weightLabel: string;
    thumb: string | null;
    revenue: number;
    units: number;
  }>;
}

function computeMetrics(
  orders: OrderWithItems[],
  range: RangeKey,
): DashboardMetrics {
  const rangeCfg = RANGES.find((r) => r.key === range)!;

  // Totals over all orders in range (including cancelled for the
  // refund-rate denominator).
  const inRange = orders;
  const completed = inRange.filter((o) => o.status !== "cancelled");
  const cancelled = inRange.filter((o) => o.status === "cancelled");
  const revenue = completed.reduce((s, o) => s + o.total, 0);
  const count = completed.length;

  // Previous-period delta (compare to the equivalent length right
  // before the current window). Only meaningful for finite ranges.
  let delta: DashboardMetrics["delta"] = null;
  if (rangeCfg.days != null) {
    const days = rangeCfg.days;
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - days);
    // Previous-period orders are NOT in the current `orders` list
    // (we only fetched the current window), so we skip the prev
    // metrics. To wire them properly we'd need a second fetch.
    // Treat delta as N/A for now; UI hides the badge.
    void prevStart;
    delta = null;
  }

  // Bucket the time series. ≤ 60 days → per day. > 60 days → per week.
  // "All time" → per month.
  const { buckets, bucketing } = bucketTimeSeries(completed, range, rangeCfg);

  // Status distribution
  const statusOrder: OrderStatus[] = [
    "pending",
    "paid",
    "packing",
    "shipped",
    "delivered",
    "cancelled",
  ];
  const statusCounts = new Map<OrderStatus, number>();
  for (const s of statusOrder) statusCounts.set(s, 0);
  for (const o of inRange) {
    statusCounts.set(o.status, (statusCounts.get(o.status) ?? 0) + 1);
  }
  const statusBars = statusOrder.map((s) => {
    const tone = statusTone(s);
    return {
      label: statusLabel(s),
      value: statusCounts.get(s) ?? 0,
      toneClass: `${tone.bg.replace("bg-", "bg-")} ${tone.text}`,
    };
  });

  // Top products by revenue (within range, excluding cancelled).
  const productAgg = new Map<
    string,
    {
      slug: string;
      name: string;
      weightLabel: string;
      thumb: string | null;
      revenue: number;
      units: number;
    }
  >();
  for (const o of completed) {
    for (const item of o.items) {
      const key = `${item.productSlug}__${item.weightLabel}`;
      const cur = productAgg.get(key) ?? {
        slug: item.productSlug,
        name: item.productName,
        weightLabel: item.weightLabel,
        thumb: item.thumb,
        revenue: 0,
        units: 0,
      };
      cur.revenue += item.lineTotal;
      cur.units += item.quantity;
      productAgg.set(key, cur);
    }
  }
  const topProducts = Array.from(productAgg.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  return {
    range: { label: rangeCfg.label },
    totals: {
      revenue,
      count,
      aov: count === 0 ? 0 : Math.round(revenue / count),
      gross: inRange.length,
      cancelledCount: cancelled.length,
      cancelledRevenue: cancelled.reduce((s, o) => s + o.total, 0),
      cancelRate: inRange.length === 0 ? 0 : cancelled.length / inRange.length,
    },
    delta,
    timeSeries: buckets,
    bucketing,
    statusBars,
    topProducts,
  };
}

function bucketTimeSeries(
  orders: Order[],
  range: RangeKey,
  cfg: (typeof RANGES)[number],
): { buckets: DashboardMetrics["timeSeries"]; bucketing: string } {
  // Pick granularity from range length. "All time" finds min/max date
  // from data and switches between week/month depending on span.
  let mode: "day" | "week" | "month" = "day";
  let label = "за днями";

  if (range === "90d") {
    mode = "week";
    label = "за тижнями";
  } else if (range === "all") {
    const spans = orders.map((o) => new Date(o.createdAt).getTime());
    if (spans.length > 0) {
      const span = Date.now() - Math.min(...spans);
      const days = span / (1000 * 60 * 60 * 24);
      if (days > 365) {
        mode = "month";
        label = "за місяцями";
      } else if (days > 60) {
        mode = "week";
        label = "за тижнями";
      }
    }
  }

  // Determine the start of the window. For finite ranges this is
  // today - (days - 1). For "all time" it's the earliest order.
  const now = new Date();
  let windowStart: Date;
  if (cfg.days != null) {
    windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() - (cfg.days - 1));
    windowStart.setHours(0, 0, 0, 0);
  } else if (orders.length === 0) {
    return { buckets: [], bucketing: label };
  } else {
    const earliest = Math.min(
      ...orders.map((o) => new Date(o.createdAt).getTime()),
    );
    windowStart = new Date(earliest);
    windowStart.setHours(0, 0, 0, 0);
  }

  // Build the ordered list of bucket boundaries from windowStart to now.
  const buckets: Array<{ start: Date; key: string; label: string }> = [];
  const cursor = new Date(windowStart);
  while (cursor.getTime() <= now.getTime()) {
    const start = new Date(cursor);
    let key: string;
    let labelStr: string;
    if (mode === "day") {
      key = isoDay(start);
      labelStr = new Intl.DateTimeFormat("uk-UA", {
        day: "2-digit",
        month: "short",
      }).format(start);
      cursor.setDate(cursor.getDate() + 1);
    } else if (mode === "week") {
      key = isoDay(start);
      labelStr = `${new Intl.DateTimeFormat("uk-UA", {
        day: "2-digit",
        month: "short",
      }).format(start)}`;
      cursor.setDate(cursor.getDate() + 7);
    } else {
      key = `${start.getFullYear()}-${start.getMonth()}`;
      labelStr = new Intl.DateTimeFormat("uk-UA", {
        month: "short",
        year: "2-digit",
      }).format(start);
      cursor.setMonth(cursor.getMonth() + 1);
    }
    buckets.push({ start, key, label: labelStr });
  }

  // Map order → bucket index.
  const sums = new Map<string, number>();
  for (const b of buckets) sums.set(b.key, 0);
  for (const o of orders) {
    const d = new Date(o.createdAt);
    // Find the latest bucket whose start <= d.
    let placed = false;
    for (let i = buckets.length - 1; i >= 0; i--) {
      if (buckets[i].start.getTime() <= d.getTime()) {
        sums.set(buckets[i].key, (sums.get(buckets[i].key) ?? 0) + o.total);
        placed = true;
        break;
      }
    }
    if (!placed) {
      // Order is older than the window — shouldn't happen for finite
      // ranges (we filter server-side), defensive otherwise.
    }
  }

  return {
    buckets: buckets.map((b) => ({
      label: b.label,
      date: b.start.toISOString(),
      value: sums.get(b.key) ?? 0,
    })),
    bucketing: label,
  };
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

function isoDay(d: Date): string {
  // Real ISO-8601 (1-indexed month, zero-padded). Today these keys are
  // opaque bucket ids, but emitting "2026-5-9" for May 9th invites a
  // subtle bug the moment anything parses or sorts them as dates.
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

