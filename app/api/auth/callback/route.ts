/**
 * GET /api/auth/callback
 *
 * Supabase OAuth callback — handles the redirect from Google after the user
 * signs in with Google through Supabase Auth.
 *
 * Supabase sends:  ?code=<auth_code>&next=/my-channel
 * This route exchanges the code for a session then redirects the user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/my-channel';

  if (!code) {
    return NextResponse.redirect(`${origin}/my-channel?error=auth_failed`);
  }

  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.redirect(`${origin}/my-channel?error=config_error`);
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session) {
    console.error('[auth/callback] Session exchange failed:', error?.message);
    return NextResponse.redirect(`${origin}/my-channel?error=session_failed`);
  }

  // Set the session cookie and redirect to the intended page.
  // The browser will store the session via Supabase's cookie handling.
  const response = NextResponse.redirect(`${origin}${next}`);

  // Pass the tokens to the client via a short-lived cookie so the browser
  // Supabase client can pick them up and persist them.
  response.cookies.set('sb-access-token',  data.session.access_token,  {
    httpOnly: false,   // must be readable by Supabase JS client
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   data.session.expires_in ?? 3600,
    path:     '/',
  });

  if (data.session.refresh_token) {
    response.cookies.set('sb-refresh-token', data.session.refresh_token, {
      httpOnly: true,  // refresh token — not readable by JS
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   60 * 60 * 24 * 30, // 30 days
      path:     '/',
    });
  }

  return response;
}
