import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAnonKey, supabaseUrl } from "./env";

/**
 * Middleware helper — refreshes the user's Supabase session on every
 * request so the cookie doesn't go stale.
 *
 * Supabase sessions are JWTs that rotate ~every hour. Without this
 * helper, an idle tab gets a 401 on the next API call after the JWT
 * expires. Calling `getUser()` here triggers the SDK's auto-refresh
 * + writes the new cookie into the response.
 *
 * The actual `middleware.ts` at the project root chains this in.
 * Currently we don't gate any routes here — RLS does that on the DB
 * side. Auth-gated UI like /account uses client-side guards instead.
 */
export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Triggers the refresh-token round trip when the access token is
  // close to expiry. Return value intentionally unused — RLS gates
  // access on the data layer, not here.
  //
  // Wrapped in try-catch: this middleware matches nearly every route, so
  // a transient Supabase/network failure throwing here would 500 the
  // ENTIRE site. We degrade gracefully to "no refresh this request" —
  // the session just refreshes on a later request instead.
  try {
    await supabase.auth.getUser();
  } catch (err) {
    console.error("updateSupabaseSession: getUser failed, skipping refresh", err);
  }

  return response;
}
