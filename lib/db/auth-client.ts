/**
 * Supabase Auth — browser client
 *
 * Used ONLY in Client Components for:
 *   - Sign in / sign out
 *   - Reading the current session / user
 *   - Listening to auth state changes
 *
 * NEVER used for writing user_youtube_connections tokens —
 * that always happens server-side via auth-server.ts.
 *
 * Kept separate from lib/db/supabase.ts (the plain anon data client)
 * so auth and data concerns don't bleed into each other.
 */

import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';

let _authClient: SupabaseClient | null = null;

function getAuthClient(): SupabaseClient | null {
  if (_authClient) return _authClient;

  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    if (typeof window !== 'undefined') {
      console.warn('[AuthClient] Supabase env vars missing — auth unavailable.');
    }
    return null;
  }

  _authClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return _authClient;
}

export const authClient = (() => {
  // Return the lazy singleton getter so components always get the same instance
  return getAuthClient();
})();

/** Re-export helper to get a fresh reference (useful in hooks) */
export function getAuthClientInstance(): SupabaseClient | null {
  return getAuthClient();
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

export type { Session, User };

/** Sign in with Google — redirects to Google consent page */
export async function signInWithGoogle(redirectTo?: string): Promise<{ error: string | null }> {
  const client = getAuthClient();
  if (!client) return { error: 'Auth not configured' };

  const callbackUrl = redirectTo
    ?? (typeof window !== 'undefined'
      ? `${window.location.origin}/api/auth/callback`
      : '/api/auth/callback');

  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl,
      scopes: 'openid email profile',
    },
  });

  return { error: error?.message ?? null };
}

/** Sign out the current user */
export async function signOut(): Promise<{ error: string | null }> {
  const client = getAuthClient();
  if (!client) return { error: 'Auth not configured' };
  const { error } = await client.auth.signOut();
  return { error: error?.message ?? null };
}

/** Get the current session (null if not authenticated) */
export async function getSession(): Promise<Session | null> {
  const client = getAuthClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session;
}

/** Get the current user (null if not authenticated) */
export async function getCurrentUser(): Promise<User | null> {
  const client = getAuthClient();
  if (!client) return null;
  const { data } = await client.auth.getUser();
  return data.user ?? null;
}
