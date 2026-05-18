import { NextResponse, type NextRequest } from "next/server";
import { handleWayForPayCallback } from "@/lib/wayforpay/webhook";

/**
 * POST /api/wayforpay/webhook
 *
 * WayForPay calls this from their backend after a payment lifecycle
 * event. We MUST respond with the JSON ack shape (or they keep
 * retrying for ~24h, polluting our logs).
 *
 * The body is sometimes JSON, sometimes form-urlencoded, depending on
 * the integration era. We try JSON first and fall back to form.
 */

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";

  let body: Record<string, unknown> = {};
  try {
    if (contentType.includes("application/json")) {
      body = (await req.json()) as Record<string, unknown>;
    } else {
      // form-urlencoded — values come through as strings.
      const text = await req.text();
      const params = new URLSearchParams(text);
      body = Object.fromEntries(params.entries());
    }
  } catch (e) {
    return NextResponse.json(
      { error: "could not parse body", detail: String(e) },
      { status: 400 },
    );
  }

  // Coerce numeric fields — WayForPay sends them as strings in the
  // form-urlencoded variant.
  if (typeof body.amount === "string") body.amount = Number(body.amount);

  const { ack, detail } = await handleWayForPayCallback(body);
  if (!ack) {
    // Surface why we rejected — useful in WayForPay's webhook log
    // when debugging.
    return NextResponse.json({ error: detail }, { status: 400 });
  }
  return NextResponse.json(ack);
}
