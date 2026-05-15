import type { Metadata } from "next";
import Link from "next/link";
import {
  CreditCard,
  HandCoins,
  MapPin,
  PackageCheck,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { Container } from "@/components/layout/container";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { SectionKicker } from "@/components/layout/section-kicker";

export const metadata: Metadata = {
  title: "Доставка і оплата — BATCH Coffee",
  description:
    "Як ми доставляємо: Нова Пошта по Україні, поштомати, самовивіз. Оплата картою через LiqPay або при отриманні.",
};

/**
 * Delivery + payment info — single static page explaining the logistics.
 *
 * Three sections:
 *   - Способи доставки (Nova Poshta branch / postomat / pickup)
 *   - Оплата (card / cash on delivery)
 *   - Часті ситуації (несумісність адреси, повернення, тощо)
 *
 * Editorial layout with tile-style cards — same visual grammar as the
 * rest of the site, so this doesn't read like a legal doc.
 */
export default function DeliveryPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Container size="wide" className="pt-28 lg:pt-36 pb-[var(--section-gap)]">
          {/* Hero */}
          <header className="grid lg:grid-cols-12 gap-8 mb-16 lg:mb-24">
            <div className="lg:col-span-8">
              <SectionKicker label="Доставка та оплата" />
              <h1 className="font-display font-semibold text-[clamp(2rem,4.5vw,4rem)] leading-[1.02] tracking-[-0.04em] mt-10">
                Як кава доїжджає
                <span className="block text-[var(--color-text-secondary)] font-medium">
                  до твоєї чашки.
                </span>
              </h1>
            </div>
            <div className="lg:col-span-4 lg:col-start-9 lg:pt-6">
              <p className="text-[var(--color-text-secondary)] leading-relaxed">
                Усе чесно і без зірочок: вартість, терміни, способи оплати,
                що робити коли щось пішло не так.
              </p>
            </div>
          </header>

          {/* Способи доставки */}
          <section className="mb-20 lg:mb-28">
            <h2 className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] mb-7">
              Способи доставки
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
              <DeliveryTile
                icon={<Truck className="h-4 w-4" />}
                title="Нова Пошта — відділення"
                price="80 ₴"
                free="Безкоштовно від 3 500 ₴"
                duration="1-2 дні"
                body="Найпопулярніший варіант. Доставляємо на будь-яке відділення в Україні. Заберти можна впродовж 5 днів."
              />
              <DeliveryTile
                icon={<PackageCheck className="h-4 w-4" />}
                title="Нова Пошта — поштомат"
                price="80 ₴"
                free="Безкоштовно від 3 500 ₴"
                duration="1-2 дні"
                body="Великих міст. Зручно якщо не любиш черги — забираєш цілодобово за QR-кодом з SMS."
              />
              <DeliveryTile
                icon={<MapPin className="h-4 w-4" />}
                title="Самовивіз з кавʼярні"
                price="Безкоштовно"
                duration="Сьогодні · Полтава"
                body="Полтава, вул. Соборності, 27. Зазвичай готово за 1-2 години після замовлення — обсмажуємо саме під тебе."
              />
            </div>
          </section>

          {/* Оплата */}
          <section className="mb-20 lg:mb-28">
            <h2 className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] mb-7">
              Оплата
            </h2>
            <div className="grid sm:grid-cols-2 gap-4 lg:gap-5">
              <PaymentTile
                icon={<CreditCard className="h-4 w-4" />}
                title="Картка онлайн"
                body="LiqPay — Visa, Mastercard, Apple Pay, Google Pay. Дані картки до нас не доходять — все обробляється на стороні провайдера. PCI-DSS, чи що там модно."
                badge="Рекомендуємо"
              />
              <PaymentTile
                icon={<HandCoins className="h-4 w-4" />}
                title="При отриманні"
                body="Готівка або термінал на відділенні Нової Пошти. Зручно, але +20 ₴ комісія Нової Пошти при оформленні післяплати."
              />
            </div>
          </section>

          {/* Часті ситуації */}
          <section className="mb-20 lg:mb-28">
            <h2 className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] mb-7">
              Що, якщо…
            </h2>
            <ul className="flex flex-col gap-3">
              <Scenario
                title="Я не встиг забрати посилку"
                body="Нова Пошта тримає посилку на відділенні 5 днів. Після цього її повертають нам. Щоб переслати — напиши, оформимо повторну відправку (доплата лише за переадресацію НП, без сервісного збору з нашого боку)."
              />
              <Scenario
                title="Замовлення прийшло пошкоджене"
                body="Скинь нам фото з трекінгом і обкладинкою — переоформимо безкоштовно. Ні питань, ні умов. Кава мала доїхати в нормальному вигляді."
              />
              <Scenario
                title="Замовив не той сорт"
                body="14 днів на повернення, якщо упаковка не відкривалась. Якщо відкрив і зрозумів що це не твоє — теж пиши, замінимо на щось ближче до твого профілю смаку."
              />
              <Scenario
                title="Хочу свіжіше"
                body="Обсмажування ми робимо щотижня. Якщо замовиш до 12:00 в день обсмажування — кава поїде того ж вечора. Дата обсмажування — на упаковці й в email-підтвердженні."
              />
            </ul>
          </section>

          {/* Trust */}
          <section className="rounded-[var(--radius-2xl)] bg-[var(--color-bg-dark)] text-[var(--color-text-inverse)] p-8 lg:p-12">
            <div className="flex items-start gap-5">
              <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-300" />
              <div>
                <h3 className="font-display text-2xl lg:text-3xl font-semibold tracking-[-0.025em]">
                  100% гарантія якості
                </h3>
                <p className="mt-3 text-white/75 leading-relaxed max-w-2xl">
                  Якщо кава тобі не сподобалась — поверни залишок і ми
                  повернемо повну вартість. Без анкет, без «чому». Ми робимо
                  каву для людей, які знають смак. І якщо твоя — інша, нічого
                  страшного.
                </p>
                <Link
                  href="/contacts"
                  className="mt-5 inline-flex items-center gap-2 text-sm tracking-[0.12em] uppercase pb-1 border-b border-white/30 hover:border-white transition-colors"
                >
                  Написати нам →
                </Link>
              </div>
            </div>
          </section>
        </Container>
      </main>
      <Footer />
    </>
  );
}

