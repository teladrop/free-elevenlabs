/**
 * POST /api/my-channel/disconnect
 *
 * Revokes the user's YouTube OAuth tokens and removes the connection.
 * Also clears all channel-specific data (competitors, AI suggestions,
 * snapshots) since they belong to the disconnected channel — a newly
 * connected channel should start fresh.
 *
 * Auth: Authorization: Bearer <supabase_access_token>
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

  // Clear all channel-specific data so a newly connected channel starts fresh
  // Run in parallel — failures are non-fatal (data will just be stale)
  await Promise.allSettled([
    // Competitors added for this channel
    db.from('competitor_channels')
      .delete()
      .eq('user_id', user.id),

    // AI growth analysis cache
    db.from('channel_ai_suggestions')
      .delete()
      .eq('user_id', user.id),

    // Historical snapshots (chart data for old channel — irrelevant for new one)
    db.from('competitor_snapshots')
      .delete()
      .eq('user_id', user.id),
  ]);

  console.log(`[disconnect] Cleared channel data for user ${user.id}`);

  return NextResponse.json({ success: true, disconnectedAt: new Date().toISOString() });
}
