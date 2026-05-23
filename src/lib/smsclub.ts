/**
 * SMS Club — REST client.
 *
 * Thin wrapper over the v3 Send-SMS API. Used from the Supabase Send
 * SMS hook (`/api/auth/send-sms`) to deliver phone-OTP codes. Stays
 * provider-agnostic at the call-site: anyone needing to send an SMS
 * imports `sendSms()` and forgets that SMS Club exists.
 *
 * API docs: https://client.smsclub.mobi/swagger/
 *
 * Auth: Bearer token from the SMS Club personal cabinet (Profile →
 * Token). Sender ID (alfa-name) must be registered + approved on
 * their side before any actual delivery works.
 *
 * Rate limit: SMS Club caps at 9 req/s per client. We're far below
 * that on auth-OTP traffic; if we ever push marketing blasts through
 * this client, batch + back-off would need to land here.
 */

const SMS_ENDPOINT = "https://api.smsclub.mobi/sms-v3";

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing env var: ${name}`);
  }
  return v;
}

/** Normalise to digits-only. SMS Club rejects E.164 with the leading
 *  "+"; their `phone` field is an `integer`. */
function normalisePhone(input: string): string {
  return input.replace(/\D/g, "");
}

export interface SendSmsResult {
  /** Map of phone (without +) → SMS Club's internal message id. */
  info: Record<string, number>;
}

export interface SendSmsOptions {
  phone: string;
  text: string;
  /** Override sender for this single call. Defaults to env. */
  from?: string;
  /** Delivery TTL in seconds. SMS Club allows 60-144400; default 600
   *  is reasonable for short-lived OTP codes. */
  lifetime?: number;
}

/**
 * Send a single SMS. Throws on HTTP / API error so callers can wrap
 * with their own retry / logging policy. Returns SMS Club's id-by-phone
 * map on success so we could correlate webhooks later if we ever need
 * delivery-status callbacks.
 */
export async function sendSms(opts: SendSmsOptions): Promise<SendSmsResult> {
  const token = required("SMSCLUB_API_TOKEN");
  const from = opts.from ?? required("SMSCLUB_SENDER_ID");
  const phone = normalisePhone(opts.phone);
  if (!phone || phone.length < 10) {
    throw new Error(`Invalid phone number for SMS: ${opts.phone}`);
  }

  const body = {
    sms: {
      from,
      text: opts.text,
      lifetime: opts.lifetime ?? 600,
    },
    recipients: [{ phone: Number(phone) }],
  };

  const res = await fetch(SMS_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
    // Don't let a flaky SMS gateway hang an auth flow forever.
    signal: AbortSignal.timeout(8000),
  });

  // 201 = success. SMS Club returns a JSON body either way.
  const data = (await res.json().catch(() => ({}))) as {
    status?: string;
    info?: Record<string, number>;
    errors?: Array<{ field: string; code: number; description: string }>;
  };

  if (!res.ok || data.status !== "success") {
    const detail =
      data.errors?.map((e) => `${e.field}: ${e.description}`).join("; ") ??
      `HTTP ${res.status}`;
    throw new Error(`SMS Club send failed — ${detail}`);
  }

  return { info: data.info ?? {} };
}
