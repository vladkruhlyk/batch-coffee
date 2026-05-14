"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Wallet,
} from "lucide-react";
import {
  computeCustomerStats,
  getCustomer,
  type CustomerProfile,
} from "@/lib/customers";
import {
  listOrdersForUser,
  statusLabel,
  statusTone,
  type Order,
} from "@/lib/orders";
import { cn, formatPrice } from "@/lib/utils";

/**
 * Customer detail — bio, contact info, lifetime stats, full order
 * history. Admin-only.
 */
export default function AdminCustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    Promise.all([getCustomer(id), listOrdersForUser(id)])
      .then(([c, os]) => {
        if (cancelled) return;
        setCustomer(c);
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
  }, [id]);

  if (loading) {
    return (
      <div className="grid place-items-center py-20 text-[var(--color-text-muted)]">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="max-w-md">
        <Link
          href="/admin/customers"
          className="inline-flex items-center gap-2 text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> До списку
        </Link>
        <p className="mt-6 font-display text-xl">Клієнта не знайдено.</p>
        {error && (
          <p className="mt-3 text-sm text-rose-700">{error}</p>
        )}
      </div>
    );
  }

  const stats = computeCustomerStats(orders);
  const fullName =
    [customer.firstName, customer.lastName].filter(Boolean).join(" ") || "—";

  return (
    <div className="flex flex-col gap-8">
      <Link
        href="/admin/customers"
        className="inline-flex items-center gap-2 text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors w-fit"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> До списку
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl lg:text-4xl font-semibold tracking-[-0.025em]">
            {fullName}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)] tabular-nums">
            Зареєстрований {formatDate(customer.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {customer.isAdmin && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-bg-secondary)] px-3 py-1.5 text-[11px] tracking-[0.2em] uppercase text-[var(--color-text-secondary)]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Адмін
            </span>
          )}
          {customer.newsletter && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-[11px] tracking-[0.2em] uppercase text-emerald-800">
              <Sparkles className="h-3.5 w-3.5" />
              Розсилка
            </span>
          )}
        </div>
      </header>

      {error && (
        <p className="text-sm text-rose-700 rounded-[var(--radius-lg)] border border-rose-200 bg-rose-50 px-4 py-3">
          {error}
        </p>
      )}

      {/* Stat strip */}
      <section className="grid sm:grid-cols-3 gap-4">
        <StatCard
          label="Контакти"
          icon={<Mail className="h-4 w-4" strokeWidth={1.6} />}
        >
          <div className="text-sm">{customer.email ?? "—"}</div>
          <div className="text-xs text-[var(--color-text-secondary)] tabular-nums mt-1">
            {customer.phone ?? "—"}
          </div>
        </StatCard>
        <StatCard
          label="Замовлень"
          icon={<ShoppingBag className="h-4 w-4" strokeWidth={1.6} />}
        >
          <div className="font-display text-3xl font-semibold tabular-nums">
            {stats.orderCount}
          </div>
          {stats.lastOrderAt && (
            <div className="text-xs text-[var(--color-text-secondary)] mt-1">
              Остання — {formatDate(stats.lastOrderAt)}
            </div>
          )}
        </StatCard>
        <StatCard
          label="Витрачено"
          icon={<Wallet className="h-4 w-4" strokeWidth={1.6} />}
        >
          <div className="font-display text-3xl font-semibold tabular-nums">
            {stats.totalSpent === 0 ? "—" : formatPrice(stats.totalSpent)}
          </div>
          {stats.orderCount > 0 && (
            <div className="text-xs text-[var(--color-text-secondary)] mt-1">
              AOV ≈{" "}
              {formatPrice(Math.round(stats.totalSpent / stats.orderCount))}
            </div>
          )}
        </StatCard>
      </section>

      {/* Quick contact pills */}
      {(customer.email || customer.phone) && (
        <section className="flex flex-wrap items-center gap-3">
          {customer.email && (
            <a
              href={`mailto:${customer.email}`}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-strong)] px-5 py-2.5 text-sm hover:border-[var(--color-text-primary)] transition-colors"
            >
              <Mail className="h-4 w-4" strokeWidth={1.6} />
              Написати
            </a>
          )}
          {customer.phone && (
            <a
              href={`tel:${customer.phone}`}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-strong)] px-5 py-2.5 text-sm hover:border-[var(--color-text-primary)] transition-colors tabular-nums"
            >
              <Phone className="h-4 w-4" strokeWidth={1.6} />
              {customer.phone}
            </a>
          )}
        </section>
      )}

      {/* Order history */}
      <section>
        <h2 className="font-display text-xl font-semibold mb-4">
          Історія замовлень
        </h2>
        {orders.length === 0 ? (
          <p className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-primary)] py-10 px-5 text-center text-sm text-[var(--color-text-secondary)]">
            Поки не замовляв.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] tracking-[0.18em] uppercase text-[var(--color-text-muted)] border-b border-[var(--color-border-default)]">
                  <th className="py-3 px-5 font-medium">Номер</th>
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
                      <td className="py-3 px-5 text-[var(--color-text-secondary)] tabular-nums">
                        {formatDate(order.createdAt)}
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
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------

function StatCard({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
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
      <div className="mt-4">{children}</div>
    </article>
  );
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}
