/**
 * Toggle the `profiles.is_admin` flag from the CLI — handier than
 * opening Supabase Studio every time a teammate needs access.
 *
 *   cd web && npx tsx scripts/grant-admin.ts <phone-or-email>
 *   cd web && npx tsx scripts/grant-admin.ts <phone-or-email> --revoke
 *   cd web && npx tsx scripts/grant-admin.ts --list
 *
 * The site is phone-login only now, so the common case is a phone
 * number. The identifier auto-detects: a leading "+" or all-digits is
 * treated as a phone, anything with "@" as an email. The target user
 * must already have signed up — we look them up in `profiles`.
 *
 * Uses the service-role key so RLS is bypassed.
 */
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

/** Strip to a normalised E.164-ish phone, or return null if this
 *  doesn't look like a phone at all. */
function asPhone(input: string): string | null {
  const t = input.trim();
  if (t.includes("@")) return null; // it's an email
  const hasPlus = t.startsWith("+");
  const digits = t.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return (hasPlus ? "+" : "+") + digits; // always store with leading +
}

async function listAdmins() {
  const { data, error } = await supabase
    .from("profiles")
    .select("phone, email, first_name, last_name, created_at")
    .eq("is_admin", true)
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!data || data.length === 0) {
    console.log("No admins yet.");
    return;
  }
  console.log(`Admins (${data.length}):`);
  for (const row of data) {
    const name =
      [row.first_name, row.last_name].filter(Boolean).join(" ") || "—";
    const contact = row.phone ?? row.email ?? "(no contact)";
    console.log(`  · ${contact}  —  ${name}`);
  }
}

async function setAdmin(identifier: string, value: boolean) {
  const phone = asPhone(identifier);
  const column = phone ? "phone" : "email";
  const lookupValue = phone ?? identifier.trim();

  const { data, error } = await supabase
    .from("profiles")
    .update({ is_admin: value })
    .eq(column, lookupValue)
    .select("id, phone, email, first_name, last_name, is_admin")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    console.error(
      `No profile with ${column} ${lookupValue}. The user must sign up ` +
        `first (complete the phone OTP + onboarding flow), then re-run this.`,
    );
    process.exit(1);
  }
  const name =
    [data.first_name, data.last_name].filter(Boolean).join(" ") || "(no name)";
  const contact = data.phone ?? data.email ?? "(no contact)";
  console.log(`${value ? "Granted" : "Revoked"} admin: ${contact}  —  ${name}`);
}

(async () => {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(
      [
        "Usage:",
        "  npx tsx scripts/grant-admin.ts <phone-or-email>           # grant admin",
        "  npx tsx scripts/grant-admin.ts <phone-or-email> --revoke  # remove admin",
        "  npx tsx scripts/grant-admin.ts --list                     # show current admins",
        "",
        "Examples:",
        "  npx tsx scripts/grant-admin.ts +380991234567",
        "  npx tsx scripts/grant-admin.ts owner@example.com --revoke",
      ].join("\n"),
    );
    process.exit(0);
  }
  if (args[0] === "--list") {
    await listAdmins();
    return;
  }
  const identifier = args[0];
  const revoke = args.includes("--revoke");
  await setAdmin(identifier, !revoke);
})().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
