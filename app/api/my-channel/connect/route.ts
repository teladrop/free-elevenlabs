/**
 * GET /api/my-channel/connect
 *
 * Initiates the YouTube OAuth flow.
 * Requires the user to be signed in (Supabase session required).
 * Generates a random CSRF state token, stores it in a short-lived cookie,
 * then redirects to Google's consent screen.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getUserFromRequest } from '@/lib/db/auth-server';
import { buildYouTubeAuthUrl } from '@/lib/my-channel/youtube-oauth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;

  // Must be authenticated
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.redirect(`${origin}/my-channel?error=not_authenticated`);
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(`${origin}/my-channel?error=youtube_not_configured`);
  }

  // CSRF state = userId_randomHex
  const state = `${user.id}_${crypto.randomBytes(16).toString('hex')}`;

  const authUrl = buildYouTubeAuthUrl(state);

  const response = NextResponse.redirect(authUrl);
  // Store state in a short-lived HttpOnly cookie for CSRF verification in the callback
  response.cookies.set('yt_oauth_state', state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   600, // 10 minutes
    path:     '/',
  });

  return response;
}
