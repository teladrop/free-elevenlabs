/**
 * GET /api/my-channel/competitor-snapshots
 *
 * Returns historical + current snapshot data for all competitor channels
 * and the user's own channel. Used by the Compare Performance (Gap) chart.
 *
 * Strategy:
 *   1. Pull historical snapshots from user_channel_snapshots / competitor_snapshots
 *   2. Always inject today's current values from user_youtube_connections /
 *      competitor_channels so the chart always has at least one data point,
 *      even if the user has never synced daily history.
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
  const days  = Math.min(parseInt(searchParams.get('days') ?? '60', 10), 365);
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const supabase = db();

  // ── 1. My channel: connection row (always has current counts) ────────────
  const { data: conn } = await supabase
    .from('user_youtube_connections')
    .select('channel_title, channel_id, subscriber_count, view_count, video_count')
    .eq('user_id', user.id)
    .single();

  // ── 2. My channel: historical snapshots ──────────────────────────────────
  const { data: mySnapsRaw } = await supabase
    .from('user_channel_snapshots')
    .select('snapshot_date, subscriber_count, view_count, video_count')
    .eq('user_id', user.id)
    .gte('snapshot_date', since)
    .order('snapshot_date', { ascending: true });

  // Inject today's current values if not already present
  const mySnaps = mergeCurrentSnapshot(mySnapsRaw ?? [], today, {
    subscriber_count: conn?.subscriber_count ?? 0,
    view_count:       conn?.view_count ?? 0,
    video_count:      conn?.video_count ?? 0,
  });

  // ── 3. Competitors: current data ─────────────────────────────────────────
  const { data: competitors } = await supabase
    .from('competitor_channels')
    .select('id, channel_title, profile_image_url, subscriber_count, view_count, video_count')
    .eq('user_id', user.id)
    .order('subscriber_count', { ascending: false })
    .limit(8);

  if (!competitors || competitors.length === 0) {
    return NextResponse.json({
      myChannel: {
        label:     conn?.channel_title ?? 'My Channel',
        snapshots: mySnaps,
        isOwn:     true,
      },
      competitors: [],
    });
  }

  // ── 4. Competitors: historical snapshots ─────────────────────────────────
  const competitorIds = competitors.map((c: any) => c.id);
  const { data: compSnapsRaw } = await supabase
    .from('competitor_snapshots')
    .select('competitor_id, snapshot_date, subscriber_count, view_count, video_count')
    .in('competitor_id', competitorIds)
    .gte('snapshot_date', since)
    .order('snapshot_date', { ascending: true });

  // Group historical snaps by competitor_id
  const snapsByComp = new Map<string, any[]>();
  for (const snap of compSnapsRaw ?? []) {
    const arr = snapsByComp.get(snap.competitor_id) ?? [];
    arr.push(snap);
    snapsByComp.set(snap.competitor_id, arr);
  }

  // Build competitor series — always inject today's current row
  const competitorSeries = competitors.map((c: any) => {
    const historical = snapsByComp.get(c.id) ?? [];
    const withToday  = mergeCurrentSnapshot(historical, today, {
      subscriber_count: c.subscriber_count ?? 0,
      view_count:       c.view_count ?? 0,
      video_count:      c.video_count ?? 0,
    });

    return {
      id:        c.id,
      label:     c.channel_title,
      avatar:    c.profile_image_url,
      isOwn:     false,
      snapshots: withToday,
    };
  });

  return NextResponse.json({
    myChannel: {
      label:     conn?.channel_title ?? 'My Channel',
      snapshots: mySnaps,
      isOwn:     true,
    },
    competitors: competitorSeries,
  });
}

// ─── Helper: merge today's current values into snapshot array ────────────────
// If today's date is already present, leave it unchanged (real sync wins).
// Otherwise append it so there's always at least one data point.

function mergeCurrentSnapshot(
  snaps:   { snapshot_date: string; subscriber_count: number; view_count: number; video_count: number }[],
  today:   string,
  current: { subscriber_count: number; view_count: number; video_count: number },
) {
  const alreadyHasToday = snaps.some(s => s.snapshot_date === today);

  // Always ensure today's row exists
  const withToday = alreadyHasToday
    ? snaps
    : [...snaps, { snapshot_date: today, ...current }];

  // If there's still only one point, duplicate it as yesterday so Recharts
  // can draw a line segment (a line needs at least 2 points).
  if (withToday.length === 1) {
    const yesterday = new Date(today + 'T00:00:00');
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    return [
      { snapshot_date: yesterdayStr, ...current },
      ...withToday,
    ];
  }

  return withToday;
}
