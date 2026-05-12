"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Lock } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import {
  PRODUCTS,
  isCoffeeCategory,
  type Product,
} from "@/data/products";
import {
  useSubscription,
  SUBSCRIPTION_DISCOUNT_PERCENT,
} from "@/lib/subscription-store";
import { useAuth } from "@/lib/auth-store";
import { PaymentDialog } from "@/components/subscription/payment-dialog";
import { formatPrice, cn } from "@/lib/utils";

interface FrequencyOption {
  label: string;
  sub: string;
  days: number;
}

const FREQUENCIES: FrequencyOption[] = [
  { label: "Кожні 2 тижні", sub: "Швидкий ритм для щоденників", days: 14 },
  { label: "Раз на 3 тижні", sub: "Найпопулярніший вибір", days: 21 },
  { label: "Раз на місяць", sub: "Класика", days: 28 },
];

/**
 * Subscription signup — all-in-one configurator on a single page.
 *
 * Why a single page rather than a 4-step wizard:
 *   - The choices are interdependent and easier to scan together
 *   - Less commitment / less drop-off than a multi-step form
 *   - Right-rail summary keeps the price live so users see effect of edits
 *
 * Submit writes to the local Zustand store (mocked) and bounces the user
 * into /account/subscriptions where they can manage from there. When
 * Supabase + LiqPay land, `subscribe()` becomes a POST to /api/subscriptions
 * which returns the new row + a LiqPay recurring-token redirect.
 */
