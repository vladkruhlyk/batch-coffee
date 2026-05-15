"use client";

import Link from "next/link";
import { Construction, Mail } from "lucide-react";
import { Container } from "@/components/layout/container";

/**
 * Full-page placeholder for subscription routes that are temporarily
 * gated off. The subscription flow needs LiqPay recurring tokens + a
 * cron job to charge them, neither of which is wired yet — until then
 * we don't want customers committing to a recurring charge that won't
 * happen.
 *
 * Used by:
 *   - /subscription/setup — the "Оформити підписку" entry point
 *   - /account/subscriptions — the management UI for active subs
 *
 * Drop usage from both pages once subscriptions actually work.
 */
export function SubscriptionComingSoon({
  context = "setup",
}: {
  /** Drives the copy. "setup" frames it as "subscribing is coming",
   *  "manage" frames it as "managing your sub is coming". */
  context?: "setup" | "manage";
}) {
  const copy =
    context === "manage"
      ? {
          title: "Підписка скоро запрацює",
          body: "Ми ще доналаштовуємо рекурентні платежі та автоматичні відправлення. Як тільки все буде готове — напишемо тобі на пошту і відкриємо керування підпискою.",
          ctaLabel: "Купити каву разово",
          ctaHref: "/shop",
          secondaryLabel: "До кабінету",
          secondaryHref: "/account",
        }
      : {
          title: "Поки недоступно",
          body: "Підписка — наступний крок розвитку магазину. Ми ще не підключили автосписання, тож оформити її не вийде. Тим часом можна замовити каву разово — все працює, як і має.",
          ctaLabel: "У каталог",
          ctaHref: "/shop",
          secondaryLabel: "До головної",
          secondaryHref: "/",
        };

  return (
    <Container size="default" className="pt-28 lg:pt-36 pb-24">
      <div className="max-w-2xl mx-auto text-center">
        <div className="mx-auto h-16 w-16 rounded-full bg-amber-100 grid place-items-center">
          <Construction
            className="h-7 w-7 text-amber-800"
            strokeWidth={1.6}
          />
        </div>

        <span className="block mt-8 text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]">
          Скоро
        </span>
        <h1 className="mt-4 font-display font-semibold text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.05] tracking-[-0.035em]">
          {copy.title}
        </h1>
        <p className="mt-5 text-[var(--color-text-secondary)] leading-relaxed">
          {copy.body}
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={copy.ctaHref}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] px-7 py-3.5 text-sm tracking-[0.12em] uppercase hover:opacity-85 transition-opacity"
          >
            {copy.ctaLabel}
          </Link>
          <Link
            href={copy.secondaryHref}
            className="inline-flex items-center gap-2 text-sm tracking-[0.12em] uppercase pb-1 border-b border-[var(--color-text-primary)] hover:opacity-70 transition-opacity"
          >
            {copy.secondaryLabel}
          </Link>
        </div>

        <p className="mt-10 inline-flex items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
          <Mail className="h-3.5 w-3.5" strokeWidth={1.6} />
          Запишемо тебе у вейтлист — повідомимо щойно запрацює
        </p>
      </div>
    </Container>
  );
}
