/**
 * Competitor Discovery Service
 *
 * Finds 10 competitor channels in the user's niche via YouTube search.
 * Fetches their metrics:
 * - Subscriber count
 * - Total views
 * - Video count
 * - Engagement rate (from top videos)
 * - Upload frequency
 *
 * Uses YouTube Data API v3.
 */

import { ChannelVideo } from '@/app/providers/channel-provider';

export interface CompetitorChannel {
  youtubeChannelId: string;
  title: string;
  handle: string;
  description: string;
  profileImageUrl: string;
  categoryTag?: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
  avgEngagementRate: number;
  avgViewsPerVideo: number;
  uploadFrequency: number; // videos per month
}

// ─── Search for competitor channels ──────────────────────────────────────────

export async function discoverCompetitorChannels(
  searchQuery: string,
  maxResults: number = 10,
): Promise<CompetitorChannel[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY not configured');
  }

  const competitors: CompetitorChannel[] = [];
  const channelIds = new Set<string>();

  try {
    // 1. Search for channels
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    searchUrl.searchParams.append('part', 'snippet');
    searchUrl.searchParams.append('q', searchQuery);
    searchUrl.searchParams.append('type', 'channel');
    searchUrl.searchParams.append('maxResults', Math.min(maxResults * 2, 50).toString()); // Fetch more to filter out small channels
    searchUrl.searchParams.append('order', 'relevance');
    searchUrl.searchParams.append('key', apiKey);

    const searchRes = await fetch(searchUrl.toString());
    if (!searchRes.ok) {
      console.error('[competitor-discovery] Search failed:', await searchRes.text());
      return [];
    }

    const searchData = await searchRes.json() as any;
    const channelSnippets = searchData.items?.filter((item: any) => item.id?.channelId) || [];

    if (channelSnippets.length === 0) {
      return [];
    }

    // Extract channel IDs
    for (const snippet of channelSnippets) {
      channelIds.add(snippet.id.channelId);
      if (channelIds.size >= maxResults * 1.5) break; // Get more than needed to filter
    }

    // 2. Fetch detailed channel stats
    const channelIdList = Array.from(channelIds);
    const detailedChannels = await getChannelDetails(channelIdList, apiKey);

    // 3. Filter out very small channels (< 1000 subscribers) and sort by subscriber count
    const filtered = detailedChannels
      .filter((ch) => ch.subscriberCount >= 1000) // Only channels with 1K+ subs
      .sort((a, b) => b.subscriberCount - a.subscriberCount)
      .slice(0, maxResults);

    return filtered;
  } catch (error) {
    console.error('[competitor-discovery] Discovery failed:', error);
    return [];
  }
}

// ─── Get detailed channel information ────────────────────────────────────────

async function getChannelDetails(
  channelIds: string[],
  apiKey: string,
): Promise<CompetitorChannel[]> {
  if (channelIds.length === 0) return [];

  const channels: CompetitorChannel[] = [];

  try {
    // Fetch channels in batches (API limit is 50 per request)
    for (let i = 0; i < channelIds.length; i += 50) {
      const batch = channelIds.slice(i, i + 50);
      const url = new URL('https://www.googleapis.com/youtube/v3/channels');
      url.searchParams.append('part', 'snippet,statistics,contentDetails');
      url.searchParams.append('id', batch.join(','));
      url.searchParams.append('key', apiKey);

      const res = await fetch(url.toString());
      if (!res.ok) {
        console.error('[competitor-discovery] Channel details fetch failed:', await res.text());
        continue;
      }

      const data = await res.json() as any;
      const items = data.items || [];

      for (const channel of items) {
        const channelId = channel.id;
        const snippet = channel.snippet || {};
        const stats = channel.statistics || {};

        // Parse subscriber count (may be hidden as "0" or a string like "1000000+")
        let subscriberCount = 0;
        const subStr = stats.subscriberCount;
        if (typeof subStr === 'string' && subStr !== '0') {
          subscriberCount = parseInt(subStr, 10) || 0;
        } else if (typeof subStr === 'number') {
          subscriberCount = subStr;
        }

        // Get engagement rate and upload frequency from top videos
        const { engagementRate, avgViewsPerVideo, uploadFrequency } = await getChannelEngagementMetrics(
          channelId,
          apiKey,
        );

        channels.push({
          youtubeChannelId: channelId,
          title: snippet.title || 'Unknown',
          handle: snippet.customUrl || snippet.title || '',
          description: snippet.description || '',
          profileImageUrl: snippet.thumbnails?.default?.url || '',
          categoryTag: channel.contentDetails?.topicCategories?.[0],
          subscriberCount,
          videoCount: parseInt(stats.videoCount || '0', 10),
          viewCount: parseInt(stats.viewCount || '0', 10),
          avgEngagementRate: engagementRate,
          avgViewsPerVideo,
          uploadFrequency,
        });
      }
    }

    return channels;
  } catch (error) {
    console.error('[competitor-discovery] Channel details error:', error);
    return channels;
  }
}

