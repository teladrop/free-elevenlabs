/**
 * POST /api/my-channel/refresh-competitors
 *
 * Refreshes competitor data for the authenticated user.
 * Detects niche, discovers 10 competitors, and caches them.
 *
 * Called by:
 * - Manual sync button on My Channel page
 * - Weekly cron job (GitHub Actions or scheduled task)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/db/auth-server';
import { getOrRefreshCompetitorData } from '@/lib/my-channel/competitor-cache';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const origin = new URL(request.url).origin;

  // Authenticate user
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.redirect(`${origin}/my-channel?error=not_authenticated`);
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  try {
    // Fetch user's channel connection
    const { data: connection, error: connError } = await db
      .from('user_youtube_connections')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (connError || !connection) {
      return NextResponse.json(
        { success: false, error: 'No YouTube connection found' },
        { status: 404 },
      );
    }

    // Fetch user's synced videos
    const { data: videos, error: vidError } = await db
      .from('user_channel_videos')
      .select('*')
      .eq('connection_id', connection.id)
      .limit(200);

    if (vidError || !videos) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch videos' },
        { status: 500 },
      );
    }

    // Refresh competitor data
    const competitors = await getOrRefreshCompetitorData(
      user.id,
      connection,
      videos,
      true, // Force refresh
    );

    return NextResponse.json({
      success: true,
      competitorsCount: competitors.length,
      competitors: competitors.map((c) => ({
        title: c.title,
        handle: c.handle,
        subscribers: c.subscriberCount,
        engagement: c.avgEngagementRate.toFixed(2) + '%',
        uploads: c.uploadFrequency.toFixed(1) + '/mo',
      })),
    });
  } catch (error: any) {
    console.error('[refresh-competitors] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
