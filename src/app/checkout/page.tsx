"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Loader2, Lock, ShieldCheck } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { useCart, getCartSubtotal } from "@/lib/cart-store";
import { useAuth, formatPhone, normalizePhone } from "@/lib/auth-store";
import { createOrder } from "@/lib/orders";
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
  line1: "Київ, вул. Велика Васильківська, 24",
  hours: "Щодня 8:00–22:00",
};

export default function CheckoutPage() {
  const router = useRouter();
  const items = useCart((s) => s.items);
  const clearCart = useCart((s) => s.clear);
  const user = useAuth((s) => s.user);
  const hydrated = useAuth((s) => s.hydrated);

  // Form state — flat for simplicity. Pickup-only flow, so no city /
  // destination fields.
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [comment, setComment] = useState("");
  const [agreed, setAgreed] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Auth gate. Guest checkout would need a token-in-URL scheme for the
  // confirmation page to be accessible later — defer until we wire
  // real payments. For now: must be logged in.
  useEffect(() => {
    if (hydrated && !user) {
      router.replace("/login?next=/checkout");
    }
  }, [hydrated, user, router]);

  const subtotal = getCartSubtotal(items);
  // Pickup is free; that's the only delivery method available right now.
  const deliveryFee = 0;
  const total = subtotal + deliveryFee;

  const canSubmit =
    items.length > 0 &&
    firstName.trim() &&
    lastName.trim() &&
    normalizePhone(phone).length >= 8 &&
    agreed &&
    !submitting &&
    !!user;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !user) return;
    setSubmitting(true);
    setError(null);
    try {
      const { number } = await createOrder({
        userId: user.id,
        recipientFirstName: firstName.trim(),
        recipientLastName: lastName.trim(),
        recipientPhone: normalizePhone(phone),
        recipientEmail: email.trim() || user.email || null,
        deliveryMethod: "pickup",
        deliveryAddress: PICKUP_ADDRESS.line1,
        deliveryCity: "Київ",
        paymentMethod: "cod",
        comment: comment.trim() || null,
        deliveryFee,
        items: items.map((it) => ({
          productSlug: it.slug,
          productName: it.name,
          thumb: it.thumb,
          weightLabel: it.weightLabel,
          weightGrams: it.weightGrams,
          roast: it.roast ?? null,
          grind: it.grind ?? null,
          unitPrice: it.unitPrice,
          quantity: it.quantity,
        })),
      });
      clearCart();
      router.push(`/order/${number}`);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не вдалось оформити. Спробуй ще раз.",
      );
      setSubmitting(false);
    }
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

          <header className="mb-10 lg:mb-12">
            <h1 className="font-display font-semibold text-[clamp(2rem,4.5vw,3.75rem)] leading-[1.02] tracking-[-0.04em]">
              Оформлення замовлення
            </h1>
            <p className="mt-3 text-[var(--color-text-secondary)] max-w-xl">
              Заповни контакти — і кава чекатиме тебе в кав&apos;ярні.
            </p>
          </header>

          {/* Banner — explains why some options are locked */}
          <div className="mb-10 lg:mb-12 rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-secondary)] px-5 py-4 lg:px-6 lg:py-5 flex items-start gap-4">
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
                    active
                    available
                    onClick={() => {
                      /* only option right now */
                    }}
                  />
                  <PaymentOption
                    label="Картка онлайн"
                    sub="Скоро · LiqPay · Apple/Google Pay"
                    active={false}
                    available={false}
                    onClick={() => {
                      /* disabled */
                    }}
                  />
                </div>
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
