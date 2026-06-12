# BATCH Coffee — Codex Handoff

Дата: 2026-05-13  
Актуальный путь проекта: `/Users/vladkruhlyk/Projects/GitHub/git-batch-coffee`  
Основное приложение: `/Users/vladkruhlyk/Projects/GitHub/git-batch-coffee/web`

## Почему появился этот файл

Проект был перенесен/переименован. Старый путь больше не существует:

```txt
/Users/vladkruhlyk/Documents/GitHub/git-batch-coffee
```

Новый рабочий путь:

```txt
/Users/vladkruhlyk/Projects/GitHub/git-batch-coffee
```

Для нового чата в Codex лучше открыть workspace именно на новой папке проекта.

## Текущий Git Status

На момент последней проверки:

```txt
root:
 M .DS_Store
 M web

web:
 M package-lock.json
 M package.json
?? src/lib/supabase/
?? src/middleware.ts
?? supabase/
```

Важно: эти изменения уже были в проекте до дальнейших правок Codex. Не откатывать без явного запроса.

## Стек

- Next.js `16.2.4`, App Router
- React `19.2.4`
- Zustand для mock auth/cart/subscription state
- Sanity CMS
- Supabase dependencies уже добавлены, но реальные flows еще не подключены
- Framer Motion
- Lenis
- `next/font/google` для Onest
- `next/font/local` для SN Pro

## Архитектурное решение

WordPress/WooCommerce не используем. У проекта уже выбран актуальный стек:

```txt
Next.js frontend + Sanity CMS + Supabase backend
```

Разделение ответственности:

- Sanity: каталог, товары, категории, баннеры, journal, brew guides, site settings, картинки, описания, SEO.
- Supabase: auth/OTP, profiles, addresses, orders, order_items, subscriptions, payment status, LiqPay webhooks, история заказов, кабинет.

Важная e-commerce схема: товары остаются в Sanity, а в Supabase в момент заказа сохраняется snapshot позиции:

```txt
product_slug
product_name
weight_label
weight_grams
roast
grind
unit_price
quantity
line_total
```

Так заказ остается исторически корректным, даже если в Sanity потом изменится название, цена или описание товара.

Основные файлы:

```txt
web/src/app/layout.tsx
web/src/app/providers.tsx
web/src/components/layout/header.tsx
web/src/components/layout/footer.tsx
web/src/components/layout/loader-overlay.tsx
web/src/components/layout/cookie-banner.tsx
web/src/app/checkout/page.tsx
web/src/app/subscription/page.tsx
web/src/app/subscription/setup/page.tsx
web/src/app/login/page.tsx
web/src/lib/auth-store.ts
web/src/lib/cart-store.ts
web/src/lib/subscription-store.ts
web/src/lib/shipping.ts
web/supabase/migrations/0001_init.sql
```

## Что уже проверено

Проверка была сделана без изменения кода.

### Build / Lint

`npm run lint`:

- 0 errors
- 6 warnings

Warnings:

```txt
scripts/migrate-to-sanity.ts
  unused eslint-disable

src/app/cart/page.tsx
  unused cn
  unused toFreeShipping

src/app/shop/[slug]/page.tsx
  unused eslint-disable

src/app/subscription/setup/page.tsx
  unused ArrowRight

src/components/layout/loader-overlay.tsx
  missing dependency show in useEffect
```

`npm run build`:

- Без сети падает на Google Fonts Onest.
- С сетью проходит успешно.

Причина:

```tsx
// web/src/app/layout.tsx
import { Onest } from "next/font/google";
```

Вывод: self-host Onest нужен не для смены дизайна, а чтобы build не зависел от Google Fonts.

### Sanity

Sanity check показал:

```txt
banners: 3
brewGuides: 6
categories: 8
journalPosts: 3
products: 16
siteSettings: 1
```

CMS живая.

### Browser QA

Production server локально поднимался на:

```txt
http://127.0.0.1:3000
```

Dev server для расшифровки hydration errors поднимался на:

```txt
http://127.0.0.1:3001
```

Оба сервера после проверки были остановлены.

Проверенные сценарии:

