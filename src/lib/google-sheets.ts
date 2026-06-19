/**
 * Push a paid order into a Google Sheet via a Google Apps Script Web App.
 *
 * Why Apps Script and not the Sheets API: zero setup on our side — no
 * service-account JSON, no googleapis dependency, no OAuth. The merchant
 * pastes a tiny script behind their own sheet, deploys it as a web app,
 * and gives us the URL. We just POST a JSON row to it.
 *
 * Safety: this is FIRE-AND-FORGET and NEVER throws. It runs inside the
 * WayForPay webhook, whose only job is to ack the payment — a Google
 * outage or a misconfigured URL must never break that ack (which would
 * make WayForPay retry and could desync the order). No URL set → no-op,
 * so it's safe to ship before the sheet exists.
 */

export interface SheetOrderRow {
  number: string;
  paidAt: string;
  customer: string;
  phone: string;
  email: string;
  /** "Ефіопія Бенса 250 г ×2; Кенія 1 кг ×1" */
  items: string;
  total: number;
  paymentMethod: string;
  delivery: string;
  comment: string;
}

export async function pushOrderToSheet(row: SheetOrderRow): Promise<void> {
  const url = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  if (!url) return; // feature off until the merchant wires a sheet

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    await fetch(url, {
      method: "POST",
      // Apps Script web apps accept text/plain without a CORS preflight.
      headers: { "content-type": "text/plain;charset=utf-8" },
      body: JSON.stringify(row),
      signal: controller.signal,
    });
  } catch (err) {
    // Swallow — never let a sheet hiccup break the payment webhook.
    console.error("pushOrderToSheet failed (non-fatal):", err);
  } finally {
    clearTimeout(timer);
  }
}
