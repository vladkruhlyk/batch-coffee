---
name: batch-frontend
description: Specific rules for building the BATCH Coffee Roastery frontend. Canyon-level smoothness and aesthetics. Next.js 15 App Router + Tailwind + Framer Motion + Lenis + GSAP. Use whenever writing any frontend code for BATCH — components, pages, animations, styles.
---

# BATCH Frontend — правила разработки

Цель: **каждый компонент должен выглядеть и ощущаться как canyoncoffee.co** — editorial lifestyle, тёплый premium, плавность во всём.

Этот скилл применяется **всегда**, когда мы пишем frontend для BATCH. Без исключений.

---

## Технический стек (фиксированный)

- **Framework:** Next.js 15 (App Router) + TypeScript (strict mode)
- **Styling:** Tailwind CSS + CSS variables для токенов темы
- **Animation:** Framer Motion (компоненты) + Lenis (smooth scroll) + GSAP (сложные таймлайны, опционально)
- **State:** Zustand (корзина, UI) + TanStack Query (серверные данные)
- **Forms:** React Hook Form + Zod
- **Icons:** Lucide React (тонкие, хорошо вписываются)
- **Fonts:** загрузка через `next/font` (обязательно для производительности)

**Что НЕ используем:**
- ❌ Inter, Roboto, Arial, system fonts (generic AI-slop)
- ❌ antd, MUI, Chakra, shadcn/ui (нам нужна distinctive эстетика, не готовые компоненты)
- ❌ react-spring (используем Framer Motion)
- ❌ CSS-in-JS (styled-components, emotion) — только Tailwind + CSS Modules для сложных случаев

---

## Aesthetic direction (жёстко зафиксировано)

### Палитра (тёплая, не стерильная)

```css
:root {
  /* Фон */
  --color-bg-primary: #FAFAF7;      /* тёплый off-white, основной фон */
  --color-bg-secondary: #F5F1EB;    /* кремовый, вторичные блоки */
  --color-bg-surface: #FFFFFF;      /* карточки (можно) */
  --color-bg-dark: #1A1612;         /* тёплый чёрный, для тёмных секций */

  /* Текст */
  --color-text-primary: #1A1612;    /* тёплый чёрный, НЕ #000 */
  --color-text-secondary: #6B6660;  /* тёплый серый */
  --color-text-muted: #9C958C;      /* ещё светлее */
  --color-text-inverse: #FAFAF7;    /* на тёмном фоне */

  /* Бордеры / разделители */
  --color-border: #E5DFD5;          /* светло-песочный */
  --color-border-strong: #D4C9B8;   /* песочный */

  /* Акцент (placeholder — финал с брендингом) */
  --color-accent: #2B1F15;          /* тёмный эспрессо, временный */
  --color-accent-hover: #3D2817;
}
```

### Типографика

**Обязательные шрифты (загружаются через `next/font/google`):**

- **Display (заголовки):** `Fraunces`
  - Variable font (играем с weight 300-900, opsz 14-144)
  - Для H1-H2 используем `soft` optical sizing
  - Characterful, warm serif — эталон editorial
- **Body (текст):** `Instrument Sans`
  - Distinctive humanist sans
  - Вариант замены: General Sans
- **Mono (редко, для кода в Brew Guide и т.д.):** `JetBrains Mono` или `Geist Mono`

**Правила использования:**
- Только 2 гарнитуры максимум на странице
- H1: Fraunces 48-96px desktop / 32-48px mobile, weight 400, letter-spacing -0.02em, line-height 1.05
- H2: Fraunces 32-48px, weight 400
- H3: Fraunces 24-32px, weight 500
- Body: Instrument Sans 16-18px, weight 400, line-height 1.6
- Small / caption: Instrument Sans 14px, weight 400, letter-spacing 0.02em (lowercase)

### Spacing (щедрое)