- `/` открывается.
- `/shop` открывается.
- `/shop/house-blend` открывается.
- Товар добавляется в корзину.
- Cart drawer открывается.
- Cart drawer ведет на `/checkout`.
- `/checkout` с товаром показывает форму.
- Checkout submit ведет на `/order/success?order=BAT-XXXX`.
- `/checkout` с пустой корзиной показывает empty state.
- `/subscription` открывается.
- CTA `/subscription -> /subscription/setup` работает.
- `/subscription/setup` открывается.
- Если не залогинен, `Увійти та оформити` ведет на `/login?next=/subscription/setup`.
- Mock OTP login работает, если вводить `1234` как нормальный ввод/typing.
- После логина возврат на `/subscription/setup` работает.
- Mock payment dialog открывается.
- Mock subscription payment создает активную подписку.
- `/account`, `/account/orders`, `/account/addresses`, `/account/profile`, `/account/subscriptions` работают после mock login.
- Поиск открывается, ищет `house`, показывает результаты.
- Неизвестные slugs дают 404:
  - `/shop/not-a-product`
  - `/journal/not-a-post`
  - `/brew-guide/not-a-method`
- Мобильный smoke-test на 390x844 прошел для subscription/cart.

## Главные найденные проблемы

### P0/P1 — React Hydration Error `#418`

В production console почти на каждой странице:

```txt
Minified React error #418
```

В dev расшифровка:

```txt
Hydration failed because the server rendered HTML didn't match the client.
```

Dev stack указывал на:

```txt
src/components/layout/header.tsx:50
src/components/layout/loader-overlay.tsx
src/app/template.tsx
```

Главная причина: `LoaderOverlay` читает `localStorage` в lazy initializer, поэтому сервер и первый client render могут отличаться.

Файл:

```txt
web/src/components/layout/loader-overlay.tsx
```

Проблемное место:

```tsx
const [show, setShow] = useState(() => {
  if (typeof window === "undefined") return true;
  return !localStorage.getItem(STORAGE_KEY);
});
```

Похожий риск есть в `CookieBanner`:

```txt
web/src/components/layout/cookie-banner.tsx
```

Проблемное место:

```tsx
const [visible, setVisible] = useState(() => {
  if (typeof window === "undefined") return false;
  return !window.localStorage.getItem(STORAGE_KEY);
});
```

Почему это важно:

- Может давать ощущение, что первый клик не сработал.
- Может регенерировать часть дерева на клиенте.
- Может быть причиной старого симптома "кнопки не нажимаются".

Рекомендация:

- Не читать `localStorage` во время первого render.
- Делать client-mounted gate через `useEffect`.
- Обеспечить одинаковый SSR HTML и первый client HTML.
- После фикса проверить production console: не должно быть React `#418`.

### P1 — Cookie banner может перекрывать важные UI

`CookieBanner` имеет:

```txt
z-[200]
```

Файл:

```txt
web/src/components/layout/cookie-banner.tsx
```

Payment dialog:

```txt
backdrop z-[120]
dialog z-[130]
```

Файл:

```txt
web/src/components/subscription/payment-dialog.tsx
```

Итог: cookie banner на первом визите может лежать поверх dialog/cart/search/sticky CTA. Это похоже на симптом "оформить подписку не нажимается".

Рекомендация:

- Не держать cookie banner выше модалок.
- Либо понизить z-index, либо убирать/сдвигать banner при открытых overlays.
- Проверить `/subscription/setup`, payment dialog, cart drawer, search overlay.

### P1 — Build зависит от Google Fonts

Файл:

```txt
web/src/app/layout.tsx
```

Проблема:

```tsx
import { Onest } from "next/font/google";
```

Без сети build падает:

```txt
Failed to fetch `Onest` from Google Fonts.
```

Рекомендация:

- Оставить тот же шрифт Onest.
- Подключить локально через `next/font/local`.
- Не менять визуальный дизайн.

### P1 — Backend пока mock

Это нормально для демо, но не для реального магазина.

Файлы:

```txt
web/src/lib/auth-store.ts
web/src/app/checkout/page.tsx
web/src/lib/subscription-store.ts
web/src/app/subscription/setup/page.tsx
```

Текущее состояние:

- OTP не отправляет SMS.
- Любой 4-значный код принимается.
- Auth хранится в `localStorage`.
- Checkout создает fake order id.
- Subscription хранится в `localStorage`.
- Payment dialog mock.

Примеры:

```tsx
// auth-store.ts
// no real SMS is sent, any 4-digit code is accepted
```

```tsx
// checkout/page.tsx
const fakeOrderId = `BAT-${Math.floor(Math.random() * 9000) + 1000}`;
```

Рекомендация:

- Для настоящих продаж нужен server-side order creation.
- Не создавать orders напрямую из клиента через anon key без серверной валидации.
- Payment callback/webhook должен переводить order в `paid`.

### P1/P2 — npm audit

`npm audit --omit=dev` нашел:

```txt
7 vulnerabilities
6 moderate
1 high
```

High связан с `next`.

Рекомендация:

- Обновить Next до безопасного patch/minor, который закрывает advisories.
- Не запускать blindly `npm audit fix --force` без проверки, потому что он может менять версии с breaking changes.

