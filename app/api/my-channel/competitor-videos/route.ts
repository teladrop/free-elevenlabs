/**
 * GET /api/my-channel/competitor-videos
 *
 * Fetches top videos from the user's competitor channels.
 * Calculates outlier score = video views / channel avg views per video.
 *
 * Query params:
 *   sortBy   = 'views' | 'outlier'   (default: 'views')
 *   period   = 'week' | 'month' | 'all'  (default: 'month')
 *   includeOwn = 'true' | 'false'    (default: 'false')
 *   limit    = number                (default: 20)
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

export interface CompetitorVideo {
  videoId:        string;
  title:          string;
  thumbnailUrl:   string;
  publishedAt:    string;
  viewCount:      number;
  likeCount:      number;
  commentCount:   number;
  channelId:      string;
  channelTitle:   string;
  channelHandle:  string;
  channelAvatar:  string;
  subscriberCount: number;
  outlierScore:   number;  // viewCount / channel avg views
  isOwnChannel:   boolean;
}

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const sortBy     = searchParams.get('sortBy')     ?? 'views';
  const period     = searchParams.get('period')     ?? 'month';
  const includeOwn = searchParams.get('includeOwn') === 'true';
  const limit      = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50);

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'YouTube API key not configured' }, { status: 500 });

  const supabase = db();

  // Load user's competitor channels
  const { data: competitors } = await supabase
    .from('competitor_channels')
    .select('youtube_channel_id, channel_title, channel_handle, profile_image_url, subscriber_count, avg_views_per_video')
    .eq('user_id', user.id)
    .order('subscriber_count', { ascending: false });

  if (!competitors || competitors.length === 0) {
    return NextResponse.json({ success: true, videos: [] });
  }

  // Optionally include the user's own channel
  let channelList = [...competitors];
  if (includeOwn) {
    const { data: conn } = await supabase
      .from('user_youtube_connections')
      .select('channel_id, channel_title, channel_handle, profile_image_url, subscriber_count')
      .eq('user_id', user.id)
      .single();
    if (conn) {
      channelList = [
        {
          youtube_channel_id: conn.channel_id,
          channel_title:      conn.channel_title,
          channel_handle:     conn.channel_handle ?? '',
          profile_image_url:  conn.profile_image_url ?? '',
          subscriber_count:   conn.subscriber_count ?? 0,
          avg_views_per_video: 0,  // will calculate from fetched videos
          isOwn: true,
        } as any,
        ...channelList,
      ];
    }
  }

  // Period cutoff date
  const now = new Date();
  let publishedAfter: string | null = null;
  if (period === 'week') {
    const d = new Date(now); d.setDate(d.getDate() - 7);
    publishedAfter = d.toISOString();
  } else if (period === 'month') {
    const d = new Date(now); d.setMonth(d.getMonth() - 1);
    publishedAfter = d.toISOString();
  }

  // Fetch videos from all competitor channels in parallel (max 5 channels at once)
  const allVideos: CompetitorVideo[] = [];

  const BATCH = 5;
  for (let i = 0; i < channelList.length; i += BATCH) {
    const batch = channelList.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(ch => fetchChannelTopVideos(ch, publishedAfter, apiKey)),
    );
    for (const r of results) {
      if (r.status === 'fulfilled') allVideos.push(...r.value);
    }
  }

  // Sort
  const sorted = allVideos.sort((a, b) =>
    sortBy === 'outlier'
      ? b.outlierScore - a.outlierScore
      : b.viewCount - a.viewCount
  );

  return NextResponse.json({
    success: true,
    videos:  sorted.slice(0, limit),
    total:   sorted.length,
    fetchedAt: new Date().toISOString(),
  });
}

// ─── Fetch top videos for one channel ────────────────────────────────────────

async function fetchChannelTopVideos(
  channel: any,
  publishedAfter: string | null,
  apiKey: string,
): Promise<CompetitorVideo[]> {
  try {
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    searchUrl.searchParams.set('part', 'snippet');
    searchUrl.searchParams.set('channelId', channel.youtube_channel_id);
    searchUrl.searchParams.set('type', 'video');
    searchUrl.searchParams.set('maxResults', '15');
    searchUrl.searchParams.set('order', 'viewCount');
    if (publishedAfter) searchUrl.searchParams.set('publishedAfter', publishedAfter);
    searchUrl.searchParams.set('key', apiKey);

    const searchRes = await fetch(searchUrl.toString());
    if (!searchRes.ok) return [];

    const searchData = await searchRes.json();
    const items = searchData.items ?? [];
    if (items.length === 0) return [];

    const videoIds = items.map((v: any) => v.id.videoId).filter(Boolean);
    if (videoIds.length === 0) return [];

    // Fetch video stats
    const statsUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
    statsUrl.searchParams.set('part', 'statistics,snippet');
    statsUrl.searchParams.set('id', videoIds.join(','));
    statsUrl.searchParams.set('key', apiKey);

    const statsRes = await fetch(statsUrl.toString());
    if (!statsRes.ok) return [];

    const statsData = await statsRes.json();
    const statsItems = statsData.items ?? [];

    // Calculate channel avg from these videos (for outlier score)
    const totalViews = statsItems.reduce((s: number, v: any) =>
      s + parseInt(v.statistics?.viewCount ?? '0', 10), 0);
    const channelAvg = channel.avg_views_per_video > 0
      ? channel.avg_views_per_video
      : statsItems.length > 0 ? totalViews / statsItems.length : 1;

    return statsItems.map((v: any) => {
      const views = parseInt(v.statistics?.viewCount ?? '0', 10);
      const snip  = v.snippet ?? {};
      return {
        videoId:        v.id,
        title:          snip.title ?? '',
        thumbnailUrl:   snip.thumbnails?.medium?.url ?? snip.thumbnails?.default?.url ?? '',
        publishedAt:    snip.publishedAt ?? '',
        viewCount:      views,
        likeCount:      parseInt(v.statistics?.likeCount    ?? '0', 10),
        commentCount:   parseInt(v.statistics?.commentCount ?? '0', 10),
        channelId:      channel.youtube_channel_id,
        channelTitle:   channel.channel_title,
        channelHandle:  channel.channel_handle ?? '',
        channelAvatar:  channel.profile_image_url ?? '',
        subscriberCount: channel.subscriber_count ?? 0,
        outlierScore:   channelAvg > 0 ? parseFloat((views / channelAvg).toFixed(1)) : 0,
        isOwnChannel:   channel.isOwn ?? false,
      };
    });
  } catch {
    return [];
  }
}
