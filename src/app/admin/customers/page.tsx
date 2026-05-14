"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, ShieldCheck } from "lucide-react";
import { listCustomers, type CustomerProfile } from "@/lib/customers";
import { listOrders, type Order } from "@/lib/orders";
import { cn, formatPrice } from "@/lib/utils";

/**
 * Customers list — every profile, with per-customer aggregates
 * computed from the orders table client-side. Filterable by name
 * / email / phone, sortable by total spent or last activity.
 *
 * Performance ceiling: ~1k customers × ~5k orders gives us a
 * snappy in-memory join. When the shop outgrows that we'll move
 * to a Postgres view + paginated query.
 */
export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "spent" | "orders">("recent");

  useEffect(() => {
    let cancelled = false;
    Promise.all([listCustomers(), listOrders()])
      .then(([cs, os]) => {
        if (cancelled) return;
        setCustomers(cs);
        setOrders(os);
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

  // Aggregate per-customer order stats once and reuse them when the
  // filter / sort changes.
  const rows = useMemo(() => {
    const byUser = new Map<
      string,
      { count: number; spent: number; lastOrderAt: string | null }
    >();
    for (const o of orders) {
      if (!o.userId) continue;
      if (o.status === "cancelled") continue;
      const agg = byUser.get(o.userId) ?? {
        count: 0,
        spent: 0,
        lastOrderAt: null,
      };
      agg.count += 1;
      agg.spent += o.total;
      if (!agg.lastOrderAt || o.createdAt > agg.lastOrderAt) {
        agg.lastOrderAt = o.createdAt;
      }
      byUser.set(o.userId, agg);
    }

    const q = query.trim().toLowerCase();
    const enriched = customers
      .map((c) => {
        const agg = byUser.get(c.id) ?? {
          count: 0,
          spent: 0,
          lastOrderAt: null,
        };
        return { ...c, ...agg };
      })
      .filter((c) => {
        if (!q) return true;
        const hay = [
          c.email,
          c.firstName,
          c.lastName,
          c.phone,
          `${c.firstName ?? ""} ${c.lastName ?? ""}`,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });

    enriched.sort((a, b) => {
      if (sortBy === "spent") return b.spent - a.spent;
      if (sortBy === "orders") return b.count - a.count;
      // recent — sort by lastOrderAt desc, then by signup desc as tiebreak
      const aLast = a.lastOrderAt ?? a.createdAt;
      const bLast = b.lastOrderAt ?? b.createdAt;
      return bLast.localeCompare(aLast);
    });

    return enriched;
  }, [customers, orders, query, sortBy]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl lg:text-4xl font-semibold tracking-[-0.025em]">
          Клієнти
        </h1>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          {loading ? "Завантаження…" : `${rows.length} зареєстровано`}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Імʼя, email, телефон…"
            className="w-72 pl-10 pr-4 py-2.5 text-sm bg-[var(--color-bg-primary)] border border-[var(--color-border-strong)] rounded-full focus:border-[var(--color-text-primary)] outline-none transition-colors"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) =>
            setSortBy(e.target.value as "recent" | "spent" | "orders")
          }
          className="px-4 py-2.5 text-sm bg-[var(--color-bg-primary)] border border-[var(--color-border-strong)] rounded-full focus:border-[var(--color-text-primary)] outline-none transition-colors"
        >
          <option value="recent">Останні активні</option>
          <option value="spent">За витратами</option>
          <option value="orders">За кількістю замовлень</option>
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
      ) : rows.length === 0 ? (
        <p className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-primary)] py-16 px-6 text-center text-sm text-[var(--color-text-secondary)]">
          {query ? "Нікого не знайдено." : "Клієнтів поки немає."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] tracking-[0.18em] uppercase text-[var(--color-text-muted)] border-b border-[var(--color-border-default)]">
                <th className="py-3 px-5 font-medium">Клієнт</th>
                <th className="py-3 px-5 font-medium">Контакти</th>
                <th className="py-3 px-5 font-medium text-right">Замовлень</th>
                <th className="py-3 px-5 font-medium text-right">Витрачено</th>
                <th className="py-3 px-5 font-medium">Остання активність</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr
                  key={c.id}
                  className="border-b last:border-0 border-[var(--color-border-default)] hover:bg-[var(--color-bg-secondary)] transition-colors"
                >
                  <td className="py-4 px-5">
                    <Link
                      href={`/admin/customers/${c.id}`}
                      className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                    >
                      <span className="font-medium">
                        {[c.firstName, c.lastName].filter(Boolean).join(" ") ||
                          "—"}
                      </span>
                      {c.isAdmin && (
                        <span
                          title="Адмін"
                          className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-[10px] tracking-[0.18em] uppercase text-[var(--color-text-secondary)]"
                        >
                          <ShieldCheck className="h-3 w-3" />
                          Admin
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="py-4 px-5 text-[var(--color-text-secondary)]">
                    <div>{c.email ?? "—"}</div>
                    <div className="text-xs tabular-nums">{c.phone ?? "—"}</div>
                  </td>
                  <td
                    className={cn(
                      "py-4 px-5 text-right tabular-nums",
                      c.count === 0 && "text-[var(--color-text-muted)]",
                    )}
                  >
                    {c.count}
                  </td>
                  <td
                    className={cn(
                      "py-4 px-5 text-right font-display font-semibold tabular-nums",
                      c.spent === 0 && "text-[var(--color-text-muted)] font-normal",
                    )}
                  >
                    {c.spent === 0 ? "—" : formatPrice(c.spent)}
                  </td>
                  <td className="py-4 px-5 text-[var(--color-text-secondary)] tabular-nums">
                    {formatRelative(c.lastOrderAt ?? c.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Coarse "X days ago" — good enough for an admin table without
 *  pulling in dayjs / date-fns. */
function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const days = Math.floor((now - then) / 86400000);
  if (days <= 0) return "сьогодні";
  if (days === 1) return "вчора";
  if (days < 7) return `${days} дн. тому`;
  if (days < 30) return `${Math.floor(days / 7)} тиж. тому`;
  if (days < 365) return `${Math.floor(days / 30)} міс. тому`;
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}
