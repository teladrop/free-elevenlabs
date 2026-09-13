/**
 * YouTube Data API search — videos and channels for the user's query.
 * Does not invent keywords, titles, or opportunities.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  ApiResponse,
  YouTubeVideoData,
  ChannelData,
  KeywordIntelligence,
  ResearchResult,
  TitlePattern,
  ContentGap,
  VideoOpportunity,
} from '@/lib/types';
import { sanitizeSearchText, isVerifiedSearchTerm } from '@/lib/youtube/autocomplete';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const YT = 'https://www.googleapis.com/youtube/v3';

/* ─── YouTube API helpers ─────────────────────────────────────────────────── */

async function ytFetch(path: string, params: Record<string, string>, apiKey: string) {
  const url = new URL(`${YT}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('key', apiKey);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `YouTube API ${path} failed: ${res.statusText}`);
  }
  return res.json();
}

/** ISO 8601 duration → seconds */
function iso8601ToSeconds(d: string): number {
  const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] || '0') * 3600) + (parseInt(m[2] || '0') * 60) + parseInt(m[3] || '0');
}

/** Seconds → human "MM:SS" or "H:MM:SS" */
function secondsToHuman(s: number): string {
  if (s <= 0) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/** Age in days from ISO date string */
function ageDays(dateStr: string): number {
  return Math.round((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}


/* ─── Channel scoring ─────────────────────────────────────────────────────── */

function scoreChannel(ch: Omit<ChannelData, 'performanceScore' | 'performanceBreakdown'>, allChannels: typeof ch[]): ChannelData {
  const maxSubs = Math.max(...allChannels.map(c => c.subscriberCount || 0), 1);
  const maxAvgViews = Math.max(...allChannels.map(c => c.avgRecentViews || 0), 1);
  const avgTopViews = allChannels.reduce((s, c) => s + (c.avgRecentViews || 0), 0) / (allChannels.length || 1);

  // 0-20: relevance — how many of this channel's videos are in the niche
  const relevance = Math.min(20, Math.round((ch.nicheVideos.length / Math.max(1, allChannels.reduce((m, c) => Math.max(m, c.nicheVideos.length), 0))) * 20));

  // 0-20: subscriber size (log-scaled so small creators aren't buried)
  const subScore = ch.subscriberCount
    ? Math.min(20, Math.round((Math.log10(ch.subscriberCount + 1) / Math.log10(maxSubs + 2)) * 20))
    : 0;

  // 0-20: recent niche video performance (avg views vs best in group)
  const recentPerf = ch.avgRecentViews
    ? Math.min(20, Math.round((ch.avgRecentViews / maxAvgViews) * 20))
    : 0;

  // 0-20: avg views ratio vs group average
  const avgViewsScore = avgTopViews > 0 && ch.avgRecentViews
    ? Math.min(20, Math.round(Math.min(ch.avgRecentViews / avgTopViews, 2) * 10))
    : 0;

  // 0-20: upload frequency (more consistent = higher score, cap at 8/mo)
  const freqScore = ch.uploadsPerMonth
    ? Math.min(20, Math.round(Math.min(ch.uploadsPerMonth / 8, 1) * 20))
    : 0;

  const breakdown = {
    relevance,
    subscriberSize: subScore,
    recentPerformance: recentPerf,
    avgViews: avgViewsScore,
    consistency: freqScore,
  };

  return {
    ...ch,
    performanceScore: relevance + subScore + recentPerf + avgViewsScore + freqScore,
    performanceBreakdown: breakdown,
  };
}

/* ─── Main handler ────────────────────────────────────────────────────────── */

export async function GET(request: NextRequest) {
  const url   = new URL(request.url);
  const topic = url.searchParams.get('topic');
  const maxResults = Math.min(parseInt(url.searchParams.get('maxResults') || '25'), 50);

  if (!topic || !isVerifiedSearchTerm(topic)) {
    return NextResponse.json(
      { success: false, error: 'topic query param is required' } as ApiResponse<null>,
      { status: 400 },
    );
  }
  const q = sanitizeSearchText(topic);

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'YOUTUBE_API_KEY not configured — add it to .env.local' } as ApiResponse<null>,
      { status: 503 },
    );
  }

  try {
    /* ── 1. Search videos ─────────────────────────────────────────────────── */
    const searchData = await ytFetch('search', {
      part: 'snippet',
      q: q,
      type: 'video',
      maxResults: String(maxResults),
      order: 'relevance',
      videoDuration: 'medium', // filter out very short clips
    }, apiKey);

    const rawItems: Array<{
      id: { videoId: string };
      snippet: {
        title: string;
        channelId: string;
        channelTitle: string;
        publishedAt: string;
        description: string;
        thumbnails: { medium?: { url: string }; default?: { url: string } };
      };
    }> = searchData.items || [];

    if (!rawItems.length) {
      return NextResponse.json({
        success: true,
        data: emptyResult(q),
      });
    }

    /* ── 2. Fetch video statistics + details ──────────────────────────────── */
    const videoIds = rawItems.map(i => i.id.videoId).join(',');
    const statsData = await ytFetch('videos', {
      part: 'statistics,contentDetails',
      id: videoIds,
    }, apiKey);

    const statsMap: Record<string, {
      viewCount?: number; likeCount?: number; commentCount?: number;
      durationSeconds: number; durationHuman: string;
    }> = {};

    for (const v of (statsData.items || []) as Array<{
      id: string;
      statistics: { viewCount?: string; likeCount?: string; commentCount?: string };
      contentDetails: { duration?: string };
    }>) {
      const secs = iso8601ToSeconds(v.contentDetails.duration || '');
      statsMap[v.id] = {
        viewCount:    v.statistics.viewCount    ? parseInt(v.statistics.viewCount)    : undefined,
        likeCount:    v.statistics.likeCount    ? parseInt(v.statistics.likeCount)    : undefined,
        commentCount: v.statistics.commentCount ? parseInt(v.statistics.commentCount) : undefined,
        durationSeconds: secs,
        durationHuman:   secondsToHuman(secs),
      };
    }

    /* ── 3. Build video list ──────────────────────────────────────────────── */
    const videos: YouTubeVideoData[] = rawItems.map(item => ({
      videoId:       item.id.videoId,
      title:         item.snippet.title,
      channelId:     item.snippet.channelId,
      channelTitle:  item.snippet.channelTitle,
      publishedAt:   item.snippet.publishedAt,
      description:   item.snippet.description?.slice(0, 300),
      thumbnail:     item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
      viewCount:     statsMap[item.id.videoId]?.viewCount,
      likeCount:     statsMap[item.id.videoId]?.likeCount,
      commentCount:  statsMap[item.id.videoId]?.commentCount,
      duration:      statsMap[item.id.videoId]?.durationHuman,
      durationSeconds: statsMap[item.id.videoId]?.durationSeconds,
      ageDays:       ageDays(item.snippet.publishedAt),
    }));

    /* ── 4. Fetch channel data ─────────────────────────────────────────────── */
    const uniqueChannelIds = [...new Set(rawItems.map(i => i.snippet.channelId))];
    const channelData = await ytFetch('channels', {
      part: 'snippet,statistics,contentDetails',
      id: uniqueChannelIds.join(','),
      maxResults: '50',
    }, apiKey);

    /* ── 5. Build channel objects ─────────────────────────────────────────── */
    const channelMap: Record<string, Omit<ChannelData, 'performanceScore' | 'performanceBreakdown'>> = {};

    for (const ch of (channelData.items || []) as Array<{
      id: string;
      snippet: { title: string; description?: string; publishedAt?: string; thumbnails?: { default?: { url: string }; medium?: { url: string } } };
      statistics: { subscriberCount?: string; viewCount?: string; videoCount?: string };
    }>) {
      const nicheVids = videos.filter(v => v.channelId === ch.id);
      const viewsArr  = nicheVids.map(v => v.viewCount || 0);
      const avgRecent = viewsArr.length ? Math.round(viewsArr.reduce((s, v) => s + v, 0) / viewsArr.length) : 0;

      // Estimate uploads per month — we don't have upload timestamps here,
      // so we calculate from (videoCount / channel age in months) as a proxy
      const chAgeMonths = ch.snippet.publishedAt
        ? Math.max(1, (Date.now() - new Date(ch.snippet.publishedAt).getTime()) / (1000 * 60 * 60 * 24 * 30))
        : 24;
      const totalVids    = parseInt(ch.statistics.videoCount || '0');
      const uploadsPerMo = totalVids > 0 ? Math.round((totalVids / chAgeMonths) * 10) / 10 : 0;

      channelMap[ch.id] = {
        channelId:       ch.id,
        title:           ch.snippet.title,
        description:     ch.snippet.description?.slice(0, 300),
        thumbnail:       ch.snippet.thumbnails?.medium?.url || ch.snippet.thumbnails?.default?.url,
        publishedAt:     ch.snippet.publishedAt,
        subscriberCount: ch.statistics.subscriberCount ? parseInt(ch.statistics.subscriberCount) : undefined,
        totalViewCount:  ch.statistics.viewCount       ? parseInt(ch.statistics.viewCount)       : undefined,
        videoCount:      totalVids,
        avgRecentViews:  avgRecent,
        uploadsPerMonth: uploadsPerMo,
        nicheVideos:     nicheVids,
      };
    }

    /* ── 6. Score and sort channels ───────────────────────────────────────── */
    const rawChannels = Object.values(channelMap);
    const channels: ChannelData[] = rawChannels.map(ch => scoreChannel(ch, rawChannels));
    const channelLeaderboard = [...channels].sort((a, b) => b.performanceScore - a.performanceScore);

    /* ── 7. No title→keyword conversion, no AI opportunities ─────────────── */
    const keywordIntelligence: KeywordIntelligence[] = [];
    const titlePatterns: TitlePattern[] = [];
    const commonThemes: string[] = [];
    const contentGaps: ContentGap[] = [];
    const videoOpportunities: VideoOpportunity[] = [];
    const patterns: ResearchResult['patterns'] = [];

    const result: ResearchResult = {
      topic: q,
      videoCount:          videos.length,
      channelCount:        channels.length,
      videos,
      channels,
      channelLeaderboard,
      keywordIntelligence,
      titlePatterns,
      commonThemes,
      contentGaps,
      videoOpportunities,
      patterns,
      searchedAt: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, data: result } as ApiResponse<ResearchResult>);

  } catch (error) {
    console.error('[research/youtube]', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'YouTube research failed' } as ApiResponse<null>,
      { status: 500 },
    );
  }
}

function emptyResult(topic: string): ResearchResult {
  return {
    topic, videoCount: 0, channelCount: 0,
    videos: [], channels: [], channelLeaderboard: [],
    keywordIntelligence: [], titlePatterns: [], commonThemes: [],
    contentGaps: [], videoOpportunities: [], patterns: [],
    searchedAt: new Date().toISOString(),
  };
}