### P2 — Несостыковки доставки

Константа:

```txt
web/src/lib/shipping.ts
FREE_SHIPPING_THRESHOLD = 3500
```

Но checkout текст говорит:

```txt
Безкоштовно від 800 ₴
```

Файл:

```txt
web/src/app/checkout/page.tsx
```

Рекомендация:

- Везде привести к одному порогу: скорее всего `3 500 ₴`.

### P2 — География бренда расходится

Сайт местами говорит:

```txt
Полтава
```

Но pickup/terms/FAQ местами:

```txt
Київ
Велика Васильківська, 24
```

Файлы, где встречается:

```txt
web/src/app/checkout/page.tsx
web/src/app/delivery/page.tsx
web/src/app/terms/page.tsx
web/src/app/faq/page.tsx
web/src/components/layout/footer.tsx
web/src/app/visit/page.tsx
web/src/components/home/hero.tsx
web/src/components/home/visit.tsx
```

Рекомендация:

- Решить фактический город/адрес.
- Привести тексты к одному источнику, лучше через `SiteSettings`.

### P2 — Next middleware convention deprecated

Build предупреждает:

```txt
The "middleware" file convention is deprecated. Please use "proxy" instead.
```

Файл:

```txt
web/src/middleware.ts
```

Рекомендация:

- Мигрировать middleware на новый `proxy` convention для Next 16.

### P2 — SEO title дублируется

Примеры title в browser:

```txt
Каталог — BATCH Coffee — BATCH Coffee
House Blend N°1 — BATCH Coffee — BATCH Coffee
```

Причина: в page metadata уже добавляется `— BATCH Coffee`, плюс root template добавляет еще раз.

Файл:

```txt
web/src/app/layout.tsx
```

Рекомендация:

- В page metadata title писать без `— BATCH Coffee`, либо поменять root template.

## Supabase состояние

Supabase dependencies добавлены:

```txt
@supabase/ssr
@supabase/supabase-js
```

Есть файлы:

```txt
web/src/lib/supabase/env.ts
web/src/lib/supabase/client.ts
web/src/lib/supabase/server.ts
web/src/lib/supabase/middleware.ts
web/src/middleware.ts
web/supabase/migrations/0001_init.sql
```

Миграция создает:

- `profiles`
- `addresses`
- `orders`
- `order_items`
- `subscriptions`
- `subscription_cycles`
- enum types
- RLS policies
- trigger для order number
- trigger для profile on auth user created

Важный security note:

В миграции есть guest insert policies:

```sql
or (user_id is null and auth.uid() is null)
```

Это может быть допустимо как черновик, но для production лучше делать order creation через server route/service role с валидацией cart/price/products/payment.

## WooCommerce / WordPress

Не использовать.

Этот вариант обсуждался только как альтернатива готовому commerce backend, но он не соответствует текущему проекту. У пользователя нет WordPress/WooCommerce, текущая архитектура строится на Sanity и Supabase.

Если следующий чат увидит старые упоминания WooCommerce, их нужно считать историческим контекстом, а не актуальным планом.

## OTP / SMS контекст

Supabase Phone Auth официально проще всего подключать через поддерживаемых провайдеров типа Twilio/Vonage/MessageBird.

Twilio для Украины был просмотрен:

- Twilio SMS pricing Ukraine подходит технически.
- Но может быть дорого для массового OTP.

Украинские/локальные варианты:

- AlphaSMS
- TurboSMS
- SMSC.ua
- SMS Club

Если использовать украинского SMS provider, Supabase native Phone Auth напрямую может не подойти. Тогда нужен custom OTP backend:

```txt
/api/auth/request-otp
/api/auth/verify-otp
```

И отдельная логика сессий/профилей.

Для BATCH MVP рекомендация:

- Если нужен быстрый Supabase-native путь: Twilio/Vonage/MessageBird.
- Если нужна локальная цена/Украина: AlphaSMS Verify API или TurboSMS/SMSC.ua, но с кастомной backend-логикой.

## Безопасная команда, которую пользователь спрашивал

Команда:

```bash
cat /Users/vladkruhlyk/Documents/GitHub/git-batch-coffee/web/supabase/migrations/0001_init.sql | pbcopy
```

Вывод был:

- Команда безопасна по действию: только читает SQL и копирует в clipboard.
- Не меняет файлы.
- Не выполняет SQL.
- Единственный эффект: перезаписывает clipboard.

Сейчас путь нужно заменить на новый:

```bash
cat /Users/vladkruhlyk/Projects/GitHub/git-batch-coffee/web/supabase/migrations/0001_init.sql | pbcopy
```

## Приоритетный план для следующего чата

### 1. Fix hydration mismatch

