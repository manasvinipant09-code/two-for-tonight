import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Supabase's newer key format (sb_publishable_... / sb_secret_...) is a
// drop-in replacement for the legacy anon/service_role JWTs — same headers,
// same client API. We read the new names first and fall back to the old
// ones so this works whichever pair of keys you were issued.
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Browser-safe client — publishable key only, used for reads and for
 * subscribing to realtime changes (session status, swipes). Never put the
 * secret key in any file that ships to the client.
 */
export function supabaseBrowser() {
  return createClient(url, publishableKey);
}

/**
 * Server-only client — secret key, bypasses row-level security.
 * Only ever import this from `app/api/**` route handlers, never from a
 * client component.
 */
export function supabaseServer() {
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, secretKey, {
    auth: { persistSession: false },
  });
}
