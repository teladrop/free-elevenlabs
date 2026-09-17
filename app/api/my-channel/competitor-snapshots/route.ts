/**
 * GET /api/my-channel/competitor-snapshots
 *
 * Returns historical snapshots for all competitor channels + the user's own channel.
 * Used by the Compare Performance chart.
 *
 * Query params:
 *   days = number  (default: 60)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserFromRequest } from '@/lib/db/auth-server';

export const dynamic = 'force-dynamic';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const days = Math.min(parseInt(searchParams.get('days') ?? '60', 10), 365);
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const supabase = db();

  // 1. My channel snapshots
  const { data: mySnaps } = await supabase
    .from('user_channel_snapshots')
    .select('snapshot_date, subscriber_count, view_count, video_count')
    .eq('user_id', user.id)
    .gte('snapshot_date', since)
    .order('snapshot_date', { ascending: true });

  // 2. My channel name
  const { data: conn } = await supabase
    .from('user_youtube_connections')
    .select('channel_title, channel_id')
    .eq('user_id', user.id)
    .single();

  // 3. Competitor channels for this user
  const { data: competitors } = await supabase
    .from('competitor_channels')
    .select('id, channel_title, profile_image_url')
    .eq('user_id', user.id)
    .order('subscriber_count', { ascending: false })
    .limit(8);

  if (!competitors || competitors.length === 0) {
    return NextResponse.json({
      myChannel: {
        label: conn?.channel_title ?? 'My Channel',
        snapshots: mySnaps ?? [],
        isOwn: true,
      },
      competitors: [],
    });
  }

  // 4. Competitor snapshots
  const competitorIds = competitors.map((c: any) => c.id);
  const { data: compSnaps } = await supabase
    .from('competitor_snapshots')
    .select('competitor_id, snapshot_date, subscriber_count, view_count, video_count')
    .in('competitor_id', competitorIds)
    .gte('snapshot_date', since)
    .order('snapshot_date', { ascending: true });

  // Group by competitor_id
  const snapsByComp = new Map<string, any[]>();
  for (const snap of compSnaps ?? []) {
    const arr = snapsByComp.get(snap.competitor_id) ?? [];
    arr.push(snap);
    snapsByComp.set(snap.competitor_id, arr);
  }

  const competitorSeries = competitors.map((c: any) => ({
    id:           c.id,
    label:        c.channel_title,
    avatar:       c.profile_image_url,
    isOwn:        false,
    snapshots:    snapsByComp.get(c.id) ?? [],
  }));

  return NextResponse.json({
    myChannel: {
      label:     conn?.channel_title ?? 'My Channel',
      snapshots: mySnaps ?? [],
      isOwn:     true,
    },
    competitors: competitorSeries,
  });
}