Цель:

- Production console без React `#418`.

Файлы:

```txt
web/src/components/layout/loader-overlay.tsx
web/src/components/layout/cookie-banner.tsx
web/src/app/template.tsx
web/src/components/layout/header.tsx
```

Что сделать:

- Убрать browser-dependent `localStorage` из первого render.
- Сделать client-mounted state через `useEffect`.
- Проверить, что SSR HTML совпадает с первым client render.
- После фикса проверить `npm run build`, `npm run start`, console.

### 2. Fix cookie banner overlay priority

Цель:

- Cookie banner не блокирует checkout/subscription/payment/cart/search.

Файлы:

```txt
web/src/components/layout/cookie-banner.tsx
web/src/components/subscription/payment-dialog.tsx
web/src/components/cart/cart-drawer.tsx
web/src/components/search/search-overlay.tsx
```

Возможные решения:

- Понизить z-index cookie banner.
- Или поднимать overlays выше cookie.
- Или скрывать cookie banner при открытых overlays.
- На mobile проверить нижние CTA.

### 3. Self-host Onest

Цель:

- Сохранить тот же шрифт Onest.
- Убрать зависимость build от Google Fonts.

Файл:

```txt
web/src/app/layout.tsx
```

Что сделать:

- Добавить локальные font files Onest.
- Подключить через `next/font/local`.
- Убрать `next/font/google`.
- Проверить build без сетевого доступа.

### 4. Update dependencies / Next security

Цель:

- Закрыть `npm audit` high по Next.

Что сделать:

- Аккуратно обновить Next patch/minor.
- Проверить compatibility с React/Next 16.
- Не делать `npm audit fix --force` blindly.

### 5. Clean lint warnings

Цель:

```txt
npm run lint = 0 errors, ideally 0 warnings
```

Файлы:

```txt
scripts/migrate-to-sanity.ts
web/src/app/cart/page.tsx
web/src/app/shop/[slug]/page.tsx
web/src/app/subscription/setup/page.tsx
web/src/components/layout/loader-overlay.tsx
```

### 6. Fix content inconsistencies

Цель:

- Единый delivery threshold.
- Единый город/адрес бренда.

Файлы:

```txt
web/src/lib/shipping.ts
web/src/app/checkout/page.tsx
web/src/app/delivery/page.tsx
web/src/app/faq/page.tsx
web/src/app/terms/page.tsx
web/src/components/layout/footer.tsx
web/src/app/visit/page.tsx
```

### 7. SiteSettingsProvider

Цель:

- Вернуть CMS-controlled footer/contact/social settings.
- Не делать async `Footer` внутри client pages.

Контекст:

- Раньше async Footer в client pages был root cause зависания/ошибок.
- Сейчас Footer синхронный и частично hardcoded.

Решение:

- Fetch settings на server/root уровне.
- Передавать в client-safe provider/context.
- Или разделить server layout/client pages аккуратно.

### 8. Supabase backend

Актуальное решение: идти через Supabase, не через WooCommerce.

Нужно:

- Real OTP
- `profiles`
- `addresses`
- `orders`
- `order_items`
- `subscriptions`
- LiqPay integration
- LiqPay webhook
- Nova Poshta API
- Email via Resend

Порядок:

1. Supabase auth/profile/session.
2. Server route для создания order + order_items.
3. LiqPay redirect/callback/webhook.
4. Nova Poshta city/warehouse autocomplete.
5. Account pages читают реальные orders/addresses/subscriptions.
6. Subscription recurring flow.

## Команды для следующего чата

Рабочая папка:

```bash
cd /Users/vladkruhlyk/Projects/GitHub/git-batch-coffee/web
```

Проверки:

```bash
npm run lint
npm run build
npm run start -- --hostname 127.0.0.1 --port 3000
```

Если build падает на Google Fonts в sandbox, нужен запуск с сетью или сначала self-host Onest.

Sanity check:

```bash
./node_modules/.bin/tsx scripts/check-sanity.ts
```

Audit:

```bash
npm audit --omit=dev
```

## Важные правила для следующего агента

- Не использовать старый путь `/Users/vladkruhlyk/Documents/GitHub/git-batch-coffee`.
- Работать из `/Users/vladkruhlyk/Projects/GitHub/git-batch-coffee`.
- Не откатывать существующие изменения в `web`, они уже были в worktree.
- Перед правками делать `git status --short`.
- Для frontend QA запускать production build/start и проверять browser console.
- После frontend changes проверять hydration errors, не только визуальный UI.
- Не принимать mock auth/checkout/subscription за реальный backend.
- Если подключается Supabase, обязательно проверить RLS/security и не светить service role в client.

