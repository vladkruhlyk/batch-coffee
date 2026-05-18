/**
 * WayForPay configuration — single source of truth for credentials and
 * URLs. Defaults to the publicly-documented TEST merchant so the
 * integration "just works" on dev / staging without environment setup.
 * Override via env vars in production.
 *
 * Test card to use on the hosted form:
 *   PAN: 4444 5551 1111 6666   exp 12/24   cvv 123
 *
 * Reference: https://wiki.wayforpay.com/en/view/852102
 */

/** WayForPay hosted-form URL the customer's browser POSTs to. */
export const WAYFORPAY_PAY_URL = "https://secure.wayforpay.com/pay";

/** WayForPay API endpoint for status checks / refunds (we don't use
 *  this from the customer flow, only from server-side reconciliation). */
export const WAYFORPAY_API_URL = "https://api.wayforpay.com/api";

export const wayforpayMerchantAccount =
  process.env.WAYFORPAY_MERCHANT_ACCOUNT || "test_merch_n1";

export const wayforpayMerchantSecret =
  process.env.WAYFORPAY_MERCHANT_SECRET || "flk3409refn54t54t*FNJRET";

/** The hostname WayForPay's docs say to send as `merchantDomainName`.
 *  In production this should match the real domain. In test mode it
 *  isn't validated. */
export const wayforpayMerchantDomain =
  process.env.WAYFORPAY_MERCHANT_DOMAIN_NAME ||
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/^https?:\/\//, "") ||
  "batch-coffee.vercel.app";

/** True when we're running against WayForPay's test merchant (the
 *  defaults above). Useful for showing a "test mode" banner in the UI. */
export const wayforpayIsTestMode =
  wayforpayMerchantAccount === "test_merch_n1";
