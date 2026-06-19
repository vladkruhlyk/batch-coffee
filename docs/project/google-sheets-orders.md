# Оплачені замовлення → Google Таблиця

Коли замовлення стає «Оплачено» (картковий платіж підтверджено webhook'ом
WayForPay), у вказану Google-таблицю автоматично додається рядок.

Реалізація: `src/lib/google-sheets.ts` + виклик у `src/lib/wayforpay/webhook.ts`.
Вмикається змінною оточення `GOOGLE_SHEETS_WEBHOOK_URL`. Поки її немає — функція
нічого не робить (безпечно).

## Налаштування (один раз)

1. Створи Google-таблицю (sheets.new).
2. **Розширення → Apps Script**.
3. Встав код нижче, заміни `SECRET` на випадковий рядок (напр. `batch_9f3x7q`).
4. **Deploy → New deployment** → тип **Web app** → *Execute as:* **Me** →
   *Who has access:* **Anyone** → **Deploy** → авторизуй (Google попросить дозвіл).
5. Скопіюй **Web app URL** (закінчується на `/exec`).
6. Повний URL = цей URL + `?token=ТВІЙ_SECRET`, напр.
   `https://script.google.com/macros/s/AKfy.../exec?token=batch_9f3x7q`
7. Vercel → Settings → Environment Variables → **Add** →
   `GOOGLE_SHEETS_WEBHOOK_URL` = повний URL → **Save** → **Redeploy**.
8. Тестове оплачене замовлення → у таблиці з'явиться рядок.

## Код Apps Script

```js
const SECRET = 'ЗАМІНИ_НА_ВИПАДКОВИЙ_РЯДОК';

function doPost(e) {
  if (!e || !e.parameter || e.parameter.token !== SECRET) {
    return ContentService.createTextOutput('forbidden');
  }
  const d = JSON.parse(e.postData.contents);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Час', '№', 'Оплачено', 'Клієнт', 'Телефон', 'Email',
      'Товари', 'Сума', 'Оплата', 'Доставка', 'Коментар']);
  }
  sheet.appendRow([
    new Date(), d.number, d.paidAt, d.customer, d.phone, d.email,
    d.items, d.total, d.paymentMethod, d.delivery, d.comment,
  ]);
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## Нотатки

- Дублів не буде: рядок шлеться лише коли webhook реально переводить замовлення
  pending → paid (через `.select()`), повторні доставки webhook ігноруються.
- Тільки карткові оплати (вони стають paid через webhook). Накладений платіж
  (самовивіз/СОD) у таблицю не йде — за потреби можна додати окремо.
- `paymentMethod` = `card`, `delivery` містить сирі значення (`pickup` тощо) —
  за бажанням можна гарніше перейменувати прямо в Apps Script.
- Якщо колись зміниш SECRET — онови і в скрипті, і в URL у Vercel.
