"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  Clock,
  Loader2,
  MapPin,
  Package,
  Phone,
} from "lucide-react";
import { Container } from "@/components/layout/container";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import {
  deliveryMethodLabel,
  getOrderForView,
  listOrderEventsForView,
  paymentMethodLabel,
  statusLabel,
  statusTone,
  type OrderStatusEvent,
  type OrderWithItems,
} from "@/lib/orders";
import { useAuth } from "@/lib/auth-store";
import { EASING } from "@/lib/easing";
import { cn, formatPrice } from "@/lib/utils";

/**
 * Order detail (a.k.a. confirmation) page for customers.
 *
 * URL: /order/BAT-1042 — reads the order from Supabase by its
 * human-readable number. RLS narrows to "own" — the user must be
 * logged in as the order's owner. If they aren't, we show a "log in"
 * CTA rather than leaking the existence of the order.
 *
 * Includes the celebration tick for fresh orders, full items list,
 * delivery + payment info, and the status timeline pulled from
 * `order_status_events`. Reuses the same data shape as the admin
 * detail page.
 */
export default function OrderDetailPage() {
  // useSearchParams is CSR-only; wrap so the static prerender pass
  // doesn't complain about it being called outside of <Suspense>.
  //
  // Fallback is a tall spinner-shaped frame instead of null so the
  // footer doesn't ride up under the header while the params resolve.
  return (
    <Suspense fallback={<PageSpinner />}>
      <OrderDetailInner />
    </Suspense>
  );
}

