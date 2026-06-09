import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/wayforpay/return
 *
 * WayForPay redirects the customer's browser here after they're done
 * with the hosted form (success OR failure). We look up the payment
 * by `orderReference`, find the parent order, and redirect to the
 * customer-facing /order/[number]?token=... page.
 *
 * This endpoint doesn't trust anything from the URL beyond the
 * reference — the actual paid/declined state comes from the webhook,
 * which signs its payload. This handler just gets the customer back
 * to a meaningful page.
 */

export const runtime = "nodejs";

/** Shared handler — pull orderReference from query OR form body, look
 *  up the order, redirect the browser to /order/[number]. WayForPay
 *  sometimes uses POST (form-urlencoded) instead of GET for the
 *  return URL, so we accept both. */
async function handleReturn(req: NextRequest): Promise<Response> {
  const url = new URL(req.url);
  let ref = url.searchParams.get("orderReference");
  if (!ref && req.method === "POST") {
    const text = await req.text();
    const params = new URLSearchParams(text);
    ref = params.get("orderReference");
  }
  if (!ref) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const supabase = createSupabaseAdminClient();
  const { data: payment, error: payErr } = await supabase
    .from("payments")
    .select("order_id")
    .eq("provider_order_ref", ref)
    .maybeSingle();
  // Distinguish a DB error from a genuine not-found: on an error the
  // customer HAS paid (or is mid-flow), so bouncing them to the homepage
  // is the worst outcome. Log it and send them to their order list,
  // where a logged-in customer can still find the order.
  if (payErr) {
    console.error("wayforpay/return payment lookup failed:", payErr);
    return NextResponse.redirect(new URL("/account/orders", req.url));
  }
  if (!payment) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("number, view_token")
    .eq("id", payment.order_id)
    .maybeSingle();
  if (orderErr) {
    console.error("wayforpay/return order lookup failed:", orderErr);
    return NextResponse.redirect(new URL("/account/orders", req.url));
  }
  if (!order) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const target = new URL(`/order/${order.number}`, req.url);
  target.searchParams.set("token", order.view_token);
  // Force GET on the redirect — even when WayForPay POSTs us with form
  // data, the customer's browser should follow with a plain navigation.
  return NextResponse.redirect(target, { status: 303 });
}

export async function GET(req: NextRequest) {
  return handleReturn(req);
}

export async function POST(req: NextRequest) {
  return handleReturn(req);
}
