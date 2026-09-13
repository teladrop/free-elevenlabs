/**
 * GET /api/my-channel/data
 *
 * Returns the authenticated user's channel data from Supabase:
 *   - connection status + channel summary
 *   - videos (sorted by view_count or published_at)
 *   - channel snapshots (last 30 days)
 *
 * Auth: Authorization: Bearer <supabase_access_token>
 * Tokens are NEVER included in the response.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/db/auth-server';
import {
  getConnectionForUser,
  getVideosForUser,
  getChannelSnapshots,
} from '@/lib/my-channel/channel-sync';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const videoSort  = (searchParams.get('sort') ?? 'view_count') as 'view_count' | 'published_at';
  const videoLimit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);

  const [connection, videos, snapshots] = await Promise.all([
    getConnectionForUser(user.id),
    getVideosForUser(user.id, videoLimit, videoSort),
    getChannelSnapshots(user.id, 30),
  ]);

  return NextResponse.json({
    userId:     user.id,
    connection,
    videos,
    snapshots,
    fetchedAt:  new Date().toISOString(),
  });
}