// ─── Get engagement metrics from top videos ──────────────────────────────────

async function getChannelEngagementMetrics(
  channelId: string,
  apiKey: string,
): Promise<{
  engagementRate: number;
  avgViewsPerVideo: number;
  uploadFrequency: number;
}> {
  try {
    // Search for recent videos from this channel
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    searchUrl.searchParams.append('part', 'snippet');
    searchUrl.searchParams.append('channelId', channelId);
    searchUrl.searchParams.append('type', 'video');
    searchUrl.searchParams.append('maxResults', '50'); // Get more to calculate frequency
    searchUrl.searchParams.append('order', 'date');
    searchUrl.searchParams.append('key', apiKey);

    const searchRes = await fetch(searchUrl.toString());
    if (!searchRes.ok) return { engagementRate: 0, avgViewsPerVideo: 0, uploadFrequency: 0 };

    const searchData = await searchRes.json() as any;
    const videos = searchData.items || [];

    if (videos.length === 0) {
      return { engagementRate: 0, avgViewsPerVideo: 0, uploadFrequency: 0 };
    }

    // Get top 10 videos for engagement calculation
    const videoIds = videos
      .slice(0, 10)
      .map((v: any) => v.id.videoId)
      .filter((id: string) => id);

    if (videoIds.length === 0) {
      return { engagementRate: 0, avgViewsPerVideo: 0, uploadFrequency: 0 };
    }

    // Fetch video statistics (views, likes, comments)
    const statsUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
    statsUrl.searchParams.append('part', 'statistics');
    statsUrl.searchParams.append('id', videoIds.join(','));
    statsUrl.searchParams.append('key', apiKey);

    const statsRes = await fetch(statsUrl.toString());
    if (!statsRes.ok) return { engagementRate: 0, avgViewsPerVideo: 0, uploadFrequency: 0 };

    const statsData = await statsRes.json() as any;
    const videoStats = statsData.items || [];

    // Calculate engagement rate and average views
    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;

    for (const video of videoStats) {
      const stats = video.statistics || {};
      const views = parseInt(stats.viewCount || '0', 10);
      const likes = parseInt(stats.likeCount || '0', 10);
      const comments = parseInt(stats.commentCount || '0', 10);

      totalViews += views;
      totalLikes += likes;
      totalComments += comments;
    }

    const avgViewsPerVideo = videoStats.length > 0 ? totalViews / videoStats.length : 0;
    const avgEngagementRate =
      totalViews > 0 ? ((totalLikes + totalComments) / totalViews) * 100 : 0;

    // Calculate upload frequency (videos per month from the 50 most recent)
    const uploadFrequency = calculateUploadFrequency(videos);

    return {
      engagementRate: avgEngagementRate,
      avgViewsPerVideo,
      uploadFrequency,
    };
  } catch (error) {
    console.error('[competitor-discovery] Engagement metrics error:', error);
    return { engagementRate: 0, avgViewsPerVideo: 0, uploadFrequency: 0 };
  }
}

// ─── Calculate upload frequency from video publication dates ─────────────────

function calculateUploadFrequency(videos: any[]): number {
  if (videos.length < 2) return 0;

  const publishedDates = videos
    .map((v: any) => new Date(v.snippet?.publishedAt))
    .filter((d: Date) => !isNaN(d.getTime()));

  if (publishedDates.length < 2) return 0;

  const newest = Math.max(...publishedDates.map((d: Date) => d.getTime()));
  const oldest = Math.min(...publishedDates.map((d: Date) => d.getTime()));
  const daysDiff = (newest - oldest) / (1000 * 60 * 60 * 24);
  const monthsDiff = daysDiff / 30;

  if (monthsDiff <= 0) return 0;

  return videos.length / monthsDiff;
}
