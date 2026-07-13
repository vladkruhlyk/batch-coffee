import { createSupabaseAdminClient } from "../supabase/server";
import {
  pushOrderToWebhook,
  paymentLabel,
  deliveryLabel,
} from "../order-webhook";
import { wayforpayMerchantSecret } from "./config";
import {
  buildWebhookAck,
  expectedResponseSignature,
  timingSafeEqHex,
} from "./sign";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

/**
 * Build a flat row from a just-paid order + its items and push it to the
 * merchant's order webhook. Fire-and-forget at the call site already, and
 * pushOrderToWebhook itself never throws — but we still guard the DB reads
 * here so a query hiccup can't bubble into the webhook ack.
 */
async function pushPaidOrderToWebhook(
  supabase: AdminClient,
  orderId: string,
): Promise<void> {
  try {
    const { data: order } = await supabase
      .from("orders")
      .select(
        "number, recipient_first_name, recipient_last_name, recipient_phone, recipient_email, total, payment_method, delivery_method, delivery_address, delivery_city, comment",
      )
      .eq("id", orderId)
      .single();
    if (!order) return;

    const { data: items } = await supabase
      .from("order_items")
      .select("product_name, weight_label, quantity")
      .eq("order_id", orderId);

    const itemsStr = (items ?? [])
      .map((i) => `${i.product_name} ${i.weight_label} ×${i.quantity}`)
      .join("; ");

    await pushOrderToWebhook({
      number: String(order.number ?? ""),
      paid: "Так", // card order, payment approved
      customer:
        `${order.recipient_first_name ?? ""} ${order.recipient_last_name ?? ""}`.trim(),
      phone: order.recipient_phone ?? "",
      email: order.recipient_email ?? "",
      items: itemsStr,
      total: order.total ?? 0,
      payment: paymentLabel(order.payment_method),
      delivery: deliveryLabel(
        order.delivery_method,
        order.delivery_city,
        order.delivery_address,
      ),
      comment: order.comment ?? "",
    });
  } catch (err) {
    console.error("pushPaidOrderToWebhook failed (non-fatal):", err);
  }
}

/**
 * Process a WayForPay webhook callback. Idempotent — the postback can
 * (and often does) get retried, so we treat re-deliveries as no-ops.
 *
 * Returns the JSON payload that the API route should send back. If
 * `acceptedSignature` doesn't match what WayForPay sent, returns a
 * `null` body — the route then responds 400 without writing anything.
 */

export interface WayForPayCallback {
  merchantAccount?: string;
  orderReference?: string;
  amount?: number;
  currency?: string;
  authCode?: string;
  cardPan?: string;
  transactionStatus?: string;
  reasonCode?: number | string;
  reason?: string;
  merchantSignature?: string;
  // Plus a heap of optional fields we don't care about: cardType,
  // processingDate, paymentSystem, fee, etc. Stored as-is in raw_response.
}

const APPROVED = "Approved";

export async function handleWayForPayCallback(
  body: WayForPayCallback,
): Promise<{
  ack: ReturnType<typeof buildWebhookAck> | null;
  detail: string;
}> {
  const {
    merchantAccount = "",
    orderReference = "",
    amount = 0,
    currency = "UAH",
    authCode = "",
    cardPan = "",
    transactionStatus = "",
    reasonCode = "",
    reason = "",
    merchantSignature = "",
  } = body;

  if (!orderReference) {
    return { ack: null, detail: "missing orderReference" };
  }

  // Signature check FIRST — never trust a webhook that we can't verify.
  const expected = expectedResponseSignature(wayforpayMerchantSecret, {
    merchantAccount,
    orderReference,
    amount: Number(amount),
    currency,
    authCode,
    cardPan,
    transactionStatus,
    reasonCode,
  });

  if (!timingSafeEqHex(expected, merchantSignature)) {
    return { ack: null, detail: "signature mismatch" };
  }

  const supabase = createSupabaseAdminClient();

  // Find the payment row we stamped before redirecting.
  const { data: payment, error: findErr } = await supabase
    .from("payments")
    .select("id, order_id, status")
    .eq("provider_order_ref", orderReference)
    .maybeSingle();
  if (findErr) {
    return { ack: null, detail: `db lookup failed: ${findErr.message}` };
  }
  if (!payment) {
    return { ack: null, detail: "payment row not found" };
  }

  const nextStatus =
    transactionStatus === APPROVED
      ? "approved"
      : transactionStatus === "Declined" || transactionStatus === "Refunded"
        ? transactionStatus.toLowerCase()
        : "declined";

  // Update the payment row regardless — even a duplicate webhook gets
  // its raw payload refreshed. CHECK THE ERROR: if this write fails we
  // must NOT ack, or WayForPay considers the payment settled while our
  // DB never recorded it. A null ack makes the route respond 400 →
  // WayForPay retries (it retries for ~24h).
  const { error: payErr } = await supabase
    .from("payments")
    .update({
      status: nextStatus,
      raw_response: body,
      failure_reason:
        nextStatus === "approved" ? null : reason || transactionStatus,
    })
    .eq("id", payment.id);
  if (payErr) {
    return { ack: null, detail: `payment update failed: ${payErr.message}` };
  }

  // Move the order to paid on approval. Conditional `.neq("status",
  // "paid")` makes this atomic + idempotent against concurrent/retried
  // deliveries (no double status_events) AND lets a retry complete the
  // order update if a prior delivery's payment write landed but this
  // step failed. We DON'T gate on the stale payment.status read — that
  // would skip the order update on retry and strand the order in
  // `pending`. If the order update errors, we don't ack so WayForPay
  // retries.
  if (nextStatus === "approved") {
    const { data: flipped, error: orderErr } = await supabase
      .from("orders")
      .update({ status: "paid" })
      .eq("id", payment.order_id)
      .neq("status", "paid")
      .select("id");
    if (orderErr) {
      return { ack: null, detail: `order update failed: ${orderErr.message}` };
    }
    // `flipped` has a row only when THIS delivery actually moved the order
    // pending → paid. On retries / duplicate webhooks it's empty, so the
    // Google Sheet gets exactly one row per order (no duplicates).
    if (flipped && flipped.length > 0) {
      await pushPaidOrderToWebhook(supabase, payment.order_id);
    }
  }

  // A refund must move the order out of "paid" — otherwise the customer
  // (and admin) keep seeing "Оплачено" on a refunded order and reporting
  // diverges from reality. The order_status enum has no `refunded`
  // member, so we map to `cancelled` (closest customer-facing truth);
  // the payments row keeps the precise `refunded` status for accounting.
  // Guarded `.eq("status", "paid")` so a refund webhook can't clobber a
  // later fulfilment state and stays idempotent across retries.
  if (nextStatus === "refunded") {
    const { error: refundErr } = await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", payment.order_id)
      .eq("status", "paid");
    if (refundErr) {
      return {
        ack: null,
        detail: `order refund update failed: ${refundErr.message}`,
      };
    }
  }

  // Acknowledge — without this, WayForPay keeps retrying for ~24h.
  const ack = buildWebhookAck(wayforpayMerchantSecret, {
    orderReference,
    status: "accept",
    time: Math.floor(Date.now() / 1000),
  });

  return { ack, detail: `processed: ${nextStatus}` };
}