function PageSpinner() {
  return (
    <>
      <Header />
      <main className="flex-1 bg-[var(--color-bg-primary)]">
        <Container size="default" className="pt-28 lg:pt-36 pb-24">
          <div className="min-h-[60vh] grid place-items-center text-[var(--color-text-muted)]">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}

function OrderDetailInner() {
  const params = useParams<{ number: string }>();
  const searchParams = useSearchParams();
  const number = params.number;
  const token = searchParams.get("token");

  const user = useAuth((s) => s.user);
  const hydrated = useAuth((s) => s.hydrated);

  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [events, setEvents] = useState<OrderStatusEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated || !number) return;
    let cancelled = false;
    getOrderForView(number, token)
      .then(async (data) => {
        if (cancelled) return;
        setOrder(data);
        if (data) {
          const evs = await listOrderEventsForView(data.id, token);
          if (!cancelled) setEvents(evs);
        }
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
  }, [number, token, hydrated]);

  // Auto-poll while a card payment is in "waiting on webhook" limbo.
  // Polls every 3 seconds for up to ~2 minutes, then gives up — by
  // that point WayForPay either failed entirely or the customer
  // closed the tab. Stops the moment the status moves OFF pending.
  useEffect(() => {
    if (!order) return;
    if (order.paymentMethod !== "card") return;
    if (order.status !== "pending") return;
    let cancelled = false;
    let ticks = 0;
    const maxTicks = 40; // 40 × 3s = 2 min
    const id = window.setInterval(async () => {
      ticks += 1;
      if (cancelled || ticks > maxTicks) {
        window.clearInterval(id);
        return;
      }
      try {
        const fresh = await getOrderForView(number!, token);
        if (cancelled || !fresh) return;
        if (fresh.status !== "pending") {
          setOrder(fresh);
          const evs = await listOrderEventsForView(fresh.id, token);
          if (!cancelled) setEvents(evs);
          window.clearInterval(id);
        }
      } catch {
        /* swallow — keep polling */
      }
    }, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [order, number, token]);

  return (
    <>
      <Header />
      <main className="flex-1 bg-[var(--color-bg-primary)]">
        <Container size="default" className="pt-28 lg:pt-36 pb-24">
          {loading || !hydrated ? (
            <div className="grid place-items-center py-20 text-[var(--color-text-muted)]">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : order ? (
            <Body order={order} events={events} />
          ) : !user ? (
            // Anonymous and the RPC didn't find the order (wrong / no
            // token, or the URL belongs to an account-bound order).
            // Offer login as a way out — they may own it once signed in.
            <NeedsLogin number={number} />
          ) : (
            <NotFound error={error} />
          )}
        </Container>
      </main>
      <Footer />
    </>
  );
}

// ---------------------------------------------------------------------------

function Body({
  order,
  events,
}: {
  order: OrderWithItems;
  events: OrderStatusEvent[];
}) {
  // "Fresh" — created within last 30 seconds. Captured on mount via
  // lazy useState init so we don't call Date.now() during render
  // (React 19 strict-mode flags that as impure).
  const [fresh] = useState(
    () => Date.now() - new Date(order.createdAt).getTime() < 30_000,
  );

  // Contextual pill — generic statusLabel() reads "Очікує оплату" for
  // any pending order, which is wrong for card payments where the
  // customer JUST entered their card. Override the copy based on
  // payment method so the wording matches what the buyer actually
  // experienced.
  const display = customerStatusDisplay(order);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Celebration tick — only on fresh visits */}
      {fresh && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: EASING.smooth, delay: 0.1 }}
          className="mx-auto h-20 w-20 rounded-full bg-emerald-100 grid place-items-center mb-8"
        >
          <Check className="h-10 w-10 text-emerald-700" strokeWidth={2.5} />
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASING.smooth, delay: 0.3 }}
        className="text-center"
      >
        <span className="block text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]">
          {fresh ? "Замовлення підтверджено" : "Замовлення"}
        </span>
        <h1 className="mt-4 font-display font-semibold text-[clamp(2rem,4.5vw,3.75rem)] leading-[1.02] tracking-[-0.04em]">
          {fresh ? "Дякуємо!" : order.number}
        </h1>
        <div className="mt-5 inline-flex items-center gap-3 text-[var(--color-text-secondary)]">
          {fresh && (
            <>
              Номер замовлення —{" "}
              <span className="font-display font-semibold text-[var(--color-text-primary)] tabular-nums">
                {order.number}
              </span>
            </>
          )}
          <span
            className={cn(
              "inline-flex items-center gap-2 text-[10px] tracking-[0.25em] uppercase rounded-full px-2.5 py-1",
              display.bg,
              display.text,
            )}
          >
            {display.spinning && (
              <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
            )}
            {display.label}
          </span>
        </div>
      </motion.div>

      {/* When the order is in card-payment limbo (we created it, the
          customer paid on WayForPay, the webhook hasn't landed yet),
          show a friendly explainer + auto-poll for status updates. */}
      {display.spinning && (
        <p className="mt-6 max-w-md mx-auto text-center text-sm text-[var(--color-text-secondary)] leading-relaxed">
          Оплата завершилась — чекаємо підтвердження від WayForPay.
          Зазвичай це займає кілька секунд, сторінка оновиться сама.
        </p>
      )}

      <div className="mt-12 grid gap-5 lg:gap-6">
        {/* Items */}
        <section className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-5 lg:p-7">
          <h2 className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]">
            <Package className="inline h-3.5 w-3.5 mr-2" strokeWidth={1.6} />
            Що в замовленні
          </h2>
          <ul className="mt-5 flex flex-col gap-4">
            {order.items.map((it) => (
              <li key={it.id} className="flex items-center gap-4">
                <span
                  aria-hidden
                  className="block h-12 w-12 shrink-0 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)]"
                  style={it.thumb ? { backgroundImage: it.thumb } : undefined}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight">
                    {it.productName}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5 tabular-nums">
                    {it.weightLabel}
                    {it.roast ? ` · ${it.roast}` : ""}
                    {it.grind ? ` · ${it.grind}` : ""} · {it.quantity} шт
                  </p>
                </div>
                <p className="text-sm font-display font-semibold tabular-nums shrink-0">
                  {formatPrice(it.lineTotal)}
                </p>
              </li>
            ))}
          </ul>

          <dl className="mt-6 pt-5 border-t border-[var(--color-border-default)] flex flex-col gap-2 text-sm">
            <Row label="Товари" value={formatPrice(order.subtotal)} />
            <Row
              label={
                order.deliveryMethod === "pickup"
                  ? "Самовивіз"
                  : "Доставка"
              }
              value={
                order.deliveryFee === 0
                  ? "Безкоштовно"
                  : formatPrice(order.deliveryFee)
              }
              positive={order.deliveryFee === 0}
            />
            {order.discount > 0 && (
              <Row
                label="Знижка"
                value={`−${formatPrice(order.discount)}`}
              />
            )}
            <Row label="Разом" value={formatPrice(order.total)} emphasis />
          </dl>
        </section>

        {/* Delivery + payment */}
        <div className="grid sm:grid-cols-2 gap-5 lg:gap-6">
          <InfoCard label="Доставка">
            <p className="font-display text-sm font-semibold">
              {deliveryMethodLabel(order.deliveryMethod)}
            </p>
            <p className="mt-2 text-sm flex items-start gap-2 leading-relaxed">
              <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-[var(--color-text-muted)]" />
              <span>
                {order.deliveryCity ? `${order.deliveryCity}, ` : ""}
                {order.deliveryAddress}
              </span>
            </p>
            {order.trackingNumber && (
              <p className="mt-3 text-sm tabular-nums">
                ТТН:{" "}
                <a
                  href={`https://novaposhta.ua/tracking/?cargo_number=${order.trackingNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[var(--color-text-primary)] underline underline-offset-4 decoration-[var(--color-border-strong)] hover:opacity-70 transition-opacity"
                >
                  {order.trackingNumber}
                </a>
              </p>
            )}
          </InfoCard>

          <InfoCard label="Оплата">
            <p className="font-display text-sm font-semibold">
              {paymentMethodLabel(order.paymentMethod)}
            </p>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)] flex items-start gap-2 leading-relaxed">
              <Phone className="h-4 w-4 mt-0.5 shrink-0 text-[var(--color-text-muted)]" />
              <span>
                {order.recipientPhone}
                {order.recipientEmail ? ` · ${order.recipientEmail}` : ""}
              </span>
            </p>
          </InfoCard>
        </div>

        {/* Status timeline */}
        {events.length > 0 && (
          <section className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-5 lg:p-7">
            <h2 className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]">
              <Clock className="inline h-3.5 w-3.5 mr-2" strokeWidth={1.6} />
              Що відбувається
            </h2>
            <ol className="mt-5 relative">
              <span
                aria-hidden
                className="absolute left-[7px] top-2 bottom-2 w-px bg-[var(--color-border-default)]"
              />
              {events.map((event, idx) => {
                const eventTone = statusTone(event.toStatus);
                const isLatest = idx === events.length - 1;
                return (
                  <li
                    key={event.id}
                    className="relative pl-7 pb-4 last:pb-0 text-sm"
                  >
                    <span
                      className={cn(
                        "absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2",
                        isLatest
                          ? "bg-[var(--color-text-primary)] border-[var(--color-text-primary)]"
                          : "bg-[var(--color-bg-primary)] border-[var(--color-border-strong)]",
                      )}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      {event.fromStatus ? (
                        <>
                          <span className="text-[var(--color-text-muted)]">
                            {statusLabel(event.fromStatus)}
                          </span>
                          <span className="text-[var(--color-text-muted)]">
                            →
                          </span>
                        </>
                      ) : (
                        <span className="text-[var(--color-text-muted)]">
                          Створено →
                        </span>
                      )}
                      <span
                        className={cn(
                          "inline-flex items-center text-[10px] tracking-[0.2em] uppercase rounded-full px-2 py-0.5",
                          eventTone.bg,
                          eventTone.text,
                        )}
                      >
                        {statusLabel(event.toStatus)}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-[var(--color-text-muted)] tabular-nums">
                      {formatDateTime(event.createdAt)}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {/* Customer comment */}
        {order.comment && (
          <section className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-5 lg:p-6">
            <h3 className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]">
              Твій коментар
            </h3>
            <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap">
              {order.comment}
            </p>
          </section>
        )}
      </div>

      {/* CTAs */}
      <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/account/orders"
          className="inline-flex items-center gap-2 rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] px-7 py-3.5 text-sm tracking-[0.12em] uppercase hover:opacity-85 transition-opacity"
        >
          Мої замовлення
        </Link>
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 text-sm tracking-[0.12em] uppercase pb-1 border-b border-[var(--color-text-primary)] hover:opacity-70 transition-opacity"
        >
          Назад у каталог
        </Link>
      </div>
    </div>
  );
}

function NeedsLogin({ number }: { number: string }) {
  return (
    <div className="max-w-md mx-auto text-center">
      <h1 className="font-display text-3xl font-semibold tracking-[-0.025em]">
        Увійди, щоб побачити замовлення.
      </h1>
      <p className="mt-3 text-[var(--color-text-secondary)] leading-relaxed">
        Деталі замовлення{" "}
        <span className="font-display font-semibold text-[var(--color-text-primary)] tabular-nums">
          {number}
        </span>{" "}
        доступні лише його власнику.
      </p>
      <Link
        href={`/login?next=${encodeURIComponent(`/order/${number}`)}`}
        className="mt-7 inline-flex items-center gap-2 rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] px-7 py-3.5 text-sm tracking-[0.12em] uppercase hover:opacity-85 transition-opacity"
      >
        Увійти
      </Link>
    </div>
  );
}

function NotFound({ error }: { error: string | null }) {
  return (
    <div className="max-w-md mx-auto text-center">
      <h1 className="font-display text-3xl font-semibold tracking-[-0.025em]">
        Замовлення не знайдено.
      </h1>
      <p className="mt-3 text-[var(--color-text-secondary)] leading-relaxed">
        Можливо, посилання застаріло або замовлення належить іншому акаунту.
      </p>
      {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}
      <Link
        href="/shop"
        className="mt-7 inline-flex items-center gap-2 rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] px-7 py-3.5 text-sm tracking-[0.12em] uppercase hover:opacity-85 transition-opacity"
      >
        У каталог
      </Link>
    </div>
  );
}

function InfoCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-5 lg:p-6">
      <span className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]">
        {label}
      </span>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  emphasis,
  positive,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  positive?: boolean;
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
          emphasis && "font-display text-base font-semibold",
          positive && "text-emerald-700",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Customer-facing status display — overrides the generic statusLabel
 *  for `pending` orders because the wording depends on payment method:
 *
 *    pending + card  → "Перевіряємо оплату" + spinner (we're waiting
 *                       on the WayForPay webhook to confirm)
 *    pending + cod   → "Очікує оплату при отриманні" (customer pays
 *                       when they pick up)
 *    paid / packing / shipped / delivered / cancelled → standard label
 *
 *  Returns the tailwind class strings inline so the pill renders the
 *  same way regardless of which branch we hit. */
function customerStatusDisplay(order: OrderWithItems): {
  label: string;
  bg: string;
  text: string;
  spinning: boolean;
} {
  if (order.status === "pending") {
    if (order.paymentMethod === "card") {
      return {
        label: "Перевіряємо оплату",
        bg: "bg-sky-100",
        text: "text-sky-800",
        spinning: true,
      };
    }
    return {
      label: "Очікує оплату при отриманні",
      bg: "bg-amber-100",
      text: "text-amber-800",
      spinning: false,
    };
  }
  const tone = statusTone(order.status);
  return {
    label: statusLabel(order.status),
    bg: tone.bg,
    text: tone.text,
    spinning: false,
  };
}

