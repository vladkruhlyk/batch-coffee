"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { motion } from "framer-motion";
import { Check, Mail, Package, Truck } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { EASING } from "@/lib/easing";

/**
 * Order confirmation page — shown after a successful checkout.
 *
 * The order id arrives via `?order=BAT-1234`. In mock-mode we just echo it
 * back as a confirmation number. When Supabase lands, we'll fetch the row
 * server-side and render real items + tracking number once Nova Poshta
 * generates the ТТН.
 *
 * Designed as a "landing celebration" — a soft confetti-free moment with
 * a tick mark, what-happens-next steps, and links onward. No false promises
 * (we don't pretend the ТТН is ready instantly), just clear timelines.
 */
export default function OrderSuccessPage() {
  return (
    <>
      <Header />
      <main className="flex-1 bg-[var(--color-bg-primary)]">
        <Container size="default" className="pt-28 lg:pt-36 pb-24">
          <Suspense fallback={null}>
            <Body />
          </Suspense>
        </Container>
      </main>
      <Footer />
    </>
  );
}

function Body() {
  const params = useSearchParams();
  const orderId = params.get("order") ?? "BAT-XXXX";

  return (
    <div className="text-center max-w-2xl mx-auto">
      {/* Animated tick */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: EASING.smooth, delay: 0.1 }}
        className="mx-auto h-20 w-20 rounded-full bg-emerald-100 grid place-items-center"
      >
        <Check className="h-10 w-10 text-emerald-700" strokeWidth={2.5} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASING.smooth, delay: 0.3 }}
      >
        <span className="block mt-8 text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]">
          Замовлення підтверджено
        </span>
        <h1 className="mt-4 font-display font-semibold text-[clamp(2rem,4.5vw,3.75rem)] leading-[1.02] tracking-[-0.04em]">
          Дякуємо! Вже обсмажуємо.
        </h1>
        <p className="mt-5 text-[var(--color-text-secondary)] leading-relaxed">
          Номер твого замовлення —{" "}
          <span className="font-display font-semibold text-[var(--color-text-primary)] tabular-nums">
            {orderId}
          </span>
          . Підтвердження вже летить тобі на email, а ми тим часом починаємо
          пакувати.
        </p>
      </motion.div>

      {/* What happens next */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASING.smooth, delay: 0.5 }}
        className="mt-14 text-left"
      >
        <h2 className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] text-center mb-8">
          Що далі
        </h2>
        <ol className="flex flex-col gap-5">
          <Step
            icon={<Mail className="h-4 w-4" />}
            number="01"
            title="Підтвердження"
            body="Зараз отримаєш email з деталями замовлення і чеком."
            now
          />
          <Step
            icon={<Package className="h-4 w-4" />}
            number="02"
            title="Свіже обсмажування"
            body="Обсмажуємо саме під твоє замовлення — для збереження аромату. Зазвичай у той самий або наступний день."
          />
          <Step
            icon={<Truck className="h-4 w-4" />}
            number="03"
            title="Доставка"
            body="Як тільки замовлення поїде, надішлемо ТТН Нової Пошти. Доставка 1-2 дні."
          />
        </ol>
      </motion.section>

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASING.smooth, delay: 0.7 }}
        className="mt-14 flex flex-wrap items-center justify-center gap-3"
      >
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
      </motion.div>
    </div>
  );
}

function Step({
  icon,
  number,
  title,
  body,
  now = false,
}: {
  icon: React.ReactNode;
  number: string;
  title: string;
  body: string;
  now?: boolean;
}) {
  return (
    <li className="flex items-start gap-5 rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-5 lg:p-6">
      <span
        aria-hidden
        className={
          now
            ? "mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-800"
            : "mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
        }
      >
        {icon}
      </span>
      <div>
        <div className="flex items-baseline gap-3">
          <span className="font-display text-xs text-[var(--color-text-muted)] tabular-nums">
            N°{number}
          </span>
          <h3 className="font-display text-lg font-semibold">{title}</h3>
          {now && (
            <span className="inline-flex items-center text-[10px] tracking-[0.25em] uppercase rounded-full px-2 py-0.5 bg-emerald-100 text-emerald-800">
              зараз
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)] leading-relaxed">
          {body}
        </p>
      </div>
    </li>
  );
}
