import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client for server-side use.
 *
 * This uses the publishable (anon) key on purpose. The `leads` table is
 * insert-only for that role — see supabase/migrations/0001_leads.sql — so
 * the key cannot be used to read anything back out. There is no service
 * role key in this project and nothing here needs one.
 */
export function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local",
    );
  }

  return createClient(url, anonKey, {
    auth: { persistSession: false },
  });
}
