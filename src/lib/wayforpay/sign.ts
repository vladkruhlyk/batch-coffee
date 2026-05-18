import crypto from "node:crypto";

/**
 * WayForPay HMAC-MD5 signing.
 *
 * Three signature flavours from the WayForPay docs, all the same
 * algorithm — HMAC-MD5 over `;`-joined fields with the merchant secret
 * as the key, output as lowercase hex.
 *
 * The fields each signature covers differ:
 *
 *   • requestSignature (we → WayForPay, on POST /pay):
 *     merchantAccount; merchantDomainName; orderReference; orderDate;
 *     amount; currency; productName[]; productCount[]; productPrice[]
 *
 *   • responseSignature (WayForPay → us, in webhook body):
 *     merchantAccount; orderReference; amount; currency; authCode;
 *     cardPan; transactionStatus; reasonCode
 *
 *   • webhookAck (us → WayForPay, ack of the webhook):
 *     orderReference; status; time
 *
 * Arrays expand into their elements (productName=["A","B"] → "A;B").
 */

const HMAC_KEY = "md5";

function hmacMd5(secret: string, payload: string): string {
  return crypto.createHmac(HMAC_KEY, secret).update(payload).digest("hex");
}

function joinValues(values: Array<string | number>): string {
  return values.map((v) => String(v)).join(";");
}

// ---------------------------------------------------------------------------
// Outgoing — we sign the request before redirecting the customer to
// WayForPay's hosted form.
// ---------------------------------------------------------------------------

export interface RequestSignatureInput {
  merchantAccount: string;
  merchantDomainName: string;
  orderReference: string;
  /** Unix seconds. */
  orderDate: number;
  amount: number;
  currency: string;
  productName: string[];
  productCount: number[];
  productPrice: number[];
}

export function signRequest(
  secret: string,
  input: RequestSignatureInput,
): string {
  const payload = joinValues([
    input.merchantAccount,
    input.merchantDomainName,
    input.orderReference,
    input.orderDate,
    input.amount,
    input.currency,
    ...input.productName,
    ...input.productCount,
    ...input.productPrice,
  ]);
  return hmacMd5(secret, payload);
}

// ---------------------------------------------------------------------------
// Incoming — WayForPay POSTs the payment result to our webhook. We
// verify the signature before trusting any of the fields.
// ---------------------------------------------------------------------------

export interface ResponseSignatureInput {
  merchantAccount: string;
  orderReference: string;
  amount: number;
  currency: string;
  authCode: string;
  cardPan: string;
  transactionStatus: string;
  reasonCode: string | number;
}

export function expectedResponseSignature(
  secret: string,
  input: ResponseSignatureInput,
): string {
  const payload = joinValues([
    input.merchantAccount,
    input.orderReference,
    input.amount,
    input.currency,
    input.authCode,
    input.cardPan,
    input.transactionStatus,
    input.reasonCode,
  ]);
  return hmacMd5(secret, payload);
}

// ---------------------------------------------------------------------------
// Webhook acknowledgement — WayForPay retries until we respond with
// THIS exact signed shape. Anything else and the postbacks keep
// landing.
// ---------------------------------------------------------------------------

export interface WebhookAckInput {
  orderReference: string;
  /** "accept" tells WayForPay to stop retrying. */
  status: "accept" | "decline";
  /** Unix seconds — same one we send back, signed. */
  time: number;
}

export function buildWebhookAck(
  secret: string,
  input: WebhookAckInput,
): {
  orderReference: string;
  status: string;
  time: number;
  signature: string;
} {
  const payload = joinValues([input.orderReference, input.status, input.time]);
  return {
    orderReference: input.orderReference,
    status: input.status,
    time: input.time,
    signature: hmacMd5(secret, payload),
  };
}

// ---------------------------------------------------------------------------
// Tiny string-eq that avoids timing leaks on signature compare.
// ---------------------------------------------------------------------------

export function timingSafeEqHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}
