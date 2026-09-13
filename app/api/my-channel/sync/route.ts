/**
 * POST /api/my-channel/sync
 *
 * Triggers a manual channel sync for the authenticated user.
 * Returns sync result. Called from the My Channel page "Sync now" button.
 *
 * Auth: Authorization: Bearer <supabase_access_token>
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/db/auth-server';
import { syncUserChannel } from '@/lib/my-channel/channel-sync';

export const dynamic    = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const result = await syncUserChannel(user.id);

  if (result.error) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    success:        true,
    videosUpserted: result.videosUpserted,
    syncedAt:       result.syncedAt,
  });
}
