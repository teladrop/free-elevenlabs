/**
 * GET /api/auth/callback
 *
 * Supabase OAuth callback.
 *
 * Supabase may use either:
 *   - PKCE flow:     ?code=<code>  (preferred, exchanged server-side)
 *   - Implicit flow: #access_token=... (tokens in URL fragment, client-side only)
 *
 * For the implicit flow the fragment is NOT sent to the server, so we redirect
 * to a client-side page (/auth/complete) that can read the fragment and set
 * the session via the Supabase JS client.
 *
 * For the PKCE flow (code in query string) we exchange it here and set cookies.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function parseCookies(header: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try { result[key] = decodeURIComponent(val); } catch { result[key] = val; }
  }
  return result;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code  = searchParams.get('code');
  const next  = searchParams.get('next') ?? '/my-channel';

  // ── PKCE flow: code in query string ──────────────────────────────────────
  if (code) {
    const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.redirect(`${origin}/my-channel?error=config_error`);
    }

    const cookies = parseCookies(request.headers.get('cookie') ?? '');

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
      console.error('[auth/callback] PKCE exchange failed:', error?.message);
      return NextResponse.redirect(`${origin}/my-channel?error=session_failed`);
    }

    // Set the session cookie
    const projectRef  = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? 'supabase';
    const cookieName  = `sb-${projectRef}-auth-token`;
    const sessionJson = JSON.stringify({
      access_token:  data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at:    data.session.expires_at,
      expires_in:    data.session.expires_in,
      token_type:    data.session.token_type,
      user:          data.session.user,
    });

    const response = NextResponse.redirect(`${origin}${next}`);
    response.cookies.set(cookieName, sessionJson, {
      httpOnly: false,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   60 * 60 * 24 * 7,
      path:     '/',
    });
    return response;
  }

  // ── Implicit flow: no code — tokens will be in the fragment (#access_token=...)
  // The server never sees the fragment. Redirect to the client-side handler
  // which reads the fragment and calls supabase.auth.setSession().
  return NextResponse.redirect(`${origin}/auth/complete?next=${encodeURIComponent(next)}`);
}