export default function SubscriptionSetupPage() {
  const router = useRouter();
  const subscribe = useSubscription((s) => s.subscribe);
  const user = useAuth((s) => s.user);
  const hydrated = useAuth((s) => s.hydrated);

  // Coffee-only SKUs that can be subscribed to. Drip / capsules / gear
  // aren't subscribable in mock-mode — they're either pre-portioned (drip)
  // or non-recurring purchases (gear, gifts).
  const products = useMemo(
    () =>
      PRODUCTS.filter(
        (p) => isCoffeeCategory(p.category) && p.category === "beans",
      ),
    [],
  );

  const [productSlug, setProductSlug] = useState(products[0]?.slug ?? "");
  const product = products.find((p) => p.slug === productSlug) ?? products[0];

  const [weightIndex, setWeightIndex] = useState(0);
  const [roastIndex, setRoastIndex] = useState(0);
  const [frequency, setFrequency] = useState<FrequencyOption>(FREQUENCIES[1]);
  const [quantity, setQuantity] = useState(1);
  const [paymentOpen, setPaymentOpen] = useState(false);

  if (!product) return null;
  const weight = product.weights[Math.min(weightIndex, product.weights.length - 1)];
  const roast = product.roasts?.[roastIndex];
  const hasRoasts = (product.roasts?.length ?? 0) > 0;

  // Pricing — total before discount, discounted price, total saved.
  const unitTotal = weight.price * quantity;
  const discounted = Math.round(unitTotal * (1 - SUBSCRIPTION_DISCOUNT_PERCENT / 100));
  const saved = unitTotal - discounted;

  // Monthly equivalent — useful headline number so the user can compare
  // "per month" across different frequencies. Approximate to 30 days.
  const cyclesPerMonth = 30 / frequency.days;
  const monthlyEstimate = Math.round(discounted * cyclesPerMonth);

  /**
   * Submit handler — two-stage gate.
   *
   *   1. If the user isn't signed in (auth-store hydrated and no user),
   *      route to /login with ?next pointing back here. After verifying
   *      the code they land on this same configurator with all selections
   *      lost (state is in-page only); that's acceptable since the
   *      configurator is fast to redo, and most users won't bounce out.
   *
   *   2. If signed in, open the payment dialog. The actual `subscribe()`
   *      mutation runs only after a successful payment, mirroring how
   *      real LiqPay flows would work — no half-baked subscriptions in
   *      the DB if payment fails.
   */
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (hydrated && !user) {
      router.push("/login?next=/subscription/setup");
      return;
    }
    setPaymentOpen(true);
  };

  const handlePaid = () => {
    subscribe({
      productSlug: product.slug,
      productName: product.name,
      thumb: product.gallery[0],
      weightLabel: weight.label,
      weightGrams: weight.grams,
      roast,
      intervalDays: frequency.days,
      quantity,
      unitPrice: weight.price,
    });
    setPaymentOpen(false);
    router.push("/account/subscriptions?welcome=1");
  };

  return (
    <>
      <Header />
      <main className="flex-1">
        <Container size="wide" className="pt-28 lg:pt-36 pb-[var(--section-gap)]">
          <Link
            href="/subscription"
            className="inline-flex items-center gap-2 text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors mb-8"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Назад
          </Link>

          {/* Hero */}
          <header className="mb-12 lg:mb-16 max-w-3xl">
            <span className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]">
              Підписка · Налаштування
            </span>
            <h1 className="mt-4 font-display font-semibold text-[clamp(2rem,4.5vw,3.75rem)] leading-[1.02] tracking-[-0.04em]">
              Зберемо твою коробку.
            </h1>
            <p className="mt-5 text-[var(--color-text-secondary)] leading-relaxed">
              Обери сорт, варіант обсмажки і ритм — а ми будемо відправляти
              свіжу каву автоматично. Зі знижкою −{SUBSCRIPTION_DISCOUNT_PERCENT}%
              від звичайної ціни, з гнучкою паузою у кабінеті.
            </p>

            {/* Auth notice — soft non-blocking banner. The Submit button
                handles the real gate (redirects to /login). Showing the
                hint up front avoids surprise on click. */}
            {hydrated && !user && (
              <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-bg-secondary)] px-4 py-2 text-sm">
                <Lock className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                <span>
                  Для оформлення потрібен акаунт.{" "}
                  <Link
                    href="/login?next=/subscription/setup"
                    className="text-[var(--color-text-primary)] underline underline-offset-4 decoration-[var(--color-border-strong)] hover:decoration-[var(--color-text-primary)]"
                  >
                    Увійти
                  </Link>
                </span>
              </div>
            )}
          </header>

          <form onSubmit={submit} className="grid lg:grid-cols-12 gap-8 lg:gap-12">
            {/* Configurator */}
            <div className="lg:col-span-8 flex flex-col gap-12">
              {/* Step 1 — product */}
              <section>
                <StepHeader number="01" title="Обери сорт" />
                <div className="grid sm:grid-cols-2 gap-3 lg:gap-4">
                  {products.map((p) => (
                    <ProductOption
                      key={p.slug}
                      product={p}
                      active={p.slug === productSlug}
                      onClick={() => {
                        setProductSlug(p.slug);
                        setWeightIndex(0);
                        setRoastIndex(0);
                      }}
                    />
                  ))}
                </div>
              </section>

              {/* Step 2 — weight + roast */}
              <section>
                <StepHeader number="02" title="Вага і обсмажка" />
                <div className="flex flex-col gap-5">
                  <Group label="Вага упаковки">
                    {product.weights.map((w, i) => (
                      <Pill
                        key={w.label}
                        active={i === weightIndex}
                        onClick={() => setWeightIndex(i)}
                      >
                        {w.label} · {formatPrice(w.price)}
                      </Pill>
                    ))}
                  </Group>

                  {hasRoasts && product.roasts && (
                    <Group label="Профіль обсмажки">
                      {product.roasts.map((r, i) => (
                        <Pill
                          key={r}
                          active={i === roastIndex}
                          onClick={() => setRoastIndex(i)}
                          disabled={product.roasts!.length === 1}
                        >
                          {r}
                        </Pill>
                      ))}
                    </Group>
                  )}

                  <Group label="Скільки упаковок за одну доставку">
                    {[1, 2, 3].map((n) => (
                      <Pill
                        key={n}
                        active={n === quantity}
                        onClick={() => setQuantity(n)}
                      >
                        {n} {n === 1 ? "пак" : "пак."}
                      </Pill>
                    ))}
                  </Group>
                </div>
              </section>

              {/* Step 3 — frequency */}
              <section>
                <StepHeader number="03" title="Як часто доставляти" />
                <div className="grid sm:grid-cols-3 gap-3 lg:gap-4">
                  {FREQUENCIES.map((f) => (
                    <FrequencyCard
                      key={f.days}
                      option={f}
                      active={f.days === frequency.days}
                      onClick={() => setFrequency(f)}
                    />
                  ))}
                </div>
              </section>

              {/* Benefits — quick reassurance row */}
              <section>
                <ul className="grid sm:grid-cols-3 gap-3">
                  <Benefit
                    title={`-${SUBSCRIPTION_DISCOUNT_PERCENT}% знижка`}
                    sub="На кожне списання"
                  />
                  <Benefit
                    title="Пауза будь-коли"
                    sub="З кабінету, без штрафів"
                  />
                  <Benefit
                    title="Безкоштовна доставка"
                    sub="Від 500 ₴ замовлення"
                  />
                </ul>
              </section>
            </div>

            {/* Summary rail */}
            <aside className="lg:col-span-4">
              <div className="sticky top-28 rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-6 lg:p-7">
                <h2 className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] mb-5">
                  Твоя коробка
                </h2>

                <div className="flex items-center gap-4">
                  <span
                    aria-hidden
                    className="block h-14 w-14 shrink-0 rounded-[var(--radius-lg)]"
                    style={{ backgroundImage: product.gallery[0] }}
                  />
                  <div className="min-w-0">
                    <p className="font-display text-lg font-semibold leading-tight truncate">
                      {product.name}
                    </p>
                    <p className="mt-0.5 text-sm text-[var(--color-text-muted)] truncate">
                      {weight.label}
                      {roast ? ` · ${roast}` : ""} · {quantity}{" "}
                      {quantity === 1 ? "пак" : "пак."}
                    </p>
                  </div>
                </div>

                <dl className="mt-6 pt-5 border-t border-[var(--color-border-default)] flex flex-col gap-3 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-[var(--color-text-secondary)]">
                      Ціна без підписки
                    </dt>
                    <dd className="tabular-nums line-through text-[var(--color-text-muted)]">
                      {formatPrice(unitTotal)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between text-emerald-700">
                    <dt>Знижка</dt>
                    <dd className="tabular-nums">−{formatPrice(saved)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-[var(--color-text-secondary)]">
                      Частота
                    </dt>
                    <dd>{frequency.label}</dd>
                  </div>
                </dl>

                <div className="mt-5 pt-5 border-t border-[var(--color-border-default)]">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]">
                      За одну доставку
                    </span>
                    <span className="font-display text-2xl lg:text-3xl font-semibold tabular-nums">
                      {formatPrice(discounted)}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] text-[var(--color-text-muted)] text-right tabular-nums">
                    ~{formatPrice(monthlyEstimate)} / місяць
                  </p>
                </div>

                <button
                  type="submit"
                  className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] px-6 py-4 text-sm tracking-[0.12em] uppercase hover:opacity-85 transition-opacity"
                >
                  {hydrated && !user ? (
                    <>
                      <Lock className="h-4 w-4" />
                      Увійти та оформити
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      Перейти до оплати
                    </>
                  )}
                </button>

                <p className="mt-4 text-[11px] text-[var(--color-text-muted)] leading-relaxed text-center">
                  Перше списання сьогодні. Призупинити, замінити сорт або
                  скасувати — з кабінету.
                </p>
              </div>
            </aside>
          </form>
        </Container>
      </main>

      {/* Payment dialog — opens only after auth check passes. */}
      <PaymentDialog
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        amount={discounted}
        summary={`${product.name} · ${weight.label}${roast ? ` · ${roast}` : ""} · ${quantity} ${quantity === 1 ? "пак" : "пак."}`}
        cadenceLabel={frequency.label}
        onSuccess={handlePaid}
      />
      <Footer />
    </>
  );
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

