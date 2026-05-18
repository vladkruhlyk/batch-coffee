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
  // WayForPay quirk: they POST the JSON body with Content-Type set to
  // `text/plain`, not `application/json`. We can't rely on the header,
  // so we read the body as raw text and try JSON first (which is what
  // they actually send), falling back to form-urlencoded for the rare
  // alternate integration mode. Logging the raw body on signature
  // failure makes the next debugging round-trip much shorter.
  let raw = "";
  let body: Record<string, unknown> = {};
  try {
    raw = await req.text();
    const trimmed = raw.trim();
    if (trimmed.startsWith("{")) {
      body = JSON.parse(trimmed) as Record<string, unknown>;
    } else {
      const params = new URLSearchParams(trimmed);
      body = Object.fromEntries(params.entries());
    }
  } catch (e) {
    console.error("wayforpay/webhook parse failed:", e, "raw:", raw);
    return NextResponse.json(
      { error: "could not parse body", detail: String(e) },
      { status: 400 },
    );
  }

  // Coerce numeric fields — WayForPay's form-urlencoded variant sends
  // amount as a string; JSON usually sends it as a number, but be
  // safe either way.
  if (typeof body.amount === "string") body.amount = Number(body.amount);

  const { ack, detail } = await handleWayForPayCallback(body);
  if (!ack) {
    console.error(
      "wayforpay/webhook rejected:",
      detail,
      "body keys:",
      Object.keys(body),
      "raw:",
      raw.slice(0, 500),
    );
    return NextResponse.json({ error: detail }, { status: 400 });
  }
  return NextResponse.json(ack);
}
