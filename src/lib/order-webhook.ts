/**
 * Push a completed order to one or more external webhooks (a Google Apps
 * Script behind a Sheet, a Telegram-bot endpoint, n8n, Make, Zapier, or any
 * URL that accepts a JSON POST).
 *
 * Multiple destinations, fired independently and in parallel — so the same
 * order can land in the Google Sheet AND ping a Telegram bot at once, and one
 * being down never affects the other. URLs come from three env vars, each of
 * which may also hold a comma-separated list; duplicates are collapsed:
 *   • GOOGLE_SHEETS_WEBHOOK_URL — the Apps Script behind the orders sheet;
 *   • TELEGRAM_WEBHOOK_URL      — the bot endpoint;
 *   • ORDER_WEBHOOK_URL         — any extra/generic consumer.
 *
 * Why plain POSTs and not the Sheets API: zero setup on our side — no
 * service-account JSON, no googleapis dependency, no OAuth. Whoever owns
 * the sheet/automation gives us one URL and we POST a JSON row to it.
 *
 * The payload carries BOTH shapes so any tool can consume it with no
 * mapping work:
 *   • named fields (`number`, `customer`, …) — for a Telegram bot / n8n;
 *   • `row` — an array in the EXACT column order of the merchant's sheet:
 *       Час, №, Оплачено, Клієнт, Телефон, Email, Товари, Сума, Оплата,
 *       Доставка, Коментар
 *     so an Apps Script `sheet.appendRow(data.row)` just works.
 *
 * Safety: FIRE-AND-FORGET and NEVER throws. It runs inside the WayForPay
 * webhook (whose only job is to ack the payment) and inside checkout's
 * after() — a downstream outage or a bad URL must never break either. No
 * URL set → no-op, so it's safe to ship before any automation exists.
 */

export interface OrderWebhookRow {
  /** № — order number. */
  number: string;
  /** Оплачено — "Так" for a paid card order, "Ні" for pay-on-delivery. */
  paid: string;
  /** Клієнт — full name. */
  customer: string;
  /** Телефон. */
  phone: string;
  /** Email. */
  email: string;
  /** Товари — "Ефіопія Бенса 250 г ×2; Кенія 1 кг ×1". */
  items: string;
  /** Сума — total in UAH. */
  total: number;
  /** Оплата — human label ("Картка (онлайн)" / "При отриманні"). */
  payment: string;
  /** Доставка — human label + city + address. */
  delivery: string;
  /** Коментар. */
  comment: string;
}

/** Raw payment_method → Ukrainian label used in the sheet/webhook. */
export function paymentLabel(method: string | null | undefined): string {
  switch (method) {
    case "card":
      return "Картка (онлайн)";
    case "cod":
      return "При отриманні";
    default:
      return method ?? "";
  }
}

/** Raw delivery_method (+ city/address) → one readable "Доставка" cell. */
export function deliveryLabel(
  method: string | null | undefined,
  city?: string | null,
  address?: string | null,
): string {
  const base =
    method === "novaposhta-branch"
      ? "Нова Пошта — відділення"
      : method === "novaposhta-postomat"
        ? "Нова Пошта — поштомат"
        : method === "pickup"
          ? "Самовивіз"
          : (method ?? "");
  // Pickup's address already includes the city ("Полтава, вул. …"), so
  // don't repeat the city for it — otherwise we get "…, Полтава, Полтава, …".
  const parts = method === "pickup" ? [base, address] : [base, city, address];
  return parts.map((s) => s?.trim()).filter(Boolean).join(", ");
}

/** "13.07.2026 14:22" in Kyiv time — the "Час" column. */
function kyivTimestamp(): string {
  const parts = new Intl.DateTimeFormat("uk-UA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}`;
}

/** All configured destination URLs, de-duplicated. Each env var may hold a
 *  single URL or a comma-separated list. */
function webhookUrls(): string[] {
  const raw = [
    process.env.GOOGLE_SHEETS_WEBHOOK_URL,
    process.env.TELEGRAM_WEBHOOK_URL,
    process.env.ORDER_WEBHOOK_URL,
  ];
  const urls = raw
    .filter((v): v is string => Boolean(v))
    .flatMap((v) => v.split(","))
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(urls)];
}

/** Escape the five HTML-sensitive chars for Telegram parse_mode: "HTML". */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * A ready-to-read Telegram message, built from the order fields. Shipped in
 * the webhook payload as `text` (so an intermediary bot can post `data.text`
 * instead of the raw JSON) AND used by the native sender below.
 */
function formatTelegramMessage(row: OrderWebhookRow, time: string): string {
  const paidMark = row.paid === "Так" ? "✅ оплачено" : "🕓 не оплачено";
  return [
    `🆕 <b>Замовлення ${escapeHtml(row.number)}</b>`,
    `💳 ${escapeHtml(row.payment)} · ${paidMark}`,
    ``,
    `👤 ${escapeHtml(row.customer)}`,
    `📞 ${escapeHtml(row.phone)}`,
    row.email ? `✉️ ${escapeHtml(row.email)}` : null,
    ``,
    `🛒 ${escapeHtml(row.items)}`,
    `💵 <b>${row.total} ₴</b>`,
    `🚚 ${escapeHtml(row.delivery)}`,
    row.comment ? `📝 ${escapeHtml(row.comment)}` : null,
    ``,
    `🕐 ${time}`,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/**
 * Send a formatted message straight to a Telegram chat via the Bot API — no
 * intermediary server needed. Off unless BOTH TELEGRAM_BOT_TOKEN and
 * TELEGRAM_CHAT_ID are set. Never throws; own 5s timeout.
 */
async function sendTelegramMessage(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    console.error("sendTelegramMessage failed (non-fatal):", err);
  } finally {
    clearTimeout(timer);
  }
}

/** POST the body to one URL. Never throws; its own 5s timeout. */
async function postOne(url: string, body: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    await fetch(url, {
      method: "POST",
      // Apps Script web apps accept text/plain without a CORS preflight;
      // generic webhooks (Telegram bot, n8n…) parse it as JSON just the same.
      headers: { "content-type": "text/plain;charset=utf-8" },
      body,
      signal: controller.signal,
    });
  } catch (err) {
    // Swallow — never let one webhook hiccup break the order/payment flow
    // or the sibling destinations.
    console.error(`pushOrderToWebhook failed for ${url} (non-fatal):`, err);
  } finally {
    clearTimeout(timer);
  }
}

export async function pushOrderToWebhook(row: OrderWebhookRow): Promise<void> {
  const urls = webhookUrls();
  const telegramEnabled = Boolean(
    process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID,
  );
  // Nothing wired at all → no-op.
  if (urls.length === 0 && !telegramEnabled) return;

  const time = kyivTimestamp();
  const text = formatTelegramMessage(row, time);
  const payload = {
    time,
    ...row,
    // A ready-made human message — an intermediary bot can post this
    // directly instead of dumping the raw JSON.
    text,
    // Ordered exactly like the merchant's sheet columns.
    row: [
      time,
      row.number,
      row.paid,
      row.customer,
      row.phone,
      row.email,
      row.items,
      row.total,
      row.payment,
      row.delivery,
      row.comment,
    ],
  };
  const body = JSON.stringify(payload);

  // Fan out to every destination independently — the Sheet, any generic
  // webhook, and the native Telegram send each run on their own, and a
  // failure of one can't affect the others or the payment ack.
  await Promise.allSettled([
    ...urls.map((url) => postOne(url, body)),
    sendTelegramMessage(text),
  ]);
}
