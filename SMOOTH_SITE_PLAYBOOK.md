# Smooth Site Playbook

Детальный гайд по созданию плавных, структурных сайтов под **любую нишу**
(не только кофе). Извлечён из реального production-проекта. Можно скормить
любому AI (v0, Claude, Cursor, Bolt) как контекст, или собирать руками.

Принцип: **плавность — это не один эффект, а система согласованных решений** —
единый easing, единые токены, продуманные тайминги, smooth-scroll, и
дисциплина в их применении. Один кривой переход рушит ощущение от всего сайта.

---

## 0. Tech stack

| Слой | Выбор | Зачем |
|---|---|---|
| Framework | **Next.js (App Router)** | SSR/SSG, файловая маршрутизация, server components |
| UI | **React 19** | — |
| Стили | **Tailwind CSS v4** + CSS-переменные | utility-классы + единые токены |
| Анимации | **Framer Motion** | декларативные, прерываемые анимации |
| Smooth scroll | **Lenis** | главный источник «плавности» (lerp-скролл) |
| CMS / контент | **Sanity** (или Contentful/Payload) | контент отдельно от кода |
| База / auth | **Supabase** (Postgres + Auth + RLS) | если нужны юзеры/заказы |
| Состояние | **Zustand** (клиент) + **TanStack Query** (сервер) | лёгкое, без бойлерплейта |
| Иконки | **Lucide React** | консистентный набор, тонкие штрихи |
| Утилиты | `clsx` + `tailwind-merge` (→ `cn()`) | склейка классов без конфликтов |
| Валидация форм | **react-hook-form** + **zod** | типобезопасные формы |

Установка ядра:
```bash
npx create-next-app@latest my-site --typescript --tailwind --app
npm i framer-motion lenis zustand @tanstack/react-query lucide-react clsx tailwind-merge
```

---

## 1. Дизайн-токены (фундамент)

**Правило №1: никаких хардкод-цветов/радиусов в компонентах.** Всё через
CSS-переменные. Это даёт мгновенный ре-брендинг и консистентность.

`globals.css`:
```css
@import "tailwindcss";

:root {
  /* Фон — светлый/editorial. Замени под нишу. */
  --color-bg-primary:   #FFFFFF;   /* основной фон */
  --color-bg-secondary: #F7F5F1;   /* вторичные блоки (тёплый крем) */
  --color-bg-surface:   #FFFFFF;   /* карточки */
  --color-bg-dark:      #1A1612;   /* тёмный — футер, акцент-ленты */

  /* Текст — НЕ чистый #000, всегда «тёплый чёрный» */
  --color-text-primary:   #1A1612;
  --color-text-secondary: #6B6660;
  --color-text-muted:     #A8A29A;
  --color-text-inverse:   #FFFFFF;

  /* Границы — мягкие, низкоконтрастные */
  --color-border-default: #EBE7DF;
  --color-border-strong:  #D9D2C4;

  /* Акцент — фирменный цвет ниши */
  --color-accent:       #2B1F15;
  --color-accent-hover: #3D2817;

  /* Спейсинг секций — clamp() = адаптив без media-queries */
  --section-gap:    clamp(5rem, 10vw, 10rem);
  --section-gap-sm: clamp(3rem, 6vw, 5rem);

  /* Радиус — задаёт «характер» бренда (soft/rounded vs sharp) */
  --radius-sm:   0.625rem;  /* 10px — чипы, инпуты */
  --radius-md:   1rem;      /* 16px — кнопки */
  --radius-lg:   1.5rem;    /* 24px — карточки товаров */
  --radius-xl:   2rem;      /* 32px — большие тайлы */
  --radius-2xl:  2.75rem;   /* 44px — hero/баннеры */
  --radius-pill: 9999px;    /* пилюли/кнопки */
}

/* Tailwind v4 — регистрируем токены как утилиты (bg-primary, text-secondary…) */
@theme inline {
  --color-bg-primary:     var(--color-bg-primary);
  --color-bg-secondary:   var(--color-bg-secondary);
  --color-text-primary:   var(--color-text-primary);
  --color-text-secondary: var(--color-text-secondary);
  --color-text-muted:     var(--color-text-muted);
  --color-border-default: var(--color-border-default);
  --color-border-strong:  var(--color-border-strong);
  --font-display:         var(--font-display);
  --font-sans:            var(--font-sans);
}
```

