/**
 * Supabase Auth — server client
 *
 * Used ONLY in API routes (app/api/**) for:
 *   - Verifying the current user from request cookies/headers
 *   - Reading/writing user_youtube_connections (including OAuth tokens)
 *   - Any operation that must bypass RLS or use the service role
 *
 * Uses the SERVICE_ROLE key — NEVER exposed to the browser.
 * Never import this file from a Client Component.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

let _serverClient: SupabaseClient | null = null;

/** Returns the service-role Supabase client (bypasses RLS) */
export function getServerAuthClient(): SupabaseClient | null {
  if (_serverClient) return _serverClient;

  const url    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !svcKey) {
    console.warn('[AuthServer] SUPABASE_SERVICE_ROLE_KEY missing — server auth unavailable.');
    return null;
  }

  _serverClient = createClient(url, svcKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _serverClient;
}

// ─── User extraction from request ─────────────────────────────────────────────

/**
 * Extract the authenticated user from an incoming Next.js API request.
 * Reads the Authorization header (Bearer <access_token>) or the
 * sb-access-token cookie that Supabase sets after login.
 *
 * Returns null if no valid session is found.
 */
export async function getUserFromRequest(request: NextRequest): Promise<{
  id: string;
  email: string | undefined;
} | null> {
  const db = getServerAuthClient();
  if (!db) return null;

  // 1. Try Authorization header (used by API calls from the client)
  const authHeader = request.headers.get('authorization') ?? '';
  const bearerToken = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null;

  // 2. Try Supabase cookie (set automatically after OAuth redirect)
  const cookieHeader = request.headers.get('cookie') ?? '';
  const cookieToken  = extractSupabaseCookieToken(cookieHeader);

  const token = bearerToken ?? cookieToken;
  if (!token) return null;

  try {
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email };
  } catch {
    return null;
  }
}

/** Pull the Supabase access token from the cookie string */
function extractSupabaseCookieToken(cookieHeader: string): string | null {
  // Check for temporary auth token cookie (set by client before navigation)
  const cookies = cookieHeader.split(';').map(c => c.trim());
  for (const cookie of cookies) {
    const eqIdx = cookie.indexOf('=');
    if (eqIdx === -1) continue;
    const name  = cookie.slice(0, eqIdx).trim();
    const value = cookie.slice(eqIdx + 1).trim();
    
    // Check for temporary token first
    if (name === 'sb-temp-auth-token') {
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
    
    // Then check for Supabase auth-token cookies
    if (name.includes('auth-token') || name.includes('access-token')) {
      try {
        const decoded = decodeURIComponent(value);
        // The value may be a JSON string containing access_token
        if (decoded.startsWith('{')) {
          const parsed = JSON.parse(decoded);
          if (parsed.access_token) return parsed.access_token;
        }
        // Or it might be the raw access token
        if (decoded.length > 20) return decoded;
      } catch {
        if (value.length > 20) return value;
      }
    }
  }
  return null;
}