Tailwind-базовое, но мыслим в секциях:
- **Between sections:** 120-160px desktop, 80-100px mobile
- **Inside section:** 48-80px
- **Container padding:** 24px mobile, 48-80px desktop
- **Max-width:** 1440px для полных секций, 1200px для читающего контента, 720px для текста в Journal

**Правило:** если сомневаешься — добавь больше воздуха. Canyon не экономит на whitespace.

---

## Animation rules (Canyon-level smoothness)

### 1. Smooth scroll через Lenis — ОБЯЗАТЕЛЬНО

```tsx
// app/providers/smooth-scroll-provider.tsx
'use client';
import { ReactLenis } from 'lenis/react';

export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  return (
    <ReactLenis
      root
      options={{
        lerp: 0.1,              // плавность (0.1 — мягко)
        duration: 1.2,
        smoothWheel: true,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // exponential ease-out
      }}
    >
      {children}
    </ReactLenis>
  );
}
```

Подключается один раз в `app/layout.tsx`. Без этого НЕТ Canyon-эффекта.

### 2. Easing curves (используем только эти)

```ts
// lib/easing.ts
export const EASING = {
  // Основной — для большинства transitions
  smooth: [0.22, 1, 0.36, 1] as const,

  // Экспоненциальный — для больших движений (page transitions)
  expoOut: [0.16, 1, 0.3, 1] as const,

  // Для entrance — появление элементов
  entrance: [0.25, 0.1, 0.25, 1] as const,

  // Spring-подобный — для hover
  spring: [0.34, 1.56, 0.64, 1] as const,
};
```

```ts
// В Framer Motion:
<motion.div
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.8, ease: EASING.smooth }}
/>
```

**ЗАПРЕЩЕНО:** `ease`, `linear`, `ease-in`, `ease-out` (дефолты браузера — некрасиво).

### 3. Тайминги

| Что | Длительность |
|---|---|
| Hover states | 300-400ms |
| Button/link transitions | 250-350ms |
| Scroll reveals | 800-1200ms |
| Page transitions | 600-800ms |
| Modal/drawer открытие | 400-500ms |
| Stagger delay между элементами | 80-120ms |

**Правило:** если анимация меньше 250ms — она резкая. Если больше 1500ms — она тормозная. Держись в диапазоне.

### 4. Scroll reveals (паттерн)

Используем Framer Motion + Intersection Observer:

```tsx
// components/ui/reveal.tsx
'use client';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { EASING } from '@/lib/easing';

export function Reveal({
  children,
  delay = 0,
  y = 40
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-10%' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 1, delay, ease: EASING.smooth }}
    >
      {children}
    </motion.div>
  );
}
```

**Применение:**
```tsx
<Reveal><h1>Свіжообсмажена кава</h1></Reveal>
<Reveal delay={0.15}><p>Опис...</p></Reveal>
```

### 5. Stagger на списках

```tsx
const container = {
  animate: {
    transition: { staggerChildren: 0.1, delayChildren: 0.2 }
  }
};

const item = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASING.smooth } }
};

<motion.div initial="initial" whileInView="animate" variants={container}>
  {products.map(p => <motion.div key={p.id} variants={item}>...</motion.div>)}
</motion.div>
```

### 6. Hover на карточках

```tsx
<motion.div
  whileHover={{ y: -4 }}
  transition={{ duration: 0.4, ease: EASING.smooth }}
  className="group"
>
  <motion.img
    whileHover={{ scale: 1.03 }}
    transition={{ duration: 0.6, ease: EASING.smooth }}
    src={...}
  />
  <h3>Ефіопія Сідамо</h3>
</motion.div>
```

**НЕ делай:** `scale: 1.1` (слишком), `y: -10` (слишком). Canyon = subtle.

### 7. Parallax (очень тонкий)

```tsx
import { useScroll, useTransform } from 'framer-motion';

const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
const y = useTransform(scrollYProgress, [0, 1], [0, -80]); // всего -80px!

<motion.img style={{ y }} src={...} />
```

