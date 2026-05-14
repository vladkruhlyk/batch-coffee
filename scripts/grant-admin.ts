/**
 * Toggle the `profiles.is_admin` flag from the CLI — handier than
 * opening Supabase Studio every time a teammate needs access.
 *
 *   cd web && npx tsx scripts/grant-admin.ts <email>
 *   cd web && npx tsx scripts/grant-admin.ts <email> --revoke
 *   cd web && npx tsx scripts/grant-admin.ts --list
 *
 * Uses the service-role key so RLS is bypassed. The target user must
 * already have signed up — we look them up in `profiles` by email.
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

async function listAdmins() {
  const { data, error } = await supabase
    .from("profiles")
    .select("email, first_name, last_name, created_at")
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
    console.log(`  · ${row.email ?? "(no email)"}  —  ${name}`);
  }
}

async function setAdmin(email: string, value: boolean) {
  const { data, error } = await supabase
    .from("profiles")
    .update({ is_admin: value })
    .eq("email", email)
    .select("id, email, first_name, last_name, is_admin")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    console.error(
      `No profile with email ${email}. The user must sign up first ` +
        `(complete the email OTP + onboarding flow), then re-run this.`,
    );
    process.exit(1);
  }
  const name =
    [data.first_name, data.last_name].filter(Boolean).join(" ") || "(no name)";
  console.log(
    `${value ? "Granted" : "Revoked"} admin: ${data.email}  —  ${name}`,
  );
}

(async () => {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(
      [
        "Usage:",
        "  npx tsx scripts/grant-admin.ts <email>           # grant admin",
        "  npx tsx scripts/grant-admin.ts <email> --revoke  # remove admin",
        "  npx tsx scripts/grant-admin.ts --list            # show current admins",
      ].join("\n"),
    );
    process.exit(0);
  }
  if (args[0] === "--list") {
    await listAdmins();
    return;
  }
  const email = args[0];
  const revoke = args.includes("--revoke");
  await setAdmin(email, !revoke);
})().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
