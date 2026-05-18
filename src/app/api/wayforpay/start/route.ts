import { NextResponse, type NextRequest } from "next/server";
import { buildWayForPayPayload } from "@/lib/wayforpay/payload";
import { getOrderByIdAdmin } from "@/lib/orders-admin";

/**
 * POST /api/wayforpay/start
 *
 * Body: { orderId: string, viewToken: string }
 *
 * Owner-only kickoff for an online card payment. The client passes the
 * order id + view_token (the same token we put in the URL for the
 * confirmation page). We:
 *   1. Verify the token matches a real order
 *   2. Make sure the order isn't already paid (no double-charge)
 *   3. Build a signed WayForPay payload (also writes a `payments` row)
 *   4. Return { action, fields } — the client renders an auto-
 *      submitting form
 *
 * We deliberately do NOT take amount from the client — it's read from
 * the DB so a tampered checkout can't underpay.
 */

export const runtime = "nodejs"; // crypto.createHmac needs Node

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { orderId?: string; viewToken?: string }
      | null;
    if (!body?.orderId || !body?.viewToken) {
      return NextResponse.json(
        { error: "orderId and viewToken are required" },
        { status: 400 },
      );
    }

    const order = await getOrderByIdAdmin(body.orderId);
    if (!order) {
      return NextResponse.json({ error: "order not found" }, { status: 404 });
    }
    if (order.viewToken !== body.viewToken) {
      return NextResponse.json({ error: "token mismatch" }, { status: 403 });
    }
    if (order.status !== "pending") {
      return NextResponse.json(
        { error: `order already in status: ${order.status}` },
        { status: 409 },
      );
    }

    const payload = await buildWayForPayPayload(order);
    return NextResponse.json(payload);
  } catch (e) {
    // Without this catch, Next's default 500 response is an HTML page —
    // the browser can't parse it as JSON and the user sees a generic
    // "Internal Server Error". Surface the actual error so we can fix
    // it (most common: migration 0006 not applied → payments table
    // missing → INSERT fails inside buildWayForPayPayload).
    const detail =
      e instanceof Error
        ? e.message
        : typeof e === "object" && e && "message" in e
          ? String((e as { message: unknown }).message)
          : String(e);
    console.error("wayforpay/start failed:", e);
    return NextResponse.json(
      { error: detail || "internal error" },
      { status: 500 },
    );
  }
}
