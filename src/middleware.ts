import type { NextRequest } from "next/server";
import { updateSupabaseSession } from "./lib/supabase/middleware";

/**
 * Next.js middleware — runs before every matched request. Currently
 * does exactly one thing: refresh the Supabase auth session cookie
 * so users with long-open tabs don't get logged out silently.
 *
 * RLS handles actual authorisation at the database layer, so we don't
 * gate routes here.
 */
export async function middleware(request: NextRequest) {
  return updateSupabaseSession(request);
}

export const config = {
  matcher: [
    // Match everything except Next internals, static files, and the
    // Studio (which is its own auth realm and shouldn't touch our
    // Supabase session cookies).
    "/((?!_next/static|_next/image|favicon.ico|studio|api/revalidate|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico|ttf|woff|woff2)).*)",
  ],
};
