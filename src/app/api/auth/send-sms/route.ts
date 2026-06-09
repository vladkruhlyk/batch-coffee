import { NextResponse, type NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { sendSms } from "@/lib/smsclub";

/**
 * Supabase "Send SMS Hook" handler.
 *
 * Configured at Supabase → Authentication → Hooks → Send SMS Hook.
 * Supabase generates a 6-digit OTP and POSTs it here together with
 * the target user. Our job: deliver the SMS via SMS Club and return
 * 2xx. Supabase handles generation / TTL / verification — we never
 * see or store the code beyond a single transmission.
 *
 * Security: every hook call is signed via the Standard Webhooks
 * scheme (id + timestamp + body, HMAC-SHA256 with the base64-decoded
 * secret). If the signature doesn't verify, return 401 — Supabase
 * will retry with backoff. We do timing-safe comparison so a
 * malicious peer can't measure-attack the secret.
 *
 * Env vars required:
 *   - SUPABASE_SMS_HOOK_SECRET — the `whsec_…` value Supabase showed
 *     when you created the hook.
 *   - SMSCLUB_API_TOKEN, SMSCLUB_SENDER_ID — in /lib/smsclub.
 */

export const runtime = "nodejs";

interface SupabaseSendSmsPayload {
  user: {
    id: string;
    phone: string | null;
  };
  sms: {
    otp: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();

    const secretEnv = process.env.SUPABASE_SMS_HOOK_SECRET;
    if (!secretEnv) {
      console.error("send-sms hook: SUPABASE_SMS_HOOK_SECRET not set");
      return NextResponse.json(
        { error: "hook secret not configured" },
        { status: 500 },
      );
    }

    if (!verifySignature(req.headers, raw, secretEnv)) {
      return NextResponse.json(
        { error: "invalid signature" },
        { status: 401 },
      );
    }

    let payload: SupabaseSendSmsPayload;
    try {
      payload = JSON.parse(raw) as SupabaseSendSmsPayload;
    } catch {
      return NextResponse.json(
        { error: "invalid JSON body" },
        { status: 400 },
      );
    }

    const phone = payload.user?.phone;
    const otp = payload.sms?.otp;
    if (!phone || !otp) {
      return NextResponse.json(
        { error: "missing user.phone or sms.otp" },
        { status: 400 },
      );
    }

    // Keep the message short — costs less, fits in 1 SMS segment
    // (160 chars Latin / 70 chars Cyrillic). Brand the message so
    // the customer recognises who's asking for verification.
    const text = `${otp} — твiй код для входу у BATCH Coffee`;

    await sendSms({ phone, text });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("send-sms hook failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "internal error" },
      { status: 500 },
    );
  }
}

/**
 * Verify Standard-Webhooks (Svix-compatible) signature that Supabase
 * sends on every hook delivery. Body: `${webhook-id}.${webhook-timestamp}.${raw}`.
 * Sign with HMAC-SHA256 keyed by the base64-decoded secret payload.
 * Header may carry multiple signatures separated by space — match
 * against any one.
 */
function verifySignature(
  headers: Headers,
  rawBody: string,
  secretEnv: string,
): boolean {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const sigHeader = headers.get("webhook-signature");
  if (!id || !timestamp || !sigHeader) return false;

  // Replay protection (Standard Webhooks spec): the timestamp is part of
  // the signed payload, so verifying the signature alone still accepts a
  // CAPTURED request forever — re-triggering SMS sends on every replay.
  // Reject anything outside a ±5 minute window.
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const skewSeconds = Math.abs(Date.now() / 1000 - ts);
  if (skewSeconds > 300) return false;

  // Supabase shows the secret as `v1,whsec_…`. Some panels paste it
  // with one prefix or the other. Accept both, then base64-decode
  // the remaining material to a Buffer for the HMAC key.
  const stripped = secretEnv
    .replace(/^v1,/, "")
    .replace(/^whsec_/, "");
  let key: Buffer;
  try {
    key = Buffer.from(stripped, "base64");
  } catch {
    return false;
  }

  const signed = `${id}.${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", key).update(signed).digest("base64");

  // Header looks like "v1,<base64sig> v1,<base64sig> ..." — any match wins.
  const provided = sigHeader
    .split(" ")
    .map((s) => s.replace(/^v1,/, ""))
    .filter(Boolean);

  for (const candidate of provided) {
    if (constantTimeEq(candidate, expected)) return true;
  }
  return false;
}

function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}
