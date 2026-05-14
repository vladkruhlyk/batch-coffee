"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Truck,
  User,
} from "lucide-react";
import {
  ORDER_STATUSES,
  deliveryMethodLabel,
  getOrderWithItems,
  paymentMethodLabel,
  statusLabel,
  statusTone,
  updateOrderStatus,
  updateOrderTracking,
  type OrderStatus,
  type OrderWithItems,
} from "@/lib/orders";
import { cn, formatPrice } from "@/lib/utils";

/**
 * Admin order detail — single screen with everything a fulfilment
 * person needs to act on an order:
 *   - Header with status pill (clicking it opens the change-status menu)
 *   - Customer contact card
 *   - Delivery card with editable tracking number
 *   - Payment card
 *   - Items list
 *   - Totals breakdown
 *   - Customer comment (read-only)
 */
export default function AdminOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingTracking, setSavingTracking] = useState(false);
  const [trackingDraft, setTrackingDraft] = useState("");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getOrderWithItems(id)
      .then((data) => {
        if (cancelled) return;
        setOrder(data);
        setTrackingDraft(data?.trackingNumber ?? "");
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(messageOf(e));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleStatusChange = useCallback(
    async (next: OrderStatus) => {
      if (!order || next === order.status) return;
      setSavingStatus(true);
      setError(null);
      try {
        await updateOrderStatus(order.id, next);
        setOrder((prev) => (prev ? { ...prev, status: next } : prev));
      } catch (e) {
        setError(messageOf(e));
      } finally {
        setSavingStatus(false);
      }
    },
    [order],
  );

  const handleTrackingSave = useCallback(async () => {
    if (!order) return;
    const next = trackingDraft.trim();
    if (next === (order.trackingNumber ?? "")) return;
    setSavingTracking(true);
    setError(null);
    try {
      await updateOrderTracking(order.id, next || null);
      setOrder((prev) =>
        prev ? { ...prev, trackingNumber: next || null } : prev,
      );
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setSavingTracking(false);
    }
  }, [order, trackingDraft]);

  if (loading) {
    return (
      <div className="grid place-items-center py-20 text-[var(--color-text-muted)]">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-md">
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-2 text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> До списку
        </Link>
        <p className="mt-6 font-display text-xl">Замовлення не знайдено.</p>
        {error && (
          <p className="mt-3 text-sm text-rose-700">{error}</p>
        )}
      </div>
    );
  }

  const tone = statusTone(order.status);

  return (
    <div className="flex flex-col gap-8">
      {/* Back link */}
      <Link
        href="/admin/orders"
        className="inline-flex items-center gap-2 text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors w-fit"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> До списку
      </Link>

      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl lg:text-4xl font-semibold tracking-[-0.025em] tabular-nums">
            {order.number}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)] tabular-nums">
            {formatDate(order.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "inline-flex items-center text-[11px] tracking-[0.2em] uppercase rounded-full px-3 py-1.5",
              tone.bg,
              tone.text,
            )}
          >
            {statusLabel(order.status)}
          </span>
          <select
            value={order.status}
            onChange={(e) => handleStatusChange(e.target.value as OrderStatus)}
            disabled={savingStatus}
            className="px-4 py-2 text-sm bg-[var(--color-bg-primary)] border border-[var(--color-border-strong)] rounded-full focus:border-[var(--color-text-primary)] outline-none transition-colors disabled:opacity-60"
          >
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                Змінити: {statusLabel(s)}
              </option>
            ))}
          </select>
          {savingStatus && (
            <Loader2 className="h-4 w-4 animate-spin text-[var(--color-text-muted)]" />
          )}
        </div>
      </header>

      {error && (
        <p className="text-sm text-rose-700 rounded-[var(--radius-lg)] border border-rose-200 bg-rose-50 px-4 py-3">
          {error}
        </p>
      )}

      {/* Info cards */}
      <div className="grid lg:grid-cols-3 gap-5 lg:gap-6">
        <InfoCard
          title="Клієнт"
          icon={<User className="h-3.5 w-3.5" strokeWidth={1.6} />}
        >
          <p className="font-display text-lg font-semibold">
            {order.recipientFirstName} {order.recipientLastName}
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm tabular-nums">
            <Phone className="h-4 w-4 text-[var(--color-text-muted)]" />
            <a
              href={`tel:${order.recipientPhone}`}
              className="hover:opacity-70 transition-opacity"
            >
              {order.recipientPhone}
            </a>
          </p>
          {order.recipientEmail && (
            <p className="mt-1 flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-[var(--color-text-muted)]" />
              <a
                href={`mailto:${order.recipientEmail}`}
                className="hover:opacity-70 transition-opacity"
              >
                {order.recipientEmail}
              </a>
            </p>
          )}
        </InfoCard>

        <InfoCard
          title="Доставка"
          icon={<Truck className="h-3.5 w-3.5" strokeWidth={1.6} />}
        >
          <p className="font-display text-sm font-semibold">
            {deliveryMethodLabel(order.deliveryMethod)}
          </p>
          <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed">
            <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-[var(--color-text-muted)]" />
            <span>
              {order.deliveryCity ? `${order.deliveryCity}, ` : ""}
              {order.deliveryAddress}
            </span>
          </p>

          {/* Tracking number editor */}
          <div className="mt-4">
            <label
              htmlFor="tracking"
              className="text-[10px] tracking-[0.22em] uppercase text-[var(--color-text-muted)] block mb-2"
            >
              ТТН Нової Пошти
            </label>
            <div className="flex items-center gap-2">
              <input
                id="tracking"
                value={trackingDraft}
                onChange={(e) => setTrackingDraft(e.target.value)}
                placeholder="20 цифр"
                className="flex-1 bg-transparent border-b border-[var(--color-border-strong)] focus:border-[var(--color-text-primary)] pb-1.5 text-sm tabular-nums outline-none transition-colors"
              />
              <button
                type="button"
                onClick={handleTrackingSave}
                disabled={
                  savingTracking ||
                  trackingDraft.trim() === (order.trackingNumber ?? "")
                }
                aria-label="Зберегти ТТН"
                className="grid h-8 w-8 place-items-center rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-85 transition-opacity"
              >
                {savingTracking ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                )}
              </button>
            </div>
          </div>
        </InfoCard>

        <InfoCard
          title="Оплата"
          icon={<span className="text-[10px]">₴</span>}
        >
          <p className="font-display text-sm font-semibold">
            {paymentMethodLabel(order.paymentMethod)}
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Сума товарів" value={formatPrice(order.subtotal)} />
            <Row label="Доставка" value={formatPrice(order.deliveryFee)} />
            {order.discount > 0 && (
              <Row label="Знижка" value={`−${formatPrice(order.discount)}`} />
            )}
            <Row
              label="Разом"
              value={formatPrice(order.total)}
              emphasis
            />
          </dl>
        </InfoCard>
      </div>

      {/* Items */}
      <section>
        <h2 className="font-display text-xl font-semibold mb-4">Товари</h2>
        <div className="overflow-x-auto rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] tracking-[0.18em] uppercase text-[var(--color-text-muted)] border-b border-[var(--color-border-default)]">
                <th className="py-3 px-5 font-medium">Товар</th>
                <th className="py-3 px-5 font-medium">Вага</th>
                <th className="py-3 px-5 font-medium">Помол</th>
                <th className="py-3 px-5 font-medium text-right">Ціна</th>
                <th className="py-3 px-5 font-medium text-right">К-сть</th>
                <th className="py-3 px-5 font-medium text-right">Разом</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b last:border-0 border-[var(--color-border-default)]"
                >
                  <td className="py-3 px-5">
                    <div className="font-medium">{item.productName}</div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {item.productSlug}
                    </div>
                  </td>
                  <td className="py-3 px-5 text-[var(--color-text-secondary)]">
                    {item.weightLabel}
                  </td>
                  <td className="py-3 px-5 text-[var(--color-text-secondary)]">
                    {item.grind ?? "—"}
                  </td>
                  <td className="py-3 px-5 text-right tabular-nums">
                    {formatPrice(item.unitPrice)}
                  </td>
                  <td className="py-3 px-5 text-right tabular-nums">
                    {item.quantity}
                  </td>
                  <td className="py-3 px-5 text-right tabular-nums font-display font-semibold">
                    {formatPrice(item.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Customer comment */}
      {order.comment && (
        <section className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-5 lg:p-6">
          <h3 className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]">
            Коментар клієнта
          </h3>
          <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap">
            {order.comment}
          </p>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function InfoCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-5 lg:p-6">
      <span className="inline-flex items-center gap-2 text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]">
        {icon}
        {title}
      </span>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between",
        emphasis && "pt-2 mt-2 border-t border-[var(--color-border-default)]",
      )}
    >
      <dt className="text-[var(--color-text-secondary)]">{label}</dt>
      <dd
        className={cn(
          "tabular-nums",
          emphasis ? "font-display text-base font-semibold" : "",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function messageOf(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Щось пішло не так.";
}
