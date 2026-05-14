/**
 * Supabase env vars — validated once and re-exported as typed constants.
 *
 * `NEXT_PUBLIC_*` values land in the browser bundle and are protected by
 * Row Level Security policies on the database itself. The service-role
 * key never leaves the server runtime; it's only used by migrations
 * and webhook handlers that need to bypass RLS.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing Supabase env var: ${name}`);
  }
  return value;
}

export const supabaseUrl = required(
  "NEXT_PUBLIC_SUPABASE_URL",
  process.env.NEXT_PUBLIC_SUPABASE_URL,
);

export const supabaseAnonKey = required(
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

/** Server-only. Undefined on the client. */
export const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
