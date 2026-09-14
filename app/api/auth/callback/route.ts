/**
 * GET /api/auth/callback
 *
 * Supabase OAuth callback — handles the redirect from Google after the user
 * signs in via Supabase Auth.
 *
 * Supabase sends: ?code=<pkce_code>&next=/my-channel
 *
 * The PKCE code verifier is stored in a cookie by the Supabase JS client
 * when it initiates the OAuth flow. We must read that cookie here and pass
 * it to exchangeCodeForSession so Supabase can verify the exchange.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code  = searchParams.get('code');
  const next  = searchParams.get('next') ?? '/my-channel';

  if (!code) {
    console.error('[auth/callback] No code in query string');
    return NextResponse.redirect(`${origin}/my-channel?error=auth_failed`);
  }

  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnon) {
    return NextResponse.redirect(`${origin}/my-channel?error=config_error`);
  }

  // Read every cookie from the request so we can forward the PKCE verifier
  // that the Supabase browser client stored when it started the OAuth flow.
  const cookieHeader = request.headers.get('cookie') ?? '';

  // Build a cookie store that Supabase can use server-side
  const cookies = parseCookies(cookieHeader);

  // Use the Supabase JS client with a custom storage adapter so it can find
  // the PKCE code verifier cookie set by the browser client
  const supabase = createClient(supabaseUrl, supabaseAnon, {
    auth: {
      persistSession:     false,
      autoRefreshToken:   false,
      detectSessionInUrl: false,
      storage: {
        getItem:    (key: string) => cookies[key] ?? null,
        setItem:    () => {},
        removeItem: () => {},
      },
    },
  });

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error('[auth/callback] exchangeCodeForSession failed:', error?.message ?? 'no session');
    return NextResponse.redirect(`${origin}/my-channel?error=session_failed`);
  }

  // Redirect to the target page
  const response = NextResponse.redirect(`${origin}${next}`);

  // Set the Supabase session cookies so the browser client picks them up.
  // The cookie name format Supabase JS v2 expects is:
  //   sb-<project-ref>-auth-token  (access + refresh bundled as JSON)
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? 'supabase';
  const cookieName = `sb-${projectRef}-auth-token`;

  const sessionPayload = JSON.stringify({
    access_token:  data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at:    data.session.expires_at,
    expires_in:    data.session.expires_in,
    token_type:    data.session.token_type,
    user:          data.session.user,
  });

  response.cookies.set(cookieName, sessionPayload, {
    httpOnly: false,   // Supabase JS client needs to read this
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 60 * 24 * 7, // 7 days
    path:     '/',
  });

  return response;
}

// ─── Cookie parser ────────────────────────────────────────────────────────────

function parseCookies(cookieHeader: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key   = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    try {
      result[key] = decodeURIComponent(value);
    } catch {
      result[key] = value;
    }
  }
  return result;
}
