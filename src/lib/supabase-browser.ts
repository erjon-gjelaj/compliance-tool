import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client for the browser, used for one thing only: sending an
 * uploaded file straight to storage with a signed upload URL.
 *
 * The anon key is public by design and grants nothing here — the
 * submission-documents bucket has no storage policies at all, so no browser
 * session can list, read, write or delete anything in it. The capability
 * comes entirely from the signed token, which is minted server-side for one
 * specific object path and nothing else.
 *
 * Uploads go direct rather than through a server action because Vercel caps
 * a serverless request body at 4.5MB; ten files at up to 10MB each could
 * never be posted to our own server.
 */
export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  return createClient(url, anonKey, {
    auth: { persistSession: false },
  });
}
