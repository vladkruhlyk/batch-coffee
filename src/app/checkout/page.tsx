"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { FreeShippingProgress } from "@/components/cart/free-shipping-progress";
import { useCart, getCartSubtotal } from "@/lib/cart-store";
import { useAuth, formatPhone, normalizePhone } from "@/lib/auth-store";
import { FREE_SHIPPING_THRESHOLD, DELIVERY_BASE } from "@/lib/shipping";
import { formatPrice, cn } from "@/lib/utils";

type DeliveryMethod = "novaposhta-branch" | "novaposhta-postomat" | "pickup";
type PaymentMethod = "card" | "cod"; // card via LiqPay, cod = on delivery

const PICKUP_FEE = 0;

/**
 * Checkout page — single-column form covering contacts, delivery, payment.
 *
 * Wire-style by design: groups stack vertically, the right-rail summary is
 * sticky on desktop, full bottom-bar on mobile. Submission is a mock today
 * (logs to console + routes to /order/success). When the backend lands the
 * `submit` handler becomes a `fetch("/api/orders", ...)` call.
 *
 * If the user is logged in we pre-fill phone from the auth store; if they
 * have a default address from /account/addresses we'd pre-fill that too —
 * for now we just leave fields blank and let them type. Pre-fill from
 * addresses is a clear next-step once Supabase is wired.
 */
