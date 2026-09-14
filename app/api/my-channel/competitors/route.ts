/**
 * GET  /api/my-channel/competitors        — list user's added competitors
 * POST /api/my-channel/competitors        — search YouTube + add a competitor
 * DELETE /api/my-channel/competitors?id=  — remove a competitor
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

// ─── GET — list competitors ───────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await db()
    .from('competitor_channels')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, competitors: data });
}

// ─── POST — search YouTube and add a competitor ───────────────────────────────

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const query: string = body.query?.trim() ?? '';

  if (!query) return NextResponse.json({ error: 'query is required' }, { status: 400 });

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'YouTube API key not configured' }, { status: 500 });

  // Check limit — max 10 competitors per user
  const { count } = await db()
    .from('competitor_channels')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if ((count ?? 0) >= 10) {
    return NextResponse.json(
      { error: 'Maximum 10 competitors allowed. Remove one before adding another.' },
      { status: 400 },
    );
  }

  // Detect if query is a channel URL or a name
  const channelId = extractChannelId(query);

  let channelData: ChannelData | null = null;

  if (channelId) {
    // Direct lookup by ID
    channelData = await fetchChannelById(channelId, apiKey);
  } else {
    // Search by name/handle
    channelData = await searchChannel(query, apiKey);
  }

  if (!channelData) {
    return NextResponse.json({ error: 'Channel not found. Try the full channel URL.' }, { status: 404 });
  }

  // Check not already added
  const { data: existing } = await db()
    .from('competitor_channels')
    .select('id')
    .eq('user_id', user.id)
    .eq('youtube_channel_id', channelData.youtubeChannelId)
    .single();

  if (existing) {
    return NextResponse.json({ error: 'This channel is already in your competitors list.' }, { status: 409 });
  }

  // Fetch engagement metrics from top 10 videos
  const metrics = await fetchChannelMetrics(channelData.youtubeChannelId, apiKey);

  // Save to DB
  const { data: inserted, error: insertErr } = await db()
    .from('competitor_channels')
    .insert({
      user_id:              user.id,
      youtube_channel_id:   channelData.youtubeChannelId,
      channel_title:        channelData.title,
      channel_handle:       channelData.handle,
      profile_image_url:    channelData.profileImageUrl,
      description:          channelData.description,
      subscriber_count:     channelData.subscriberCount,
      video_count:          channelData.videoCount,
      view_count:           channelData.viewCount,
      avg_engagement_rate:  metrics.avgEngagementRate,
      avg_views_per_video:  metrics.avgViewsPerVideo,
      upload_frequency:     metrics.uploadFrequency,
      last_fetched_at:      new Date().toISOString(),
    })
    .select()
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // Invalidate cached AI suggestions so next load re-generates
  await db()
    .from('channel_ai_suggestions')
    .delete()
    .eq('user_id', user.id);

  return NextResponse.json({ success: true, competitor: inserted });
}

// ─── DELETE — remove a competitor ────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const { error } = await db()
    .from('competitor_channels')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id); // RLS safety

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Invalidate AI suggestions
  await db()
    .from('channel_ai_suggestions')
    .delete()
    .eq('user_id', user.id);

  return NextResponse.json({ success: true });
}

// ─── YouTube helpers ──────────────────────────────────────────────────────────

interface ChannelData {
  youtubeChannelId: string;
  title:            string;
  handle:           string;
  description:      string;
  profileImageUrl:  string;
  subscriberCount:  number;
  videoCount:       number;
  viewCount:        number;
}

function extractChannelId(query: string): string | null {
  // Matches:
  // https://youtube.com/channel/UCxxxxxx
  // https://youtube.com/@handle  → need to search
  const channelMatch = query.match(/youtube\.com\/channel\/(UC[\w-]+)/i);
  if (channelMatch) return channelMatch[1];
  return null;
}

async function fetchChannelById(channelId: string, apiKey: string): Promise<ChannelData | null> {
  const url = new URL('https://www.googleapis.com/youtube/v3/channels');
  url.searchParams.set('part', 'snippet,statistics');
  url.searchParams.set('id', channelId);
  url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) return null;

  const data = await res.json();
  const item = data.items?.[0];
  if (!item) return null;

  return parseChannelItem(item);
}

async function searchChannel(query: string, apiKey: string): Promise<ChannelData | null> {
  // Strip leading @ for handle searches
  const cleanQuery = query.replace(/^@/, '');

  // First try: search by channel type
  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
  searchUrl.searchParams.set('part', 'snippet');
  searchUrl.searchParams.set('q', cleanQuery);
  searchUrl.searchParams.set('type', 'channel');
  searchUrl.searchParams.set('maxResults', '5');
  searchUrl.searchParams.set('key', apiKey);

  const searchRes = await fetch(searchUrl.toString());
  if (!searchRes.ok) return null;

  const searchData = await searchRes.json();
  const firstResult = searchData.items?.[0];
  if (!firstResult?.id?.channelId) return null;

  return fetchChannelById(firstResult.id.channelId, apiKey);
}

function parseChannelItem(item: any): ChannelData {
  const stats   = item.statistics ?? {};
  const snippet = item.snippet ?? {};
  return {
    youtubeChannelId: item.id,
    title:            snippet.title ?? '',
    handle:           snippet.customUrl ?? '',
    description:      snippet.description ?? '',
    profileImageUrl:  snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url ?? '',
    subscriberCount:  parseInt(stats.subscriberCount ?? '0', 10),
    videoCount:       parseInt(stats.videoCount      ?? '0', 10),
    viewCount:        parseInt(stats.viewCount       ?? '0', 10),
  };
}

async function fetchChannelMetrics(channelId: string, apiKey: string) {
  try {
    // Get 20 most recent videos
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    searchUrl.searchParams.set('part', 'snippet');
    searchUrl.searchParams.set('channelId', channelId);
    searchUrl.searchParams.set('type', 'video');
    searchUrl.searchParams.set('maxResults', '20');
    searchUrl.searchParams.set('order', 'date');
    searchUrl.searchParams.set('key', apiKey);

    const searchRes = await fetch(searchUrl.toString());
    if (!searchRes.ok) return { avgEngagementRate: 0, avgViewsPerVideo: 0, uploadFrequency: 0 };

    const searchData = await searchRes.json();
    const videos     = searchData.items ?? [];
    if (videos.length === 0) return { avgEngagementRate: 0, avgViewsPerVideo: 0, uploadFrequency: 0 };

    // Get stats for top 10
    const videoIds = videos.slice(0, 10).map((v: any) => v.id.videoId).filter(Boolean);
    if (videoIds.length === 0) return { avgEngagementRate: 0, avgViewsPerVideo: 0, uploadFrequency: 0 };

    const statsUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
    statsUrl.searchParams.set('part', 'statistics');
    statsUrl.searchParams.set('id', videoIds.join(','));
    statsUrl.searchParams.set('key', apiKey);

    const statsRes  = await fetch(statsUrl.toString());
    const statsData = statsRes.ok ? await statsRes.json() : { items: [] };
    const items     = statsData.items ?? [];

    let totalViews    = 0;
    let totalLikes    = 0;
    let totalComments = 0;

    for (const item of items) {
      const s = item.statistics ?? {};
      totalViews    += parseInt(s.viewCount    ?? '0', 10);
      totalLikes    += parseInt(s.likeCount    ?? '0', 10);
      totalComments += parseInt(s.commentCount ?? '0', 10);
    }

    const avgViewsPerVideo  = items.length > 0 ? totalViews / items.length : 0;
    const avgEngagementRate = totalViews > 0 ? ((totalLikes + totalComments) / totalViews) * 100 : 0;

    // Upload frequency from publish dates of the 20 most recent videos
    const dates = videos
      .map((v: any) => new Date(v.snippet?.publishedAt).getTime())
      .filter((d: number) => !isNaN(d));

    let uploadFrequency = 0;
    if (dates.length >= 2) {
      const span    = (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24 * 30);
      uploadFrequency = span > 0 ? dates.length / span : 0;
    }

    return { avgEngagementRate, avgViewsPerVideo, uploadFrequency };
  } catch {
    return { avgEngagementRate: 0, avgViewsPerVideo: 0, uploadFrequency: 0 };
  }
}
