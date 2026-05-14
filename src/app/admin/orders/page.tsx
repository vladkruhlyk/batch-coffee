"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import {
  listOrders,
  statusLabel,
  statusTone,
  ORDER_STATUSES,
  type Order,
  type OrderStatus,
} from "@/lib/orders";
import { formatPrice, cn } from "@/lib/utils";

/**
 * Admin orders list — table view with status filter + number search.
 *
 * Filtering happens server-side via Supabase query params so we don't
 * pull the entire orders table into the browser. Status filter is a
 * select; search is a text input matched against the `BAT-NNNN`
 * number with ILIKE.
 *
 * Clicking a row navigates to /admin/orders/[id] for the detail view
 * where the actual fulfilment actions (status change, tracking number)
 * live.
 */
export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [search, setSearch] = useState("");

  // Debounce the search input so each keystroke doesn't fire a query.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    listOrders({
      status: status === "all" ? null : status,
      search: debouncedSearch || undefined,
    })
      .then((data) => {
        if (!cancelled) setOrders(data);
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
  }, [status, debouncedSearch]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl lg:text-4xl font-semibold tracking-[-0.025em]">
          Замовлення
        </h1>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          {loading
            ? "Завантаження…"
            : `${orders.length} ${pluralize(orders.length, ["замовлення", "замовлення", "замовлень"])}`}
        </p>
      </header>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук за номером — BAT-0142"
            className="w-72 pl-10 pr-4 py-2.5 text-sm bg-[var(--color-bg-primary)] border border-[var(--color-border-strong)] rounded-full focus:border-[var(--color-text-primary)] outline-none transition-colors"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as OrderStatus | "all")}
          className="px-4 py-2.5 text-sm bg-[var(--color-bg-primary)] border border-[var(--color-border-strong)] rounded-full focus:border-[var(--color-text-primary)] outline-none transition-colors"
        >
          <option value="all">Всі статуси</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="text-sm text-rose-700 rounded-[var(--radius-lg)] border border-rose-200 bg-rose-50 px-4 py-3">
          {error}
        </p>
      )}

      {loading ? (
        <div className="grid place-items-center py-20 text-[var(--color-text-muted)]">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <EmptyState filtered={status !== "all" || !!debouncedSearch} />
      ) : (
        <OrdersTable orders={orders} />
      )}
    </div>
  );
}

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
          {orders.map((order) => (
            <OrderRow key={order.id} order={order} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrderRow({ order }: { order: Order }) {
  const tone = statusTone(order.status);
  return (
    <tr className="border-b last:border-0 border-[var(--color-border-default)] hover:bg-[var(--color-bg-secondary)] transition-colors">
      <td className="py-4 px-5 font-display tabular-nums">
        <Link
          href={`/admin/orders/${order.id}`}
          className="font-semibold hover:opacity-70 transition-opacity"
        >
          {order.number}
        </Link>
      </td>
      <td className="py-4 px-5">
        <Link href={`/admin/orders/${order.id}`} className="block">
          <div className="font-medium">
            {order.recipientFirstName} {order.recipientLastName}
          </div>
          <div className="text-xs text-[var(--color-text-muted)] tabular-nums">
            {order.recipientPhone}
          </div>
        </Link>
      </td>
      <td className="py-4 px-5 text-[var(--color-text-secondary)] tabular-nums">
        {formatDate(order.createdAt)}
      </td>
      <td className="py-4 px-5">
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
      <td className="py-4 px-5 text-right font-display font-semibold tabular-nums">
        {formatPrice(order.total)}
      </td>
    </tr>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-primary)] py-16 px-6 text-center">
      <p className="font-display text-xl font-semibold">
        {filtered ? "Нічого не знайдено." : "Замовлень поки немає."}
      </p>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)] max-w-md mx-auto leading-relaxed">
        {filtered
          ? "Спробуй прибрати фільтр або змінити пошуковий запит."
          : "Як тільки клієнт оформить перше замовлення — воно з'явиться тут."}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Ukrainian plural rule — 1 / 2-4 / 5+ */
function pluralize(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}