export default function CheckoutPage() {
  const router = useRouter();
  const items = useCart((s) => s.items);
  const clearCart = useCart((s) => s.clear);
  const user = useAuth((s) => s.user);
  const hydrated = useAuth((s) => s.hydrated);

  // Form state — kept flat for simplicity. Group structure lives in the
  // JSX, not in nested state objects.
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [destination, setDestination] = useState("");
  const [delivery, setDelivery] = useState<DeliveryMethod>("novaposhta-branch");
  const [payment, setPayment] = useState<PaymentMethod>("card");
  const [comment, setComment] = useState("");
  const [agreed, setAgreed] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill the form when the auth-store hydrates with a real user.
  // This is a legitimate use of useEffect: we're syncing local form
  // state to an external store after async load. Form deps deliberately
  // omitted — pre-fill fires once, then user edits take over.
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

  const subtotal = getCartSubtotal(items);
  const eligibleFree = subtotal >= FREE_SHIPPING_THRESHOLD;
  const deliveryFee =
    delivery === "pickup" ? PICKUP_FEE : eligibleFree ? 0 : DELIVERY_BASE;
  const total = subtotal + deliveryFee;

  const canSubmit =
    items.length > 0 &&
    firstName.trim() &&
    lastName.trim() &&
    normalizePhone(phone).length >= 8 &&
    (delivery === "pickup" || (city.trim() && destination.trim())) &&
    agreed &&
    !submitting;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    // Mock processing latency. Real flow:
    //   1. POST /api/orders → creates order row, status="pending"
    //   2. If payment=card → redirect to LiqPay form (or open widget)
    //   3. On callback → status="paid", router.push to /order/success?id=...
    await new Promise((r) => setTimeout(r, 900));
    const fakeOrderId = `BAT-${Math.floor(Math.random() * 9000) + 1000}`;
    clearCart();
    router.push(`/order/success?order=${fakeOrderId}`);
  };

  // Empty cart edge case — bounce back to /cart so the user can't get
  // stuck on a checkout with nothing to buy.
  if (items.length === 0) {
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

          <header className="mb-12 lg:mb-16">
            <h1 className="font-display font-semibold text-[clamp(2rem,4.5vw,3.75rem)] leading-[1.02] tracking-[-0.04em]">
              Оформлення замовлення
            </h1>
            <p className="mt-3 text-[var(--color-text-secondary)] max-w-xl">
              Кілька полів — і твоя кава поїде. Контакти зберігаються в
              акаунті, наступного разу буде вдвічі швидше.
            </p>
          </header>

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
                subtitle="Дзвонимо лише за крайньої потреби — наприклад, якщо кур'єр не може знайти адресу."
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
              <FormGroup
                step="02"
                title="Доставка"
                subtitle="Безкоштовно від 800 ₴ для відділень / поштоматів."
              >
                <div className="grid sm:grid-cols-3 gap-3 mb-6">
                  <DeliveryOption
                    label="НП відділення"
                    sub="1–2 дні"
                    active={delivery === "novaposhta-branch"}
                    onClick={() => setDelivery("novaposhta-branch")}
                  />
                  <DeliveryOption
                    label="НП поштомат"
                    sub="1–2 дні"
                    active={delivery === "novaposhta-postomat"}
                    onClick={() => setDelivery("novaposhta-postomat")}
                  />
                  <DeliveryOption
                    label="Самовивіз"
                    sub="Київ · сьогодні"
                    active={delivery === "pickup"}
                    onClick={() => setDelivery("pickup")}
                  />
                </div>

                {delivery !== "pickup" ? (
                  <div className="grid sm:grid-cols-2 gap-5">
                    <Field
                      id="city"
                      label="Місто"
                      value={city}
                      onChange={setCity}
                      autoComplete="address-level2"
                      placeholder="Київ"
                      required
                    />
                    <Field
                      id="destination"
                      label={
                        delivery === "novaposhta-postomat"
                          ? "Номер поштомату"
                          : "Номер або адреса відділення"
                      }
                      value={destination}
                      onChange={setDestination}
                      placeholder={
                        delivery === "novaposhta-postomat" ? "№312" : "№47, Хрещатик 22"
                      }
                      required
                    />
                  </div>
                ) : (
                  <div className="rounded-[var(--radius-lg)] bg-[var(--color-bg-secondary)] px-5 py-4 text-sm leading-relaxed">
                    <p className="font-display font-semibold text-base">
                      Київ, вул. Велика Васильківська, 24
                    </p>
                    <p className="mt-1 text-[var(--color-text-secondary)]">
                      Щодня 8:00–22:00 · Свіжообсмажене — зазвичай готове за
                      1-2 години після оформлення
                    </p>
                  </div>
                )}
              </FormGroup>

              {/* Group 3: Payment */}
              <FormGroup step="03" title="Оплата">
                <div className="grid sm:grid-cols-2 gap-3">
                  <PaymentOption
                    label="Картка онлайн"
                    sub="LiqPay · Apple/Google Pay"
                    active={payment === "card"}
                    onClick={() => setPayment("card")}
                  />
                  <PaymentOption
                    label="При отриманні"
                    sub="Готівка або термінал"
                    active={payment === "cod"}
                    onClick={() => setPayment("cod")}
                  />
                </div>
              </FormGroup>

              {/* Group 4: Comment */}
              <FormGroup step="04" title="Коментар до замовлення (опційно)">
                <textarea
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Подзвонити перед відправкою / просьба покласти подарунковий пакет / тощо"
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
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-3"
                    >
                      <span
                        aria-hidden
                        className="block h-12 w-12 shrink-0 rounded-[var(--radius-md)]"
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
                      <p className="text-sm font-display font-semibold tabular-nums">
                        {formatPrice(item.unitPrice * item.quantity)}
                      </p>
                    </li>
                  ))}
                </ul>

                {/* Free-shipping progress in compact form — appears
                    between item list and the price breakdown so the
                    user sees the threshold one last time before
                    confirming. Hidden on pickup since it doesn't apply. */}
                {delivery !== "pickup" && (
                  <div className="mt-5 pt-5 border-t border-[var(--color-border-default)]">
                    <FreeShippingProgress amount={subtotal} variant="compact" />
                  </div>
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
                      Доставка
                    </dt>
                    <dd className="tabular-nums">
                      {deliveryFee === 0 ? (
                        <span className="text-emerald-700">Безкоштовно</span>
                      ) : (
                        formatPrice(deliveryFee)
                      )}
                    </dd>
                  </div>
                </dl>

                <div className="mt-5 pt-4 border-t border-[var(--color-border-default)] flex items-baseline justify-between">
                  <span className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]">
                    До сплати
                  </span>
                  <span className="font-display text-2xl lg:text-3xl font-semibold tabular-nums">
                    {formatPrice(total)}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] px-6 py-4 text-sm tracking-[0.12em] uppercase hover:opacity-85 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      {payment === "card" ? "Оплатити" : "Підтвердити"}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                <p className="mt-5 inline-flex items-center gap-2 text-[11px] text-[var(--color-text-muted)] leading-relaxed">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Дані захищені · PCI-DSS на стороні провайдера
                </p>
              </div>
            </aside>
          </form>
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
  onClick,
}: {
  label: string;
  sub: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-[var(--radius-lg)] border px-5 py-4 text-left transition-all duration-300",
        active
          ? "border-[var(--color-text-primary)] bg-[var(--color-text-primary)] text-[var(--color-text-inverse)]"
          : "border-[var(--color-border-strong)] hover:border-[var(--color-text-primary)]",
      )}
    >
      <p className="font-display font-semibold text-base">{label}</p>
      <p
        className={cn(
          "mt-1 text-xs",
          active ? "text-white/60" : "text-[var(--color-text-muted)]",
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
  onClick,
}: {
  label: string;
  sub: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-[var(--radius-lg)] border px-5 py-4 text-left transition-all duration-300",
        active
          ? "border-[var(--color-text-primary)] bg-[var(--color-text-primary)] text-[var(--color-text-inverse)]"
          : "border-[var(--color-border-strong)] hover:border-[var(--color-text-primary)]",
      )}
    >
      <p className="font-display font-semibold text-base">{label}</p>
      <p
        className={cn(
          "mt-1 text-xs",
          active ? "text-white/60" : "text-[var(--color-text-muted)]",
        )}
      >
        {sub}
      </p>
    </button>
  );
}