function StepHeader({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex items-baseline gap-4 mb-5">
      <span className="font-display text-sm text-[var(--color-text-muted)] tabular-nums">
        N°{number}
      </span>
      <span className="block w-8 h-px bg-[var(--color-border-strong)]" />
      <h3 className="font-display text-xl lg:text-2xl font-semibold tracking-[-0.02em]">
        {title}
      </h3>
    </div>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] tracking-[0.22em] uppercase text-[var(--color-text-muted)] mb-3">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Pill({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center rounded-full px-4 py-2 text-sm transition-all duration-300",
        active
          ? "bg-[var(--color-text-primary)] text-[var(--color-text-inverse)]"
          : "border border-[var(--color-border-strong)] text-[var(--color-text-primary)] hover:border-[var(--color-text-primary)]",
        disabled && "cursor-default",
      )}
    >
      {children}
    </button>
  );
}

function ProductOption({
  product,
  active,
  onClick,
}: {
  product: Product;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "group relative flex items-center gap-4 rounded-[var(--radius-xl)] border p-4 lg:p-5 text-left transition-all duration-300",
        active
          ? "border-[var(--color-text-primary)] bg-[var(--color-bg-secondary)]"
          : "border-[var(--color-border-default)] hover:border-[var(--color-border-strong)]",
      )}
    >
      <span
        aria-hidden
        className="block h-14 w-14 shrink-0 rounded-[var(--radius-lg)]"
        style={{ backgroundImage: product.gallery[0] }}
      />
      <div className="flex-1 min-w-0">
        <p className="font-display text-base font-semibold leading-tight">
          {product.name}
        </p>
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)] truncate">
          {product.origin ?? product.shortDescription}
        </p>
      </div>
      {active && (
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)]">
          <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
        </span>
      )}
    </button>
  );
}

function FrequencyCard({
  option,
  active,
  onClick,
}: {
  option: FrequencyOption;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-[var(--radius-xl)] border p-5 lg:p-6 text-left transition-all duration-300",
        active
          ? "border-[var(--color-text-primary)] bg-[var(--color-text-primary)] text-[var(--color-text-inverse)]"
          : "border-[var(--color-border-strong)] hover:border-[var(--color-text-primary)]",
      )}
    >
      <p className="font-display text-lg font-semibold">{option.label}</p>
      <p
        className={cn(
          "mt-1 text-xs",
          active ? "text-white/60" : "text-[var(--color-text-muted)]",
        )}
      >
        {option.sub}
      </p>
    </button>
  );
}

function Benefit({ title, sub }: { title: string; sub: string }) {
  return (
    <li className="rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-4 flex items-start gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-800">
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
      </span>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{sub}</p>
      </div>
    </li>
  );
}
