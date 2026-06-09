import { createSupabaseAdminClient } from "../supabase/server";
import { wayforpayMerchantSecret } from "./config";
import {
  buildWebhookAck,
  expectedResponseSignature,
  timingSafeEqHex,
} from "./sign";

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
    const { error: orderErr } = await supabase
      .from("orders")
      .update({ status: "paid" })
      .eq("id", payment.order_id)
      .neq("status", "paid");
    if (orderErr) {
      return { ack: null, detail: `order update failed: ${orderErr.message}` };
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
