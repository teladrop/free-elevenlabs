/**
 * GET    /api/my-channel/competitors              — list competitors for current channel
 * POST   /api/my-channel/competitors              — search YouTube + add a competitor
 * DELETE /api/my-channel/competitors?id=          — remove a competitor
 *
 * All operations are scoped to (user_id + connected_channel_id) so each
 * connected YouTube channel has its own independent competitor list.
 * Switching channels never shows stale competitors from another channel.
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

// ── Resolve the currently connected channel ID for this user ──────────────────
async function getConnectedChannelId(userId: string): Promise<string | null> {
  const { data } = await db()
    .from('user_youtube_connections')
    .select('channel_id')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.channel_id ?? null;
}

// ─── GET — list competitors for current channel ───────────────────────────────

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const channelId = await getConnectedChannelId(user.id);
  if (!channelId) return NextResponse.json({ success: true, competitors: [] });

  const { data, error } = await db()
    .from('competitor_channels')
    .select('*')
    .eq('user_id', user.id)
    .eq('connected_channel_id', channelId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, competitors: data });
}

// ─── POST — search YouTube and add a competitor for current channel ───────────

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const channelId = await getConnectedChannelId(user.id);
  if (!channelId) {
    return NextResponse.json({ error: 'No YouTube channel connected' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const query: string = body.query?.trim() ?? '';

  if (!query) return NextResponse.json({ error: 'query is required' }, { status: 400 });

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'YouTube API key not configured' }, { status: 500 });

  // Check limit — max 10 competitors per channel (not per user)
  const { count } = await db()
    .from('competitor_channels')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('connected_channel_id', channelId);

  if ((count ?? 0) >= 10) {
    return NextResponse.json(
      { error: 'Maximum 10 competitors allowed per channel. Remove one to add another.' },
      { status: 400 },
    );
  }

  // Detect if query is a channel URL or a name
  const resolvedId = extractChannelId(query);
  const channelData = resolvedId
    ? await fetchChannelById(resolvedId, apiKey)
    : await searchChannel(query, apiKey);

  if (!channelData) {
    return NextResponse.json({ error: 'Channel not found. Try the full channel URL.' }, { status: 404 });
  }

  // Check not already added for THIS connected channel
  const { data: existing } = await db()
    .from('competitor_channels')
    .select('id')
    .eq('user_id', user.id)
    .eq('connected_channel_id', channelId)
    .eq('youtube_channel_id', channelData.youtubeChannelId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'This channel is already in your competitors list.' }, { status: 409 });
  }

  // Fetch engagement metrics
  const metrics = await fetchChannelMetrics(channelData.youtubeChannelId, apiKey);

  // Save to DB — scoped to this connected channel
  const { data: inserted, error: insertErr } = await db()
    .from('competitor_channels')
    .insert({
      user_id:              user.id,
      connected_channel_id: channelId,
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
      channel_keywords:     channelData.channelKeywords,
      topic_categories:     channelData.topicCategories,
      last_fetched_at:      new Date().toISOString(),
    })
    .select()
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // Invalidate AI suggestions for this user (channel-specific)
  await db().from('channel_ai_suggestions').delete().eq('user_id', user.id);

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
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db().from('channel_ai_suggestions').delete().eq('user_id', user.id);

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
  channelKeywords:  string[];
  topicCategories:  string[];
}

function extractChannelId(query: string): string | null {
  const m = query.match(/youtube\.com\/channel\/(UC[\w-]+)/i);
  return m ? m[1] : null;
}

async function fetchChannelById(channelId: string, apiKey: string): Promise<ChannelData | null> {
  const url = new URL('https://www.googleapis.com/youtube/v3/channels');
  url.searchParams.set('part', 'snippet,statistics,brandingSettings,topicDetails');
  url.searchParams.set('id', channelId);
  url.searchParams.set('key', apiKey);
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = await res.json();
  const item = data.items?.[0];
  return item ? parseChannelItem(item) : null;
}

async function searchChannel(query: string, apiKey: string): Promise<ChannelData | null> {
  const cleanQuery = query.replace(/^@/, '');
  const searchUrl  = new URL('https://www.googleapis.com/youtube/v3/search');
  searchUrl.searchParams.set('part', 'snippet');
  searchUrl.searchParams.set('q', cleanQuery);
  searchUrl.searchParams.set('type', 'channel');
  searchUrl.searchParams.set('maxResults', '5');
  searchUrl.searchParams.set('key', apiKey);
  const res = await fetch(searchUrl.toString());
  if (!res.ok) return null;
  const data = await res.json();
  const first = data.items?.[0];
  if (!first?.id?.channelId) return null;
  return fetchChannelById(first.id.channelId, apiKey);
}

function parseChannelItem(item: any): ChannelData {
  const stats    = item.statistics          ?? {};
  const snippet  = item.snippet             ?? {};
  const branding = item.brandingSettings?.channel ?? {};
  const topics   = item.topicDetails        ?? {};

  const channelKeywords = parseYouTubeKeywords(branding.keywords ?? '');
  const topicCategories: string[] = (topics.topicCategories ?? []).map((u: string) => {
    const parts = u.split('/');
    return decodeURIComponent(parts[parts.length - 1]).replace(/_/g, ' ');
  });

  return {
    youtubeChannelId: item.id,
    title:            snippet.title        ?? '',
    handle:           snippet.customUrl    ?? '',
    description:      snippet.description  ?? '',
    profileImageUrl:  snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url ?? '',
    subscriberCount:  parseInt(stats.subscriberCount ?? '0', 10),
    videoCount:       parseInt(stats.videoCount      ?? '0', 10),
    viewCount:        parseInt(stats.viewCount       ?? '0', 10),
    channelKeywords,
    topicCategories,
  };
}

function parseYouTubeKeywords(raw: string): string[] {
  if (!raw.trim()) return [];
  const keywords: string[] = [];
  const regex = /"([^"]+)"|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    const kw = (match[1] ?? match[2]).trim();
    if (kw) keywords.push(kw);
  }
  return keywords;
}

async function fetchChannelMetrics(channelId: string, apiKey: string) {
  try {
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    searchUrl.searchParams.set('part', 'snippet');
    searchUrl.searchParams.set('channelId', channelId);
    searchUrl.searchParams.set('type', 'video');
    searchUrl.searchParams.set('maxResults', '20');
    searchUrl.searchParams.set('order', 'date');
    searchUrl.searchParams.set('key', apiKey);

    const searchRes = await fetch(searchUrl.toString());
    if (!searchRes.ok) return { avgEngagementRate: 0, avgViewsPerVideo: 0, uploadFrequency: 0 };

    const videos = (await searchRes.json()).items ?? [];
    if (!videos.length) return { avgEngagementRate: 0, avgViewsPerVideo: 0, uploadFrequency: 0 };

    const videoIds = videos.slice(0, 10).map((v: any) => v.id.videoId).filter(Boolean);
    if (!videoIds.length) return { avgEngagementRate: 0, avgViewsPerVideo: 0, uploadFrequency: 0 };

    const statsUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
    statsUrl.searchParams.set('part', 'statistics');
    statsUrl.searchParams.set('id', videoIds.join(','));
    statsUrl.searchParams.set('key', apiKey);

    const statsData = (await (await fetch(statsUrl.toString())).json()).items ?? [];

    let totalViews = 0, totalLikes = 0, totalComments = 0;
    for (const item of statsData) {
      const s = item.statistics ?? {};
      totalViews    += parseInt(s.viewCount    ?? '0', 10);
      totalLikes    += parseInt(s.likeCount    ?? '0', 10);
      totalComments += parseInt(s.commentCount ?? '0', 10);
    }

    const avgViewsPerVideo  = statsData.length ? totalViews / statsData.length : 0;
    const avgEngagementRate = totalViews > 0 ? ((totalLikes + totalComments) / totalViews) * 100 : 0;

    const dates = videos
      .map((v: any) => new Date(v.snippet?.publishedAt).getTime())
      .filter((d: number) => !isNaN(d));

    let uploadFrequency = 0;
    if (dates.length >= 2) {
      const span = (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24 * 30);
      uploadFrequency = span > 0 ? dates.length / span : 0;
    }

    return { avgEngagementRate, avgViewsPerVideo, uploadFrequency };
  } catch {
    return { avgEngagementRate: 0, avgViewsPerVideo: 0, uploadFrequency: 0 };
  }
}
