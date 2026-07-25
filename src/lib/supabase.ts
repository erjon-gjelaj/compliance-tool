import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client holding the service role key. Server-side only.
 *
 * This key bypasses row level security completely, so it must never reach
 * the browser. Two things keep it out: the variable has no NEXT_PUBLIC_
 * prefix, so Next will not inline it into client code, and this function is
 * only ever called from server actions.
 *
 * It exists because the `submissions` table is written a step at a time —
 * the server updates a row it created earlier and reads it back to build an
 * analysis. Granting anonymous callers UPDATE on that table would let anyone
 * rewrite anyone else's intake by guessing an id, so the table is closed to
 * anon entirely and this is the only way in.
 */
export function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase admin access is not configured: set NEXT_PUBLIC_SUPABASE_URL " +
        "and SUPABASE_SERVICE_ROLE_KEY in .env.local (server-side only)",
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
