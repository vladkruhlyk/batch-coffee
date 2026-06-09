import { randomBytes } from "node:crypto";
import { createSupabaseAdminClient } from "../supabase/server";
import {
  WAYFORPAY_PAY_URL,
  wayforpayMerchantAccount,
  wayforpayMerchantDomain,
  wayforpayMerchantSecret,
} from "./config";
import { signRequest } from "./sign";
import type { OrderWithItems } from "../orders";

/**
 * Build the form payload the customer's browser POSTs to WayForPay,
 * and stamp a `payments` row that the webhook will later update.
 *
 * Each invocation creates a fresh `provider_order_ref` so a retried
 * attempt doesn't collide with the previous one (WayForPay enforces
 * uniqueness per reference).
 *
 * Server-only — runs with the service-role key inside an API route.
 */
export async function buildWayForPayPayload(
  order: OrderWithItems,
  siteUrl: string,
): Promise<{
  action: string;
  fields: Array<{ name: string; value: string }>;
}> {
  const supabase = createSupabaseAdminClient();
  if (!siteUrl?.startsWith("http")) {
    throw new Error("WayForPay site URL must be an absolute public URL");
  }

  // Fresh ref per attempt so WayForPay doesn't reject duplicates.
  const ref = `${order.number}-${randomBytes(4).toString("hex")}`;

  const orderDate = Math.floor(Date.now() / 1000);

  // WayForPay wants each line item as parallel arrays. Item names get
  // truncated to keep the request body lean.
  const productName = order.items.map((i) => trim(i.productName, 96));
  const productCount = order.items.map((i) => i.quantity);
  const productPrice = order.items.map((i) => i.unitPrice);

  // Compute the signature BEFORE persisting the payment row. signRequest
  // is synchronous crypto and effectively never throws, but building +
  // signing first means a failure here can't leave an orphan `pending`
  // payments row behind.
  const signature = signRequest(wayforpayMerchantSecret, {
    merchantAccount: wayforpayMerchantAccount,
    merchantDomainName: wayforpayMerchantDomain,
    orderReference: ref,
    orderDate,
    amount: order.total,
    currency: "UAH",
    productName,
    productCount,
    productPrice,
  });

  // Persist the attempt BEFORE handing the form to the customer so the
  // webhook (which races against the return redirect) always finds a
  // matching row.
  const { error: payErr } = await supabase.from("payments").insert({
    order_id: order.id,
    provider: "wayforpay",
    provider_order_ref: ref,
    status: "pending",
    amount: order.total,
    currency: "UAH",
  });
  if (payErr) throw payErr;

  const fields: Array<{ name: string; value: string }> = [
    { name: "merchantAccount", value: wayforpayMerchantAccount },
    { name: "merchantAuthType", value: "SimpleSignature" },
    { name: "merchantDomainName", value: wayforpayMerchantDomain },
    { name: "merchantTransactionSecureType", value: "AUTO" },
    { name: "merchantSignature", value: signature },
    { name: "orderReference", value: ref },
    { name: "orderDate", value: orderDate.toString() },
    { name: "amount", value: order.total.toString() },
    { name: "currency", value: "UAH" },
    { name: "language", value: "UA" },
    { name: "defaultPaymentSystem", value: "card" },
    {
      name: "returnUrl",
      value: `${siteUrl}/api/wayforpay/return?orderReference=${encodeURIComponent(
        ref,
      )}`,
    },
    { name: "serviceUrl", value: `${siteUrl}/api/wayforpay/webhook` },
    { name: "clientFirstName", value: order.recipientFirstName },
    { name: "clientLastName", value: order.recipientLastName },
    {
      name: "clientPhone",
      value: order.recipientPhone.replace(/\D/g, ""),
    },
  ];

  if (order.recipientEmail) {
    fields.push({ name: "clientEmail", value: order.recipientEmail });
  }

  // WayForPay's form examples use repeated `name[]` inputs. Keep this
  // as an ordered array of pairs because a plain object cannot represent
  // duplicate field names.
  productName.forEach((name) => {
    fields.push({ name: "productName[]", value: name });
  });
  productPrice.forEach((price) => {
    fields.push({ name: "productPrice[]", value: price.toString() });
  });
  productCount.forEach((count) => {
    fields.push({ name: "productCount[]", value: count.toString() });
  });

  return {
    action: WAYFORPAY_PAY_URL,
    fields,
  };
}

function trim(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}
