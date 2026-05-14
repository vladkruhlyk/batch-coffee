import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAnonKey, supabaseUrl, supabaseServiceRoleKey } from "./env";

/**
 * Server-side Supabase client tied to the current request's cookies.
 *
 * Use from server components, server actions, and route handlers.
 * Reads the user's session out of the request cookies so RLS policies
 * see them as the same `auth.uid()` they had on the client. Writes
 * back any refreshed-session cookies on the response so the session
 * doesn't expire mid-flow.
 *
 * Always create a fresh client per request — sharing one across
 * requests leaks session state between users.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // `cookies().set` throws in pure Server Components (no
          // response to attach to). Safe to swallow — the middleware
          // and route handlers handle the refresh path; on a plain
          // render we just don't refresh-rotate the cookie here.
        }
      },
    },
  });
}

/**
 * Service-role client — bypasses RLS. Use ONLY for trusted server-side
 * operations: cron jobs, webhook handlers, migration scripts. Never
 * accept user input in a query that runs through this client without
 * very careful validation.
 */
export function createSupabaseAdminClient() {
  if (!supabaseServiceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for the admin client. " +
        "This client should only ever run on the server.",
    );
  }
  return createServerClient(supabaseUrl, supabaseServiceRoleKey, {
    cookies: {
      // Admin client never reads or writes user cookies — it's a
      // privileged backend connection.
      getAll: () => [],
      setAll: () => {
        /* no-op */
      },
    },
  });
}