**НЕ делай:** `[0, -400]` — это дискотека, не премиум.

### 8. Page transitions

Между страницами — плавный fade:

```tsx
// app/template.tsx
'use client';
import { motion } from 'framer-motion';

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
```

Для premium-впечатления — можно добавить `y: 20` к initial.

### 9. Image loading — без jank

Все изображения через `next/image` с blur placeholder:

```tsx
<Image
  src={src}
  alt={alt}
  width={1200}
  height={1600}
  placeholder="blur"
  blurDataURL={blurDataUrl}
  sizes="(max-width: 768px) 100vw, 50vw"
  className="transition-opacity duration-700"
  onLoadingComplete={(img) => img.classList.remove('opacity-0')}
/>
```

Или через framer-motion:
```tsx
<motion.img
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.8, ease: EASING.smooth }}
/>
```

### 10. Custom cursor (опционально, для premium-ощущения)

Тонкий круглый курсор с magnet-эффектом на кнопках. Добавим на v2, не обязателен для MVP.

---

## Component architecture

### Структура папок

```
src/
├── app/                          # Next.js App Router
│   ├── (shop)/                   # route group
│   │   ├── shop/
│   │   └── product/[slug]/
│   ├── (content)/
│   │   ├── about/
│   │   ├── journal/
│   │   └── brew-guide/
│   ├── (account)/
│   │   └── account/
│   ├── layout.tsx
│   ├── template.tsx              # page transitions
│   └── providers.tsx             # Lenis, React Query, Theme
├── components/
│   ├── ui/                       # базовые: Button, Input, Reveal
│   ├── layout/                   # Header, Footer, Container
│   ├── product/                  # ProductCard, ProductGallery, TastingProfile
│   ├── journal/                  # JournalCard, ArticleLayout
│   └── animations/               # Reveal, StaggerContainer, Parallax
├── lib/
│   ├── easing.ts
│   ├── animations.ts             # variants
│   ├── graphql/                  # WPGraphQL клиент + queries
│   └── utils.ts
├── hooks/
│   ├── use-cart.ts
│   ├── use-auth.ts
│   └── use-nova-poshta.ts
├── stores/                       # Zustand
│   └── cart-store.ts
├── types/
└── styles/
    └── globals.css
```

### Component rules

1. **Один компонент = один файл.** Не сваливаем в `index.tsx` пачку.
2. **Server Components по умолчанию.** `'use client'` только если нужен state/эффекты/интерактив.
3. **Props всегда типизированы.** Никаких `any`.
4. **Forwarding refs** для кастомных UI-компонентов (`Button`, `Input`).
5. **Composition over configuration.** Лучше `<Card><Card.Header>` чем `<Card header={...}>`.
6. **Tailwind + `cn()`** (clsx + tailwind-merge) для условных классов.

### Пример ProductCard

```tsx
// components/product/product-card.tsx
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { EASING } from '@/lib/easing';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  slug: string;
  name: string;           // "Ефіопія Сідамо"
  tastingNotes: string[]; // ["чорниця", "жасмин"]
  price: number;
  weight: string;         // "250г"
  image: { url: string; alt: string };
  className?: string;
}

export function ProductCard({ slug, name, tastingNotes, price, weight, image, className }: ProductCardProps) {
  return (
    <motion.article
      whileHover="hover"
      initial="initial"
      className={cn('group flex flex-col gap-4', className)}
    >
      <Link href={`/product/${slug}`} className="block overflow-hidden bg-[var(--color-bg-secondary)] aspect-[4/5]">
        <motion.div
          variants={{
            initial: { scale: 1 },
            hover: { scale: 1.03 }
          }}
          transition={{ duration: 0.6, ease: EASING.smooth }}
          className="relative w-full h-full"
        >
          <Image
            src={image.url}
            alt={image.alt}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
          />
        </motion.div>
      </Link>

      <div className="flex flex-col gap-2">
        <h3 className="font-display text-xl leading-tight">{name}</h3>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {tastingNotes.join(' · ')}
        </p>
        <div className="flex items-baseline justify-between mt-2">
          <span className="text-[var(--color-text-muted)] text-sm">{weight}</span>
          <span className="font-display text-lg">{price} ₴</span>
        </div>
      </div>
    </motion.article>
  );
}
```

