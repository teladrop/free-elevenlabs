/**
 * POST /api/my-channel/disconnect
 *
 * Revokes the user's YouTube OAuth tokens and removes the connection.
 * Competitors are KEPT — they are scoped to connected_channel_id so they
 * will correctly reappear if the same channel is reconnected, and will
 * NOT appear for a different channel.
 * Only the AI suggestions cache is cleared (it is channel-specific).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, getServerAuthClient } from '@/lib/db/auth-server';
import { revokeToken } from '@/lib/my-channel/youtube-oauth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const db = getServerAuthClient();
  if (!db) {
    return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
  }

  // Read tokens before deleting (so we can revoke them)
  const { data: conn } = await db
    .from('user_youtube_connections')
    .select('access_token, refresh_token')
    .eq('user_id', user.id)
    .maybeSingle();

  // Revoke tokens at Google (best-effort, non-blocking)
  if (conn?.access_token)  revokeToken(conn.access_token).catch(() => {});
  if (conn?.refresh_token) revokeToken(conn.refresh_token).catch(() => {});

  // Delete the connection row
  const { error: connErr } = await db
    .from('user_youtube_connections')
    .delete()
    .eq('user_id', user.id);

  if (connErr) {
    console.error('[disconnect] delete connection error:', connErr.message);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }

  // Clear AI suggestions cache only (channel-specific, stale after disconnect)
  // Competitors are KEPT — scoped to connected_channel_id, not cleared here
  try {
    await db
      .from('channel_ai_suggestions')
      .delete()
      .eq('user_id', user.id);
  } catch { /* non-fatal */ }

  console.log(`[disconnect] Disconnected user ${user.id} — competitors preserved`);

  return NextResponse.json({ success: true, disconnectedAt: new Date().toISOString() });
}
