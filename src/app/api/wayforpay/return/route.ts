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

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const ref = url.searchParams.get("orderReference");
  if (!ref) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const supabase = createSupabaseAdminClient();
  const { data: payment } = await supabase
    .from("payments")
    .select("order_id")
    .eq("provider_order_ref", ref)
    .maybeSingle();
  if (!payment) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const { data: order } = await supabase
    .from("orders")
    .select("number, view_token")
    .eq("id", payment.order_id)
    .maybeSingle();
  if (!order) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const target = new URL(`/order/${order.number}`, req.url);
  target.searchParams.set("token", order.view_token);
  return NextResponse.redirect(target);
}
