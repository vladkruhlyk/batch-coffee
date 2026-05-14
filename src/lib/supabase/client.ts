"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "./env";

/**
 * Browser-side Supabase client.
 *
 * Use from `"use client"` components. Reads + writes go through the
 * anon (publishable) key and are gated by RLS — a user can only touch
 * rows their own `auth.uid()` matches.
 *
 * Singleton-ish: re-created each render is fine because the SDK
 * internally dedupes; we don't bother memoising at module scope to
 * keep the API simple.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
