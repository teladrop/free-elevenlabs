/**
 * POST /api/my-channel/disconnect
 *
 * Revokes the user's YouTube OAuth tokens and removes the connection.
 * Preserves the historical video/snapshot records (user may want to keep them).
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

  // Delete the connection row (cascades to nothing — videos/snapshots are kept)
  const { error } = await db
    .from('user_youtube_connections')
    .delete()
    .eq('user_id', user.id);

  if (error) {
    console.error('[disconnect] delete error:', error.message);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }

  return NextResponse.json({ success: true, disconnectedAt: new Date().toISOString() });
}