function DeliveryTile({
  icon,
  title,
  price,
  free,
  duration,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  price: string;
  free?: string;
  duration: string;
  body: string;
}) {
  return (
    <article className="flex flex-col rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-6 lg:p-7">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] mb-5">
        {icon}
      </span>
      <h3 className="font-display text-xl font-semibold tracking-[-0.02em]">
        {title}
      </h3>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-display text-2xl font-semibold tabular-nums">
          {price}
        </span>
        <span className="text-[11px] tracking-[0.22em] uppercase text-[var(--color-text-muted)]">
          · {duration}
        </span>
      </div>
      {free && (
        <p className="mt-1 text-xs text-emerald-700 tabular-nums">{free}</p>
      )}
      <p className="mt-4 text-sm text-[var(--color-text-secondary)] leading-relaxed">
        {body}
      </p>
    </article>
  );
}

function PaymentTile({
  icon,
  title,
  body,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  badge?: string;
}) {
  return (
    <article className="relative flex flex-col rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-6 lg:p-7">
      {badge && (
        <span className="absolute top-5 right-5 inline-flex items-center text-[10px] tracking-[0.25em] uppercase rounded-full px-2.5 py-1 bg-emerald-100 text-emerald-800">
          {badge}
        </span>
      )}
      <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] mb-5">
        {icon}
      </span>
      <h3 className="font-display text-xl font-semibold tracking-[-0.02em]">
        {title}
      </h3>
      <p className="mt-3 text-sm text-[var(--color-text-secondary)] leading-relaxed">
        {body}
      </p>
    </article>
  );
}

function Scenario({ title, body }: { title: string; body: string }) {
  return (
    <li className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-5 lg:p-6">
      <p className="font-display text-base lg:text-lg font-semibold">{title}</p>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)] leading-relaxed">
        {body}
      </p>
    </li>
  );
}
