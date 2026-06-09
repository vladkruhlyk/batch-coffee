"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Gift, Loader2, Lock, ShieldCheck } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { useCart, getCartSubtotal, getEffectiveItems } from "@/lib/cart-store";
import { useAuth, formatPhone, normalizePhone } from "@/lib/auth-store";
import {
  mergeRefreshedPrices,
  refreshCartPrices,
} from "@/lib/refresh-cart-prices";
import { discountFromSnapshot, type PromoSnapshot } from "@/lib/promo";
import { formatPrice, cn } from "@/lib/utils";

/**
 * Checkout page — пока работает только самовивіз + оплата при отриманні.
 *
 * НП-доставка (відділення / поштомат) и онлайн-оплата картой закрыты
 * плашкой «Тимчасово недоступно» — мы ждём API ключей от Нової Пошти
 * и LiqPay соответственно. Кнопки видны, но disabled, чтобы клиент
 * понимал что эти опции в работе.
 *
 * Submit действительно создаёт row в `orders` + `order_items` через
 * Supabase (RLS гарантирует, что user_id = auth.uid()). После успеха
 * редиректим на `/order/[number]` где страница подтверждения читает
 * заказ из БД и показывает реальный таймлайн статусов.
 */

const PICKUP_ADDRESS = {
  line1: "Полтава, вул. Соборності, 27",
  hours: "Пн–Нд · 08:00–20:00",
};