Обрати внимание:
- Тёплые цвета через CSS-переменные
- Tasting notes — точками, не запятыми (elegant detail)
- Цена Fraunces (display font) — подчёркивает важность
- Hover subtle: scale 1.03, не 1.1
- aspect-ratio фиксированный — layout не прыгает при загрузке

---

## Accessibility (не забываем)

- Семантический HTML (`<article>`, `<nav>`, `<main>`)
- Alt на всех изображениях
- Focus states на интерактивных элементах (не убирать outline, стилизовать)
- prefers-reduced-motion — отключать анимации для юзеров, которые их не хотят:

```tsx
import { useReducedMotion } from 'framer-motion';

const shouldReduceMotion = useReducedMotion();
const y = shouldReduceMotion ? 0 : 40;
```

- Контраст текста: минимум WCAG AA
- Клавиатурная навигация: весь сайт должен работать без мыши

---

## Performance rules

1. **Images: только `next/image`.** Никогда `<img>`.
2. **Fonts: `next/font`.** Никогда import через CSS или link.
3. **Lazy load всё ниже fold.** `loading="lazy"` на картинках, `dynamic()` на heavy компонентах.
4. **Sharp WebP.** Next.js это делает автоматически.
5. **Bundle size watch.** Не тащим lodash целиком, только нужные функции.
6. **Framer Motion partially.** Используем `motion/react` subpath (меньше бандл).
7. **Lighthouse score ≥90** во всех категориях. Проверяем каждую фичу перед мержем.

---

## Запрещено (категорически)

- ❌ Inter, Roboto, Arial, system fonts
- ❌ `#000` (только `#1A1612`)
- ❌ `#FFF` (только `#FAFAF7` или `#FFFFFF` для карточек на тёплом фоне)
- ❌ Purple gradients, neon colors, синеватые оттенки
- ❌ `ease`, `linear`, `ease-in-out` (только наши easing)
- ❌ `scale: 1.1` на hover (максимум 1.03-1.05)
- ❌ `duration < 250ms` (резко) или `duration > 1500ms` (тормозно)
- ❌ Бордеры `border-gray-200` (только наши tokens)
- ❌ Глобальные `!important` в CSS
- ❌ Inline styles (только CSS variables + Tailwind)
- ❌ Кричащие CTA: «КУПИТЬ СКИДКА 20%!!!» (мы не wildberries)

---

## Как применять этот скилл

При любой задаче по фронту для BATCH:

1. Открой этот файл (если новая сессия)
2. Проверь, что соблюдаешь:
   - Стек (Next.js, Tailwind, Framer Motion, Lenis)
   - Палитру (тёплая, не стерильная)
   - Типографику (Fraunces + Instrument Sans)
   - Easing (наши кривые)
   - Тайминги (250-1200ms)
3. Если сомневаешься — ориентир: **«Сделал бы так Canyon?»**
4. Перед финальным ответом проверь чеклист «Запрещено»

---

## Вдохновение — canyoncoffee.co

Каждый раз, когда задача «а как бы это сделать красиво» — открой canyoncoffee.co, посмотри аналог, укради подход.

Особенно хорошо у них:
- Hero с крупным lifestyle-фото и короткой фразой
- Плавность скролла
- Типографические паузы (много воздуха между заголовками и текстом)
- Карточки товаров — минимум info, максимум фото
- Journal — как отдельный медиа-раздел
- Footer — воздушный, без каши
