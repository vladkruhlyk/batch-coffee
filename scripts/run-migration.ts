/**
 * Run a single .sql migration file against the project's Postgres.
 *
 *   cd web && npx tsx scripts/run-migration.ts supabase/migrations/0003_admin_enhancements.sql
 *
 * Uses SUPABASE_DB_URL (direct Postgres connection) so it works
 * regardless of RLS / RPC limits. Idempotent files (the convention
 * for our migrations) can be re-run safely.
 *
 * Not a replacement for Supabase CLI's migration tracking — there's
 * no `schema_migrations` table here. Use it for ad-hoc work; for the
 * real release flow we should adopt `supabase db push` later.
 */
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error("Missing SUPABASE_DB_URL in .env.local");
  process.exit(1);
}

const file = process.argv[2];
if (!file) {
  console.error("Usage: npx tsx scripts/run-migration.ts <path-to-sql-file>");
  process.exit(1);
}

(async () => {
  const sql = await readFile(file, "utf8");
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  console.log(`Running ${file}…`);
  try {
    await client.query(sql);
    console.log("Done.");
  } catch (e) {
    console.error("Migration failed:", e);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