export default function CheckoutPage() {
  const router = useRouter();
  const items = useCart((s) => s.items);
  const clearCart = useCart((s) => s.clear);
  const replaceCartItems = useCart((s) => s.replaceItems);
  const promo = useCart((s) => s.promo);
  const user = useAuth((s) => s.user);
  const hydrated = useAuth((s) => s.hydrated);

  // Surface a banner if Sanity prices have drifted from what's in the
  // cart. Resolved on mount; doesn't block the form so the user can
  // keep filling fields while we hit Sanity.
  const [priceChanges, setPriceChanges] = useState<
    Array<{ name: string; weightLabel: string; oldPrice: number; newPrice: number }>
  >([]);

  // Form state — flat for simplicity. Pickup-only flow, so no city /
  // destination fields.
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [comment, setComment] = useState("");
  const [payment, setPayment] = useState<"card" | "cod">("cod");
  const [agreed, setAgreed] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Idempotency key — one per ORDER INTENT, stable across retries so a
  // network hiccup / double-click can't create duplicate orders (the
  // server replays the original response for a repeated key). Reset when
  // the cart contents change: an edited basket is a NEW intent and must
  // not replay the old order.
  const idemKeyRef = useRef<string | null>(null);
  useEffect(() => {
    idemKeyRef.current = null;
  }, [items]);
  // Holds the auto-submit form payload returned by /api/wayforpay/start.
  // When set, an effect mounts a hidden form and submits it, redirecting
  // the browser to WayForPay's hosted page.
  const [wfpPayload, setWfpPayload] = useState<{
    action: string;
    fields: Array<{ name: string; value: string }>;
  } | null>(null);

  // Pre-fill the form when the auth-store hydrates with a real user.
  // Legitimate cross-store sync — deps deliberately omitted, the fill
  // runs once on hydration and lets the user edit freely afterwards.
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (hydrated && user) {
      if (!phone) setPhone(formatPhone(user.phone));
      if (!firstName && user.firstName) setFirstName(user.firstName);
      if (!lastName && user.lastName) setLastName(user.lastName);
      if (!email && user.email) setEmail(user.email);
    }
  }, [hydrated, user]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  // Guest checkout is allowed — order rows get user_id=null and stay
  // visible on /order/[number] via the matching RLS branch (anon sees
  // anon orders by URL). Customers who log in get the order tied to
  // their account and visible from /account/orders; guests just trust
  // the URL. The banner below nudges them to sign up for loyalty.

  // Re-validate cart prices against live Sanity values once on mount.
  // Cart items snapshot unit prices at add-time and can drift if admin
  // updates them in the CMS — without this refresh the customer would
  // be charged whatever they happened to add at; with it they always
  // pay what the site currently lists.
  //
  // Empty-deps + ref guard so the refresh fires exactly once per
  // mount, regardless of cart re-renders from prefill state below.
  const refreshedRef = useRef(false);
  useEffect(() => {
    if (refreshedRef.current) return;
    if (!hydrated || items.length === 0) return;
    refreshedRef.current = true;
    refreshCartPrices(items)
      .then(({ updatedItems, changed }) => {
        if (changed.length > 0) {
          // Merge by id against the live store so edits made while the
          // fetch was in flight aren't silently undone.
          replaceCartItems(
            mergeRefreshedPrices(useCart.getState().items, updatedItems),
          );
          setPriceChanges(
            changed.map((c) => ({
              name: c.name,
              weightLabel: c.weightLabel,
              oldPrice: c.oldPrice,
              newPrice: c.newPrice,
            })),
          );
        }
        // Re-validate the promo against the refreshed subtotal. The
        // server re-validates at order creation anyway — this keeps the
        // DISPLAYED discount in sync so the customer isn't shown one
        // total and charged another (e.g. the code was disabled, or the
        // new subtotal dropped below minSubtotal).
        const promoNow = useCart.getState().promo;
        if (promoNow) {
          const liveSubtotal = getCartSubtotal(useCart.getState().items);
          fetch("/api/promo/validate", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ code: promoNow.code, subtotal: liveSubtotal }),
          })
            .then((r) => r.json())
            .then((data: { ok: boolean; snapshot?: PromoSnapshot }) => {
              const setPromo = useCart.getState().setPromo;
              if (data.ok && data.snapshot) setPromo(data.snapshot);
              else setPromo(null);
            })
            .catch(() => {
              /* validation hiccup — server still has the final word */
            });
        }
      })
      .catch((err) => {
        // Sanity down / network blip — fall back to cached prices.
        // Worse case: user pays what they added at, which is the
        // pre-fix status quo. Log so outages are visible.
        console.error("checkout price refresh failed:", err);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // Apply wholesale once and reuse throughout the page — summary lines,
  // subtotal, and the order payload all need to agree on the same set
  // of per-line prices. `getCartSubtotal` re-applies wholesale itself
  // but reading from `effectiveItems` directly keeps the wire shorter.
  const effectiveItems = getEffectiveItems(items);
  const subtotal = getCartSubtotal(items);
  const wholesaleActive = effectiveItems.some((i) => i.wholesaleActive);
  // Pickup is free; that's the only delivery method available right now.
  const deliveryFee = 0;
  // Display-only discount, from the stored snapshot. The server
  // re-resolves the code from Sanity and recomputes the authoritative
  // discount, so this just keeps the summary honest.
  const discount = discountFromSnapshot(promo, subtotal);
  const total = subtotal + deliveryFee - discount;

  const canSubmit =
    items.length > 0 &&
    firstName.trim() &&
    lastName.trim() &&
    normalizePhone(phone).length >= 8 &&
    agreed &&
    !submitting;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    // Same key across retries of this basket; see idemKeyRef above.
    // crypto.randomUUID() is available in every modern browser on HTTPS;
    // if it's somehow missing we just send no key and the server creates
    // the order without replay protection (the pre-idempotency behavior).
    if (
      !idemKeyRef.current &&
      typeof crypto !== "undefined" &&
      "randomUUID" in crypto
    ) {
      idemKeyRef.current = crypto.randomUUID();
    }
    try {
      // Server-side order creation. The route reads auth.uid()
      // directly from the request's cookies, so RLS's "auth.uid() =
      // user_id" check always sees a coherent pair. Previously we
      // inserted from the browser with a zustand-cached user.id —
      // any drift between the two would trip the policy.
      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          recipientFirstName: firstName.trim(),
          recipientLastName: lastName.trim(),
          recipientPhone: normalizePhone(phone),
          recipientEmail: email.trim() || user?.email || null,
          deliveryMethod: "pickup",
          deliveryAddress: PICKUP_ADDRESS.line1,
          deliveryCity: "Полтава",
          paymentMethod: payment,
          comment: comment.trim() || null,
          deliveryFee,
          // Send only the CODE — the server re-resolves it from Sanity
          // and recomputes the discount. A tampered client can't grant
          // itself an arbitrary amount.
          promoCode: promo?.code ?? null,
          idempotencyKey: idemKeyRef.current,
          items: effectiveItems.map((it) => ({
            productSlug: it.slug,
            productName: it.name,
            thumb: it.thumb,
            weightLabel: it.weightLabel,
            weightGrams: it.weightGrams,
            roast: it.roast ?? null,
            grind: it.grind ?? null,
            // Pay the wholesale-aware price, not the cart snapshot.
            unitPrice: it.effectiveUnitPrice,
            quantity: it.quantity,
          })),
        }),
      });
      if (!res.ok) {
        const detail = await res
          .json()
          .then((j) => j.error)
          .catch(() => res.statusText);
        throw new Error(detail || "не вдалось створити замовлення");
      }
      const { id, number, viewToken } = (await res.json()) as {
        id: string;
        number: string;
        viewToken: string;
      };
      if (payment === "card") {
        // Online card → kick off WayForPay. Backend builds the signed
        // form payload; we then POST the browser to WayForPay's hosted
        // page.
        const res = await fetch("/api/wayforpay/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ orderId: id, viewToken }),
        });
        if (!res.ok) {
          // Payment setup failed. We deliberately have NOT cleared the
          // cart yet, so the catch below shows the error on the normal
          // checkout form instead of the empty-cart guard hijacking the
          // screen. The just-created order stays `pending` (harmless —
          // same as any abandoned WayForPay session).
          const detail = await res
            .json()
            .then((j) => j.error)
            .catch(() => res.statusText);
          throw new Error(`Помилка оплати: ${detail}`);
        }
        const payload = (await res.json()) as {
          action: string;
          fields: Array<{ name: string; value: string }>;
        };
        // Only NOW that we're definitely redirecting do we clear the
        // cart — so a bailed/failed payment doesn't strand the customer
        // on an empty-cart screen with no way to retry.
        clearCart();
        setWfpPayload(payload);
        // submitting stays true so the button keeps its spinner while
        // the hidden form auto-submits.
        return;
      }
      // COD path — order is committed, head to confirmation. Clear the
      // cart first so navigating back doesn't re-submit the same items.
      clearCart();
      router.push(`/order/${number}?token=${viewToken}`);
    } catch (e) {
      // Pull a human-readable message out of whatever was thrown:
      // Error → .message; Postgrest/Supabase errors are plain objects
      // with a .message property; everything else falls through to
      // String(). The previous version stringified Supabase errors to
      // "[object Object]", which was a debugging dead-end.
      const detail = extractErrorMessage(e);
      console.error("Order submission failed:", e);
      setError(`Не вдалось оформити: ${detail}`);
      setSubmitting(false);
    }
  };

  // Card-payment redirect in flight. We clear the cart at the moment we
  // set this payload (right before redirecting), so by the time this
  // screen renders the cart is empty. It must therefore come BEFORE the
  // empty-cart guard below, otherwise that guard fires first and the
  // hidden auto-submit form never mounts → no redirect → dead end.
  if (wfpPayload) {
    return (
      <>
        <Header />
        <main className="flex-1">
          <Container size="default" className="pt-32 pb-24 text-center">
            <div className="mx-auto h-12 w-12 grid place-items-center text-[var(--color-text-muted)]">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
            <h1 className="mt-6 font-display text-2xl lg:text-3xl font-semibold tracking-[-0.025em]">
              Перенаправляємо на сторінку оплати…
            </h1>
            <p className="mt-3 text-[var(--color-text-secondary)]">
              Якщо нічого не сталося за кілька секунд — перевір, чи не
              заблокував браузер перехід.
            </p>
          </Container>
        </main>
        <Footer />
        {/* Hidden auto-submit form that POSTs the browser to WayForPay. */}
        <WayForPayAutoForm
          action={wfpPayload.action}
          fields={wfpPayload.fields}
        />
      </>
    );
  }

  // Empty cart edge case — bounce back to /cart so the user can't get
  // stuck on a checkout with nothing to buy. Skipped while an order is
  // being submitted (the COD path clears the cart a tick before
  // router.push lands, and we don't want a flash of this screen).
  if (items.length === 0 && !submitting) {
    return (
      <>
        <Header />
        <main className="flex-1">
          <Container size="default" className="pt-32 pb-24 text-center">
            <h1 className="font-display text-3xl lg:text-4xl font-semibold tracking-[-0.025em]">
              У кошику нічого нема.
            </h1>
            <p className="mt-3 text-[var(--color-text-secondary)]">
              Додай каву в кошик і повертайся сюди.
            </p>
            <Link
              href="/shop"
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] px-7 py-3.5 text-sm tracking-[0.12em] uppercase hover:opacity-85 transition-opacity"
            >
              У каталог
            </Link>
          </Container>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="flex-1">
        <Container
          size="wide"
          className="pt-28 lg:pt-36 pb-[var(--section-gap)]"
        >
          {/* Breadcrumbs */}
          <nav
            aria-label="Хлібні крихти"
            className="flex flex-wrap items-center gap-2 text-[11px] tracking-[0.2em] uppercase text-[var(--color-text-muted)] mb-10"
          >
            <Link
              href="/cart"
              className="hover:text-[var(--color-text-primary)] transition-colors"
            >
              Кошик
            </Link>
            <span aria-hidden>/</span>
            <span className="text-[var(--color-text-primary)]">Оформлення</span>
          </nav>

          <header className="mb-10 lg:mb-12">
            <h1 className="font-display font-semibold text-[clamp(2rem,4.5vw,3.75rem)] leading-[1.02] tracking-[-0.04em]">
              Оформлення замовлення
            </h1>
            <p className="mt-3 text-[var(--color-text-secondary)] max-w-xl">
              Заповни контакти — і кава чекатиме тебе в кав&apos;ярні.
            </p>
          </header>

          {/* Guest nudge — visible only to anonymous customers. Frames
              login as a perk (bonus accrual) rather than a requirement,
              so people who just want to grab coffee aren't forced. */}
          {hydrated && !user && (
            <div className="mb-6 rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] px-5 py-4 lg:px-6 lg:py-5 flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-3 text-sm">
                <Gift className="h-5 w-5 shrink-0 text-emerald-700" strokeWidth={1.6} />
                <span>
                  <span className="font-display font-semibold">
                    Оформляєш як гість.
                  </span>{" "}
                  <span className="text-[var(--color-text-secondary)]">
                    Зареєструйся — і кожне замовлення буде накопичувати
                    бонуси на знижку.
                  </span>
                </span>
              </p>
              <Link
                href="/login?next=/checkout"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-strong)] px-5 py-2 text-xs tracking-[0.18em] uppercase text-[var(--color-text-primary)] hover:border-[var(--color-text-primary)] transition-colors"
              >
                Увійти
              </Link>
            </div>
          )}

          {/* Banner — explains why some options are locked */}
          <div className="mb-6 rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-secondary)] px-5 py-4 lg:px-6 lg:py-5 flex items-start gap-4">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)]">
              <Lock className="h-4 w-4" strokeWidth={1.6} />
            </span>
            <div className="text-sm leading-relaxed">
              <p className="font-display font-semibold text-base">
                Запускаємо потроху
              </p>
              <p className="mt-1 text-[var(--color-text-secondary)]">
                Поки що працює самовивіз і оплата при отриманні.
                Доставку Новою Поштою та оплату карткою підключаємо найближчим
                часом — побачиш як тільки вони стануть доступні.
              </p>
            </div>
          </div>

          {/* Banner — surfaces cart price drift if Sanity has changed
              since the items were added. We update the cart silently
              and let the user re-confirm the new total. */}
          {priceChanges.length > 0 && (
            <div className="mb-10 lg:mb-12 rounded-[var(--radius-xl)] border border-amber-200 bg-amber-50 px-5 py-4 lg:px-6 lg:py-5">
              <p className="font-display font-semibold text-base text-amber-900">
                Ціни оновились
              </p>
              <p className="mt-1 text-sm text-amber-800 leading-relaxed">
                Поки кошик чекав — деякі позиції змінились. Ось як зараз:
              </p>
              <ul className="mt-3 space-y-1 text-sm text-amber-900 tabular-nums">
                {priceChanges.map((c) => (
                  <li key={`${c.name}-${c.weightLabel}`} className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {c.name} · {c.weightLabel}:
                    </span>
                    <span className="text-amber-800 line-through">
                      {formatPrice(c.oldPrice)}
                    </span>
                    <span>→</span>
                    <span className="font-display font-semibold">
                      {formatPrice(c.newPrice)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <form
            onSubmit={submit}
            className="grid lg:grid-cols-12 gap-8 lg:gap-12"
          >
            {/* Left column — fields */}
            <div className="lg:col-span-8 flex flex-col gap-10">
              {/* Group 1: Contacts */}
              <FormGroup
                step="01"
                title="Контакти"
                subtitle="Дзвонимо лише за крайньої потреби — наприклад, якщо ти запізнюєшся забрати."
              >
                <div className="grid sm:grid-cols-2 gap-5">
                  <Field
                    id="firstName"
                    label="Імʼя"
                    value={firstName}
                    onChange={setFirstName}
                    autoComplete="given-name"
                    required
                  />
                  <Field
                    id="lastName"
                    label="Прізвище"
                    value={lastName}
                    onChange={setLastName}
                    autoComplete="family-name"
                    required
                  />
                  <Field
                    id="phone"
                    label="Телефон"
                    value={phone}
                    onChange={setPhone}
                    type="tel"
                    autoComplete="tel"
                    placeholder="+380 50 123 45 67"
                    required
                  />
                  <Field
                    id="email"
                    label="Email"
                    value={email}
                    onChange={setEmail}
                    type="email"
                    autoComplete="email"
                    placeholder="ti@example.com"
                  />
                </div>
              </FormGroup>

              {/* Group 2: Delivery */}
              <FormGroup step="02" title="Доставка">
                <div className="grid sm:grid-cols-3 gap-3 mb-6">
                  <DeliveryOption
                    label="Самовивіз"
                    sub="Київ · сьогодні"
                    active
                    available
                    onClick={() => {
                      /* only option right now */
                    }}
                  />
                  <DeliveryOption
                    label="НП відділення"
                    sub="Скоро"
                    active={false}
                    available={false}
                    onClick={() => {
                      /* disabled */
                    }}
                  />
                  <DeliveryOption
                    label="НП поштомат"
                    sub="Скоро"
                    active={false}
                    available={false}
                    onClick={() => {
                      /* disabled */
                    }}
                  />
                </div>

                <div className="rounded-[var(--radius-lg)] bg-[var(--color-bg-secondary)] px-5 py-4 text-sm leading-relaxed">
                  <p className="font-display font-semibold text-base">
                    {PICKUP_ADDRESS.line1}
                  </p>
                  <p className="mt-1 text-[var(--color-text-secondary)]">
                    {PICKUP_ADDRESS.hours} · Свіжообсмажене — зазвичай готове за
                    1–2 години після оформлення.
                  </p>
                </div>

              </FormGroup>

              {/* Group 3: Payment */}
              <FormGroup step="03" title="Оплата">
                <div className="grid sm:grid-cols-2 gap-3">
                  <PaymentOption
                    label="При отриманні"
                    sub="Готівка або термінал у кав'ярні"
                    active={payment === "cod"}
                    available
                    onClick={() => setPayment("cod")}
                  />
                  <PaymentOption
                    label="Картка онлайн"
                    sub="WayForPay · Apple/Google Pay"
                    active={payment === "card"}
                    available
                    onClick={() => setPayment("card")}
                  />
                </div>
                {payment === "card" && (
                  <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-[var(--radius-md)] px-3 py-2">
                    Тестовий режим WayForPay. Картка для тесту:{" "}
                    <span className="font-mono">4444 5551 1111 6666</span>,{" "}
                    <span className="font-mono">12/25</span>, CVV{" "}
                    <span className="font-mono">123</span>. Реальні гроші не
                    списуються.
                  </p>
                )}
              </FormGroup>

              {/* Group 4: Comment */}
              <FormGroup step="04" title="Коментар до замовлення (опційно)">
                <textarea
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Подарунковий пакет / помолоти на еспресо / тощо"
                  className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-transparent p-4 text-sm focus:border-[var(--color-text-primary)] outline-none transition-colors resize-none"
                />
              </FormGroup>

              {/* Consent */}
              <label className="flex items-start gap-3 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-[var(--color-border-strong)]"
                />
                <span className="text-[var(--color-text-secondary)] leading-relaxed">
                  Я погоджуюсь з{" "}
                  <Link
                    href="/terms"
                    className="text-[var(--color-text-primary)] underline underline-offset-2 decoration-[var(--color-border-strong)]"
                  >
                    умовами продажу
                  </Link>{" "}
                  і{" "}
                  <Link
                    href="/privacy"
                    className="text-[var(--color-text-primary)] underline underline-offset-2 decoration-[var(--color-border-strong)]"
                  >
                    політикою конфіденційності
                  </Link>
                  .
                </span>
              </label>
            </div>

            {/* Right column — summary rail */}
            <aside className="lg:col-span-4">
              <div className="sticky top-28 rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-6 lg:p-7">
                <h2 className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] mb-5">
                  Твоє замовлення
                </h2>

                <ul className="flex flex-col gap-3 max-h-72 overflow-y-auto pr-1">
                  {effectiveItems.map((item) => (
                    <li key={item.id} className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className="block h-12 w-12 shrink-0 rounded-[var(--radius-md)] bg-cover bg-center bg-no-repeat"
                        style={{ backgroundImage: item.thumb }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight truncate">
                          {item.name}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)] tabular-nums">
                          {item.weightLabel} · {item.quantity} шт
                        </p>
                      </div>
                      <div className="text-right">
                        {item.wholesaleActive && (
                          <p className="text-[10px] text-[var(--color-text-muted)] line-through tabular-nums">
                            {formatPrice(item.unitPrice * item.quantity)}
                          </p>
                        )}
                        <p className="text-sm font-display font-semibold tabular-nums">
                          {formatPrice(item.effectiveUnitPrice * item.quantity)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>

                {wholesaleActive && (
                  <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-[10px] tracking-[0.18em] uppercase text-emerald-800">
                    Гуртова ціна
                  </p>
                )}

                <dl className="mt-5 pt-5 border-t border-[var(--color-border-default)] flex flex-col gap-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-[var(--color-text-secondary)]">
                      Товари
                    </dt>
                    <dd className="tabular-nums">{formatPrice(subtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--color-text-secondary)]">
                      Самовивіз
                    </dt>
                    <dd className="tabular-nums text-emerald-700">
                      Безкоштовно
                    </dd>
                  </div>
                  {discount > 0 && promo && (
                    <div className="flex justify-between text-emerald-700">
                      <dt>Знижка ({promo.code})</dt>
                      <dd className="tabular-nums">−{formatPrice(discount)}</dd>
                    </div>
                  )}
                </dl>

                <div className="mt-5 pt-4 border-t border-[var(--color-border-default)] flex items-baseline justify-between">
                  <span className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]">
                    До сплати
                  </span>
                  <span className="font-display text-2xl lg:text-3xl font-semibold tabular-nums">
                    {formatPrice(total)}
                  </span>
                </div>

                {error && (
                  <p className="mt-4 text-sm text-rose-700 rounded-[var(--radius-lg)] border border-rose-200 bg-rose-50 px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] px-6 py-4 text-sm tracking-[0.12em] uppercase hover:opacity-85 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : payment === "card" ? (
                    <>
                      Оплатити карткою
                      <ArrowRight className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Підтвердити замовлення
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                <p className="mt-5 inline-flex items-center gap-2 text-[11px] text-[var(--color-text-muted)] leading-relaxed">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Дані захищені · RLS на стороні бази
                </p>
              </div>
            </aside>
          </form>
          {/* The WayForPay auto-submit form lives in the dedicated
              redirect screen above (which short-circuits this render
              once wfpPayload is set), so nothing payment-related is
              needed here. */}
        </Container>
      </main>
      <Footer />
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FormGroup({
  step,
  title,
  subtitle,
  children,
}: {
  step: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-4 mb-5">
        <span className="font-display text-sm text-[var(--color-text-muted)] tabular-nums">
          N°{step}
        </span>
        <span className="block w-8 h-px bg-[var(--color-border-strong)]" />
        <h3 className="font-display text-xl lg:text-2xl font-semibold tracking-[-0.02em]">
          {title}
        </h3>
      </div>
      {subtitle && (
        <p className="text-sm text-[var(--color-text-secondary)] mb-5 max-w-xl">
          {subtitle}
        </p>
      )}
      {children}
    </section>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="text-[10px] tracking-[0.22em] uppercase text-[var(--color-text-muted)] block mb-2"
      >
        {label}
        {required && <span className="text-rose-700 ml-1">·</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className="w-full bg-transparent border-b border-[var(--color-border-strong)] focus:border-[var(--color-text-primary)] pb-2 text-base outline-none transition-colors"
      />
    </div>
  );
}

function DeliveryOption({
  label,
  sub,
  active,
  available,
  onClick,
}: {
  label: string;
  sub: string;
  active: boolean;
  available: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      disabled={!available}
      className={cn(
        "relative rounded-[var(--radius-lg)] border px-5 py-4 text-left transition-all duration-300",
        active && available
          ? "border-[var(--color-text-primary)] bg-[var(--color-text-primary)] text-[var(--color-text-inverse)]"
          : available
            ? "border-[var(--color-border-strong)] hover:border-[var(--color-text-primary)]"
            : "border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] cursor-not-allowed",
      )}
    >
      {!available && (
        <Lock
          className="absolute top-3 right-3 h-3.5 w-3.5 opacity-60"
          strokeWidth={1.6}
        />
      )}
      <p className="font-display font-semibold text-base">{label}</p>
      <p
        className={cn(
          "mt-1 text-xs",
          active && available
            ? "text-white/60"
            : !available
              ? "text-[var(--color-text-muted)]"
              : "text-[var(--color-text-muted)]",
        )}
      >
        {sub}
      </p>
    </button>
  );
}

function PaymentOption({
  label,
  sub,
  active,
  available,
  onClick,
}: {
  label: string;
  sub: string;
  active: boolean;
  available: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      disabled={!available}
      className={cn(
        "relative rounded-[var(--radius-lg)] border px-5 py-4 text-left transition-all duration-300",
        active && available
          ? "border-[var(--color-text-primary)] bg-[var(--color-text-primary)] text-[var(--color-text-inverse)]"
          : available
            ? "border-[var(--color-border-strong)] hover:border-[var(--color-text-primary)]"
            : "border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] cursor-not-allowed",
      )}
    >
      {!available && (
        <Lock
          className="absolute top-3 right-3 h-3.5 w-3.5 opacity-60"
          strokeWidth={1.6}
        />
      )}
      <p className="font-display font-semibold text-base">{label}</p>
      <p
        className={cn(
          "mt-1 text-xs",
          active && available
            ? "text-white/60"
            : "text-[var(--color-text-muted)]",
        )}
      >
        {sub}
      </p>
    </button>
  );
}

/** Best-effort string from anything thrown. Handles `Error` instances,
 *  Supabase / PostgREST error objects (plain `{ message, details, hint }`),
 *  and arbitrary values via `String()`. Returned message is suitable for
 *  showing inline to the user without further sanitisation. */
function extractErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (typeof e === "object" && e !== null) {
    const obj = e as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.error === "string") return obj.error;
    if (typeof obj.details === "string") return obj.details;
    try {
      return JSON.stringify(obj);
    } catch {
      /* fall through */
    }
  }
  return String(e);
}

/**
 * Tiny invisible component that renders a <form> with the WayForPay
 * payload as hidden inputs and submits it on next tick. The form
 * action takes the customer's browser straight to WayForPay's hosted
 * page (which understands form-urlencoded POST).
 */
function WayForPayAutoForm({
  action,
  fields,
}: {
  action: string;
  fields: Array<{ name: string; value: string }>;
}) {
  useEffect(() => {
    const form = document.createElement("form");
    form.action = action;
    form.method = "POST";
    form.acceptCharset = "utf-8";
    form.style.display = "none";
    form.setAttribute("aria-hidden", "true");

    for (const { name, value } of fields) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }

    document.body.appendChild(form);
    const id = window.setTimeout(() => {
      form.submit();
    }, 0);
    return () => {
      window.clearTimeout(id);
      form.remove();
    };
  }, [action, fields]);

  return null;
}
