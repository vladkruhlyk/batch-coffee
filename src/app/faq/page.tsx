"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { SectionKicker } from "@/components/layout/section-kicker";
import { EASING } from "@/lib/easing";
import { cn } from "@/lib/utils";

interface QA {
  q: string;
  a: string;
}

interface FaqCategory {
  title: string;
  items: QA[];
}

/**
 * Mock FAQ content. When CMS lands this becomes a Sanity fetch returning
 * `FaqCategory[]` — same shape. Editorial team can add categories /
 * questions through the studio without touching code.
 */
const CATEGORIES: FaqCategory[] = [
  {
    title: "Свіжість і зберігання",
    items: [
      {
        q: "Наскільки свіжа ваша кава?",
        a: "Обсмажуємо щотижня, замовлення пакуємо в день обсмажування або наступний. На упаковці завжди стоїть точна дата. Найкращий смак — з 7-го по 21-й день від обсмаження.",
      },
      {
        q: "Скільки можна зберігати каву вдома?",
        a: "В закритому пакеті з клапаном — до 60 днів від дати обсмажування. Після відкриття — до 30 днів. Бажано тримати в темному прохолодному місці, не в холодильнику.",
      },
      {
        q: "Чому не варто молоти каву заздалегідь?",
        a: "Після помелу кава втрачає 60% ароматики за 15 хвилин. Тому беремо зерна — і мелемо щоразу перед заварюванням. Якщо без млинка — обираємо помел під свій метод і фактично прицельно заварюємо протягом 7-10 днів.",
      },
    ],
  },
  {
    title: "Доставка",
    items: [
      {
        q: "Скільки коштує доставка?",
        a: "Нова Пошта — 80 ₴. Від 800 ₴ замовлення — безкоштовно. Самовивіз з кав'ярні в центрі Києва — без оплати.",
      },
      {
        q: "Як швидко прийде замовлення?",
        a: "Доставка Новою Поштою — 1-2 дні. Самовивіз — найчастіше в той самий день (зазвичай за 1-2 години після оформлення, бо обсмажуємо під замовлення).",
      },
      {
        q: "Чи доставляєте за кордон?",
        a: "Поки тільки по Україні. Якщо плануєш закордонну відправку — напиши нам на пошту, обговоримо індивідуально.",
      },
    ],
  },
  {
    title: "Підписка",
    items: [
      {
        q: "Як працює підписка?",
        a: "Ти обираєш сорт, помел і періодичність (раз на 2 або 4 тижні). Перша коробка йде зі знижкою. Кожна наступна — за днем, який ти задаєш. Призупиняти, міняти план, скасовувати — в один клік з кабінету.",
      },
      {
        q: "Чи можна змінити сорт між доставками?",
        a: "Так, в будь-який момент. Заходиш у /account/subscriptions, кнопка «Замінити сорт» — обираєш будь-яку каву з каталогу. Зміна застосовується до наступної доставки.",
      },
      {
        q: "Як скасувати підписку?",
        a: "Кабінет → Підписка → Скасувати. Без хвостів, без штрафів. Скасована підписка одразу припиняє всі майбутні списання.",
      },
    ],
  },
  {
    title: "Оплата і повернення",
    items: [
      {
        q: "Якими картками можна платити?",
        a: "Будь-яка Visa / Mastercard української та більшості іноземних банків. Apple Pay і Google Pay — теж. Оплата проходить через LiqPay, ми не зберігаємо дані картки.",
      },
      {
        q: "Чи можу повернути каву?",
        a: "Так, протягом 14 днів якщо упаковка не відкривалась. Якщо отримав не той сорт, або кава здається не такою — теж пиши, розберемось індивідуально.",
      },
      {
        q: "Чи є знижки для постійних клієнтів?",
        a: "Так. Підписники отримують -10% з другої коробки. Програма лояльності з балами планується — стартує разом з повноцінним релізом сайту.",
      },
    ],
  },
  {
    title: "Заварювання і обладнання",
    items: [
      {
        q: "Яку каву обрати під мою кавоварку?",
        a: "Якщо еспресо-машина — обирай профіль «Еспресо» на сторінці товару. Якщо V60, Аеропрес, Chemex — «Фільтр». Якщо моя капсулка — поки тільки наш House Blend в капсульному форматі.",
      },
      {
        q: "Якщо не знаюсь на каві — з чого почати?",
        a: "House Blend N°1 — наш стартовий бленд, м’який, без ризику. До нього додай дрипи на 6 пакетиків — щоб скуштувати моносорти без покупки повної упаковки.",
      },
      {
        q: "Чи навчите готувати каву?",
        a: "Так — у Brew Guide. Шість покрокових гайдів під різні методи. Якщо потрібен живий майстер-клас — пиши, проводимо в кавʼярні раз на місяць (4-6 учасників).",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Container size="default" className="pt-28 lg:pt-36 pb-[var(--section-gap)]">
          {/* Hero */}
          <header className="mb-16 lg:mb-24 max-w-2xl">
            <SectionKicker label="FAQ" />
            <h1 className="font-display font-semibold text-[clamp(2rem,4.5vw,4rem)] leading-[1.02] tracking-[-0.04em] mt-10">
              Відповіді на те, що питають
              <span className="block text-[var(--color-text-secondary)] font-medium">
                найчастіше.
              </span>
            </h1>
            <p className="mt-7 text-[var(--color-text-secondary)] leading-relaxed">
              Не знайшов відповідь? Напиши нам в Telegram або на email —
              відповідаємо протягом години в робочі години.
            </p>
          </header>

          {/* Categories */}
          <div className="flex flex-col gap-14 lg:gap-20">
            {CATEGORIES.map((cat) => (
              <section key={cat.title}>
                <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-[-0.025em] mb-7">
                  {cat.title}
                </h2>
                <ul className="flex flex-col gap-2">
                  {cat.items.map((qa, i) => (
                    <Item key={i} qa={qa} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}

function Item({ qa }: { qa: QA }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 px-5 py-5 lg:px-7 lg:py-6 text-left hover:bg-[var(--color-bg-secondary)] transition-colors"
      >
        <span className="font-display text-base lg:text-lg font-semibold">
          {qa.q}
        </span>
        <span
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--color-border-strong)] transition-all duration-300",
            open && "rotate-45 bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] border-[var(--color-text-primary)]",
          )}
        >
          <Plus className="h-4 w-4" strokeWidth={1.8} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASING.smooth }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-6 lg:px-7 lg:pb-7 text-[var(--color-text-secondary)] leading-relaxed">
              {qa.a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}
