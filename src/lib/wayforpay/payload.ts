import { randomBytes } from "node:crypto";
import { createSupabaseAdminClient } from "../supabase/server";
import {
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
export async function buildWayForPayPayload(order: OrderWithItems): Promise<{
  action: string;
  fields: Record<string, string>;
}> {
  const supabase = createSupabaseAdminClient();
  const supaUrl = process.env.NEXT_PUBLIC_SITE_URL || "";

  // Fresh ref per attempt so WayForPay doesn't reject duplicates.
  const ref = `${order.number}-${randomBytes(4).toString("hex")}`;

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

  const orderDate = Math.floor(Date.now() / 1000);

  // WayForPay wants each line item as parallel arrays. Item names get
  // truncated to keep the request body lean.
  const productName = order.items.map((i) => trim(i.productName, 96));
  const productCount = order.items.map((i) => i.quantity);
  const productPrice = order.items.map((i) => i.unitPrice);

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

  // WayForPay hosted form accepts <form> with these fields.
  const fields: Record<string, string> = {
    merchantAccount: wayforpayMerchantAccount,
    merchantDomainName: wayforpayMerchantDomain,
    merchantSignature: signature,
    orderReference: ref,
    orderDate: orderDate.toString(),
    amount: order.total.toString(),
    currency: "UAH",
    language: "UA",
    returnUrl: `${supaUrl}/api/wayforpay/return?orderReference=${encodeURIComponent(
      ref,
    )}`,
    serviceUrl: `${supaUrl}/api/wayforpay/webhook`,
    // Optional contact info — speeds up 3DS / refund handling.
    clientFirstName: order.recipientFirstName,
    clientLastName: order.recipientLastName,
    clientPhone: order.recipientPhone.replace(/\D/g, ""),
    ...(order.recipientEmail ? { clientEmail: order.recipientEmail } : {}),
  };

  // Arrays go in as productName[0], productName[1], ... — that's what
  // WayForPay's form parser expects.
  productName.forEach((name, i) => {
    fields[`productName[${i}]`] = name;
  });
  productCount.forEach((count, i) => {
    fields[`productCount[${i}]`] = count.toString();
  });
  productPrice.forEach((price, i) => {
    fields[`productPrice[${i}]`] = price.toString();
  });

  return {
    action: "https://secure.wayforpay.com/pay",
    fields,
  };
}

function trim(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}
