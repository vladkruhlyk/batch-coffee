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
  // its raw payload refreshed.
  await supabase
    .from("payments")
    .update({
      status: nextStatus,
      raw_response: body,
      failure_reason:
        nextStatus === "approved" ? null : reason || transactionStatus,
    })
    .eq("id", payment.id);

  // Move the order forward — but only on the FIRST approval to keep
  // this idempotent. status_events trigger will log the transition.
  if (nextStatus === "approved" && payment.status !== "approved") {
    await supabase
      .from("orders")
      .update({ status: "paid" })
      .eq("id", payment.order_id);
  }

  // Acknowledge — without this, WayForPay keeps retrying for ~24h.
  const ack = buildWebhookAck(wayforpayMerchantSecret, {
    orderReference,
    status: "accept",
    time: Math.floor(Date.now() / 1000),
  });

  return { ack, detail: `processed: ${nextStatus}` };
}
