/**
 * GET /api/my-channel/callback
 *
 * YouTube OAuth callback.
 * Google redirects here after the user grants permission.
 *
 * Flow:
 *   1. Verify CSRF state
 *   2. Extract userId from state
 *   3. Exchange code → tokens
 *   4. Fetch the user's YouTube channel
 *   5. Upsert user_youtube_connections with tokens (server-side only)
 *   6. Trigger initial sync
 *   7. Redirect to /my-channel
 *
 * Tokens are NEVER returned to the browser.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthClient } from '@/lib/db/auth-server';
import { exchangeCodeForTokens, fetchOwnChannel } from '@/lib/my-channel/youtube-oauth';
import { syncUserChannel } from '@/lib/my-channel/channel-sync';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code  = searchParams.get('code');
  const state = searchParams.get('state');
  const oauthError = searchParams.get('error');

  // ── User cancelled or error from Google ──────────────────────────────────
  if (oauthError) {
    const msg = oauthError === 'access_denied' ? 'cancelled' : 'oauth_error';
    return NextResponse.redirect(`${origin}/my-channel?error=${msg}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/my-channel?error=invalid_callback`);
  }

  // ── CSRF verification ─────────────────────────────────────────────────────
  const storedState = request.cookies.get('yt_oauth_state')?.value ?? '';
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${origin}/my-channel?error=state_mismatch`);
  }

  // Extract userId from state: "<userId>_<randomHex>"
  const userId = state.split('_')[0];
  if (!userId) {
    return NextResponse.redirect(`${origin}/my-channel?error=invalid_state`);
  }

  const db = getServerAuthClient();
  if (!db) {
    return NextResponse.redirect(`${origin}/my-channel?error=db_unavailable`);
  }

  try {
    // ── Exchange code for tokens ────────────────────────────────────────────
    const tokens = await exchangeCodeForTokens(code, origin);

    // ── Fetch the user's YouTube channel ───────────────────────────────────
    const channel = await fetchOwnChannel(tokens.access_token);

    // ── Upsert connection (tokens stored server-side only) ──────────────────
    const now = new Date().toISOString();
    const { error: upsertErr } = await db
      .from('user_youtube_connections')
      .upsert({
        user_id:            userId,
        youtube_channel_id: channel.channelId,
        channel_title:      channel.title,
        channel_handle:     channel.handle,
        thumbnail_url:      channel.thumbnailUrl,
        subscriber_count:   channel.subscriberCount,
        video_count:        channel.videoCount,
        view_count:         channel.viewCount,
        access_token:       tokens.access_token,
        refresh_token:      tokens.refresh_token ?? '',
        token_expires_at:   tokens.expires_at.toISOString(),
        status:             'connected',
        connected_at:       now,
        updated_at:         now,
      }, { onConflict: 'user_id' });

    if (upsertErr) {
      console.error('[yt-callback] upsert error:', upsertErr.message);
      return NextResponse.redirect(`${origin}/my-channel?error=db_write_failed`);
    }

    // ── Trigger initial sync (non-blocking — fire and continue redirect) ────
    syncUserChannel(userId).catch(e =>
      console.warn('[yt-callback] background sync error:', e.message),
    );

    // ── Clear CSRF cookie and redirect ──────────────────────────────────────
    const response = NextResponse.redirect(`${origin}/my-channel?connected=1`);
    response.cookies.set('yt_oauth_state', '', { maxAge: 0, path: '/' });
    return response;

  } catch (err: any) {
    console.error('[yt-callback] error:', err.message);
    const encoded = encodeURIComponent(err.message.slice(0, 100));
    return NextResponse.redirect(`${origin}/my-channel?error=connect_failed&msg=${encoded}`);
  }
}
