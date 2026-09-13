/**
 * Server-side Supabase client for the data-intelligence layer.
 *
 * Uses the SERVICE-ROLE key so it can write to protected tables without
 * going through RLS.  Never import this file from any client component —
 * it must only be used inside:
 *   - Next.js API routes  (app/api/...)
 *   - Server actions
 *   - lib/db/* helpers called only from the above
 *
 * The ANON client in lib/db/supabase.ts remains untouched and continues
 * to serve the history / script / visual tables.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

/**
 * Returns the service-role Supabase client.
 * Returns null (and logs a warning) when env vars are missing so callers
 * can fall back gracefully to the existing behavior.
 */
export function getCacheClient(): SupabaseClient | null {
  if (_client) return _client;

  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svcKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !svcKey) {
    // Only warn once, server-side
    if (typeof window === 'undefined') {
      console.warn(
        '[CacheClient] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing. ' +
        'Data-intelligence layer is disabled — existing behavior unchanged.',
      );
    }
    return null;
  }

  _client = createClient(url, svcKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

/** True only when the service-role client is available. */
export function isCacheClientReady(): boolean {
  return getCacheClient() !== null;
}