**Палитра под нишу** (меняешь 8 переменных — меняется весь сайт):
- Premium/editorial: тёплый кремовый + warm-black (как тут)
- Tech/SaaS: чистый белый + electric accent (#5B5BD6)
- Wellness/beauty: пастель + earthy (#E8DDD3 / #8B7355)
- Food/restaurant: тёплые охра/терракота
- Luxury: глубокий тёмный фон + золото

**Радиус под характер:**
- Soft/friendly бренд → большие радиусы (как тут, до 44px)
- Serious/corporate → малые (4–8px) или 0
- Editorial/fashion → часто 0 (острые углы)

---

## 2. Типографика

Два шрифта, оба через `next/font` (zero layout-shift, self-hosted):
- **Display** — заголовки, цены, акценты. Характерный, с характером.
- **Sans** — body, UI. Нейтральный, читаемый, с кириллицей если нужна.

`layout.tsx`:
```tsx
import { Onest } from "next/font/google";       // body — современный гротеск
import localFont from "next/font/local";         // display — self-hosted variable

const display = localFont({
  variable: "--font-display",
  display: "swap",
  src: [{ path: "./fonts/Display-Variable.ttf", weight: "200 900" }],
  fallback: ["system-ui", "sans-serif"],
});
const sans = Onest({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});
```

Базовые правила в `globals.css`:
```css
body {
  font-family: var(--font-sans), system-ui, sans-serif;
  font-feature-settings: "ss01", "ss02";       /* стилистические альтернаты */
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-display), system-ui, sans-serif;
  letter-spacing: -0.02em;   /* лёгкий минус-трекинг для крупных заголовков */
  line-height: 1;
  font-weight: 500;
}
```

**Адаптивные заголовки через `clamp()`** (плавный размер без брейкпоинтов):
```tsx
<h1 className="text-[clamp(2rem,4.5vw,3.75rem)] leading-[1.02] tracking-[-0.04em]">
```

**Микро-типографика — мелкий uppercase-kicker над заголовком** (фирменный приём):
```tsx
<span className="text-[11px] tracking-[0.3em] uppercase text-[var(--color-text-muted)]">
  Раздел
</span>
```

---

## 3. Система анимаций ⭐ (сердце «плавности»)

### 3.1. Единые easing-кривые

**НИКОГДА не используй `ease`, `linear`, `ease-in-out` по умолчанию.**
Всегда — из этого набора. `lib/easing.ts`:
```ts
export const EASING = {
  /** Главная кривая. По умолчанию для всего. */
  smooth:   [0.22, 1, 0.36, 1] as const,
  /** Экспонента — для крупных движений (hero, page-transitions) */
  expoOut:  [0.16, 1, 0.3, 1] as const,
  /** Мягкое появление элементов */
  entrance: [0.25, 0.1, 0.25, 1] as const,
  /** Лёгкий «отскок» для hover */
  spring:   [0.34, 1.56, 0.64, 1] as const,
} as const;

export const DURATION = {
  fast: 0.3, base: 0.5, slow: 0.8, slower: 1.2,
} as const;
```
Почему эти числа: `[0.22,1,0.36,1]` — быстрый старт, долгий мягкий доезд.
Мозг читает это как «дорого/плавно». Это та самая «canyon-level плавность».

### 3.2. Smooth scroll (Lenis) — главный источник ощущения

Оборачиваешь всё приложение. `providers.tsx`:
```tsx
import { ReactLenis } from "lenis/react";

<ReactLenis root options={{
  lerp: 0.1,           // инерция: 0.1 = плавно, выше = резче
  duration: 1.2,
  smoothWheel: true,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
}}>
  {children}
</ReactLenis>
```
⚠️ Подводные камни:
- В `globals.css`: `html { scroll-behavior: auto; }` (Lenis сам рулит).
- Сбрасывай скролл при смене роута (Lenis держит своё состояние):
```tsx
const lenis = useLenis();
useEffect(() => { lenis?.scrollTo(0, { immediate: true }); }, [pathname]);
```
- `overscroll-behavior-x: none` на `html, body` — убивает свайп «назад» и
  rubber-band, иначе горизонтальные карусели глючат.

### 3.3. Page-transitions (переход между страницами)

`app/template.tsx` (App Router запускает это на каждой навигации):
```tsx
"use client";
import { motion } from "framer-motion";
import { EASING } from "@/lib/easing";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: EASING.smooth }}
    >
      {children}
    </motion.div>
  );
}
```
**Критичный урок по таймингу:** 600ms ощущается «туго», 180ms — «дёшево».
Сладкая точка — **~320ms + 4px Y-сдвиг**. Контент уже на 60% непрозрачности
к 200ms, мозг читает «плавно», но ждать не приходится. Не делай переходы
длиннее 350ms.

### 3.4. Scroll-reveal (появление при прокрутке)

Один переиспользуемый компонент. `components/animations/reveal.tsx`:
```tsx
"use client";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef } from "react";
import { EASING } from "@/lib/easing";

export function Reveal({ children, delay = 0, y = 40, duration = 1, margin = "-10%", className }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin });
  const reduce = useReducedMotion();
  return (
    <motion.div
      ref={ref}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y }}
      animate={inView ? (reduce ? { opacity: 1 } : { opacity: 1, y: 0 }) : undefined}
      transition={{ duration, delay, ease: EASING.smooth }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
```
Применение — со **stagger** (каскадная задержка детей):
```tsx
{items.map((it, i) => (
  <Reveal key={it.id} delay={0.1 + i * 0.06}>{/* … */}</Reveal>
))}
```
`once: true` — анимируем один раз (не повторяем при скролле туда-сюда).
`margin: "-10%"` — стартуем за 10% до края экрана, чтобы не «дёргалось».

### 3.5. Hover/tap микро-интеракции

```tsx
// Кнопка «вжимается» на тап — мгновенный отклик ДО навигации
className="active:scale-[0.98] active:duration-75 transition-all duration-300 ease-out"

// Стрелка уезжает вправо на hover
<span className="transition-transform duration-500 ease-out group-hover:translate-x-2">→</span>

// Изображение в карточке — лёгкий зум
<img className="transition-transform duration-700 group-hover:scale-105" />
```

### 3.6. Доступность — `useReducedMotion()`

Всегда уважай `prefers-reduced-motion`. Reveal выше уже это делает: при
включённой настройке — только opacity, без сдвигов. Lenis-скролл тоже стоит
отключать для таких юзеров.

---

## 4. Layout-примитивы

### 4.1. Container (единый горизонтальный отступ)
```tsx
const sizeMap = {
  narrow:  "max-w-[720px]",   // текстовые страницы (статьи)
  default: "max-w-[1200px]",  // большинство
  wide:    "max-w-[1440px]",  // гриды, hero
  full:    "max-w-none",      // edge-to-edge
};
export function Container({ children, size = "default", className }) {
  return (
    <div className={cn("mx-auto w-full px-6 md:px-10 lg:px-16", sizeMap[size], className)}>
      {children}
    </div>
  );
}
```
**Все** секции оборачиваются в Container — края всегда выровнены.

### 4.2. Ритм секций
```tsx
<section className="py-[var(--section-gap)]">   {/* большой вертикальный ритм */}
  <Container>
    <span className="kicker">Раздел</span>       {/* мелкий uppercase */}
    <h2 className="...">Заголовок</h2>
    {/* контент */}
  </Container>
</section>
```

### 4.3. Структура страницы (паттерн)
```
Header (sticky/fixed, прозрачный над hero → solid при скролле)
  ↓
Hero (полноэкранный, крупный заголовок, 1–2 CTA, скролл-индикатор)
  ↓
Секции с Reveal (преимущества / популярное / соц.доказательство / CTA-блок)
  ↓
Footer (тёмный, крупный «sign-off» заголовок, ссылки колонками, соцсети)
```

---

## 5. Глобальные оверлеи (монтируются один раз)

Паттерн: оверлеи рендерятся в `providers.tsx` один раз, открываются через
zustand-стор из любого места — без prop-drilling:
```tsx
<QueryClientProvider>
  {children}
  <CartDrawer />      {/* открывается useCart().openCart() */}
  <SearchOverlay />   {/* Cmd+K → useSearch().openSearch() */}
  <CookieBanner />
</QueryClientProvider>
```
Любой такой оверлей:
- `AnimatePresence` для входа/выхода
- backdrop с `backdrop-blur` для глубины
- блокировка скролла body пока открыт
- закрытие по Escape + клику на backdrop
- focus-trap для доступности

---

## 6. Контент-архитектура (CMS-driven)

**Правило: контент ≠ код.** Тексты, фото, цены, товары — в CMS (Sanity),
не в JSX. Это даёт клиенту самостоятельность и не требует деплоя на правку.

Слои:
```
Sanity schema (типы документов)
  → GROQ-запросы (queries.ts)
    → fetchers (server-side, с кэш-тегами)
      → adapters (snake/raw → camelCase view-models)
        → компоненты (знают только чистый view-model)
```
**Adapter-паттерн** изолирует форму CMS от UI — если структура в CMS
поменяется, правишь один адаптер, а не 30 компонентов.

Дефолты в адаптере, чтобы пустые поля не ломали верстку:
```ts
title: s?.title ?? "Default Title",
gallery: images.length ? images : [fallbackGradient],
```

---

## 7. Состояние

| Тип | Инструмент | Пример |
|---|---|---|
| Server state | TanStack Query | список товаров, данные юзера |
| Client UI state | Zustand + persist | корзина, открыт ли поиск, тема |
| Form state | react-hook-form + zod | чекаут, контакт-форма |
| URL state | searchParams | фильтры каталога, пагинация |

Zustand-стор с localStorage:
```ts
export const useCart = create(persist((set, get) => ({
  items: [],
  add: (item) => set({ items: [...get().items, item] }),
  // …
}), { name: "cart", partialize: (s) => ({ items: s.items }) }));
```

⚠️ **SSR-гидратация:** localStorage недоступен на сервере. Жди флаг
`hydrated`, прежде чем гейтить UI по состоянию из persist — иначе мелькание.

---

## 8. Структура файлов

```
src/
  app/
    layout.tsx          # шрифты, метадата, <Providers>
    providers.tsx       # Lenis, Query, глобальные оверлеи
    template.tsx        # page-transition обёртка
    globals.css         # токены + база
    page.tsx            # главная
    (routes)/…          # остальные страницы
    api/…               # route handlers
  components/
    layout/             # Header, Footer, Container
    animations/         # Reveal, WordReveal
    ui/                 # Button, и базовые примитивы
    <feature>/          # по фичам (shop/, cart/, search/)
  lib/
    easing.ts           # EASING + DURATION
    utils.ts            # cn(), formatPrice()
    <feature>-store.ts  # zustand-сторы
  sanity/ | cms/        # schema, queries, adapters, client
  data/                 # статические типы/константы
```

`lib/utils.ts` — обязательный `cn()`:
```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
```

---

## 9. Компонент-конвенции

- **Каждый компонент — с doc-комментарием** (что делает, зачем именно так,
  какие подводные камни). Это окупается на ревью и при возврате через месяц.
- **Варианты через объекты-мапы, не if-цепочки:**
  ```ts
  const variants = { primary: "...", secondary: "...", ghost: "..." };
  className={cn(base, variants[variant], sizes[size])}
  ```
- **Полиморфный Button** (рендерит `<a>` или `<button>` по наличию `href`).
- **Tabular-nums для чисел/цен:** `className="tabular-nums"` — цифры не прыгают.
- **`aria-label`, `role`, `aria-pressed`** на интерактиве без видимого текста.

---

## 10. Производительность

- **next/font** — оба шрифта, `display: swap`, self-hosted variable (один файл
  на весь диапазон весов вместо файла на вес).
- **next/image** для фото (или CSS-градиенты как fallback-плейсхолдеры).
- **Server components по умолчанию**, `"use client"` только где нужна
  интерактивность/хуки.
- **Кэш-теги Sanity** + on-demand revalidation через webhook (правка в CMS →
  ревалидация только затронутого среза, не всего сайта).
- **Lazy-load оверлеев/тяжёлых данных** — fetch при первом открытии, кэш на
  сессию.
- **TanStack Query**: `staleTime: 60_000`, `refetchOnWindowFocus: false`.

---

## 11. Адаптация под нишу (чек-лист)

Костяк универсален. Под нишу меняешь:

1. **Токены** (§1) — 8 цветов + радиус под характер бренда.
2. **Шрифты** (§2) — display под настроение (serif для luxury, гротеск для
   tech, рукописный акцент для крафта).
3. **Контент-модель CMS** — какие сущности (товары / услуги / кейсы / меню /
   объекты недвижимости / события).
4. **Hero-нарратив** — что продаём первым экраном.
5. **Секции главной** — преимущества, соц.доказательство, прайс, FAQ.
6. **Иконографику** — Lucide-набор под домен.

Что **остаётся неизменным** (это и есть «плавность и структура»):
EASING, Lenis, page-transitions, Reveal, Container, ритм секций, adapter-слой,
паттерн глобальных оверлеев, дисциплина токенов.

Примеры под ниши:
- **Недвижимость:** товар → объект (фото-галерея, карта, параметры). Hero —
  поиск по локации. Reveal на карточках листинга.
- **Услуги/агентство:** товар → кейс (обложка, метрики, описание). Hero —
  оффер + CTA. Секции: процесс, команда, отзывы.
- **Ресторан:** товар → блюдо (фото, цена, состав). Hero — атмосфера +
  «забронировать». Меню категориями.
- **SaaS:** Hero — продукт + демо. Секции: фичи, прайс-таблица, интеграции,
  соц.доказательство. Меньше декора, больше ясности.
- **Образование/курсы:** товар → курс (программа, преподаватель, цена). Hero
  — трансформация студента. Секции: учебный план, отзывы, FAQ.

---

## 12. Анти-паттерны (чего НЕ делать)

| ❌ Нельзя | ✅ Надо |
|---|---|
| `ease`, `linear`, дефолтные кривые | только `EASING.*` |
| Хардкод `#hexcolor` в компонентах | `var(--color-*)` токены |
| Переходы > 350ms между страницами | ~320ms, контент быстро виден |
| Анимировать всё подряд | только осмысленное; уважать reduced-motion |
| Контент-тексты в JSX | CMS + adapter |
| Чистый `#000` для текста | «тёплый чёрный» (#1A1612) |
| Reveal без `once: true` | один раз, иначе дёргается при скролле |
| Забыть scroll-reset при роуте | Lenis держит позицию — мелькает футер |
| localStorage-state без `hydrated` | жди гидратацию, иначе flash |
| Блокировать right-click «от копирования» | бесполезно + ломает UX |
| Нестандартный скроллбар везде | нативный + Lenis, кастом только где нужно |

---

## 13. Стартовый промпт для AI

> Build a [НИША] website in Next.js (App Router) + TypeScript + Tailwind v4 +
> Framer Motion + Lenis. Follow the "Smooth Site Playbook":
> - Design tokens as CSS variables in globals.css (warm-black text #1A1612,
>   NOT pure black; soft radius scale up to 44px; clamp() section spacing).
> - Two fonts via next/font: a characterful display face for headings, a
>   neutral grotesque for body.
> - A shared EASING object — use [0.22,1,0.36,1] as the default curve,
>   NEVER `ease`/`linear`. DURATION constants.
> - Lenis smooth scroll wrapping the app (lerp 0.1), with scroll-reset on
>   route change and overscroll-behavior-x:none.
> - A page-transition template.tsx at ~320ms + 4px Y lift.
> - A reusable <Reveal> scroll component (fade + 40px Y up, once:true,
>   margin -10%, respects prefers-reduced-motion), used with stagger.
> - A <Container> primitive with size variants and consistent px padding.
> - Section rhythm: kicker (uppercase tracked) → display heading → content.
> - CMS-driven content via an adapter layer (raw → camelCase view-models).
> - Global overlays (cart/search) mounted once, opened via Zustand stores.
> Niche specifics: [опиши сущности, hero-нарратив, секции].

---

*Извлечено из production-проекта. Меняй токены и контент-модель под нишу —
плавность и структура остаются.*
