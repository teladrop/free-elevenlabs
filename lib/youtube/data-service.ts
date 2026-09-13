/**
 * YouTube Data Service
 * 
 * Enhanced YouTube API integration with:
 * - Intelligent batching
 * - Quota-aware caching
 * - Error handling
 * - Rate limiting
 * 
 * Wraps lib/youtube/api.ts with caching and batch optimization
 */

import type { YouTubeVideo, YouTubeChannel, YouTubeSearchResult } from '@/lib/types/research';
import { API_LIMITS, CACHE_CONFIG } from '@/lib/config/research';
import { normalizeQuery, generateSemanticVariations, isValidQuery } from './normalizer';
import { getSearchCache, setSearchCache } from '@/lib/db/data-cache';
import { trackYouTubeRequest } from '@/lib/db/quota-tracker';
import { enqueueSearchRefresh } from '@/lib/db/refresh-queue';
import { isFeatureEnabled } from '@/lib/config/feature-flags';

// Simple in-memory cache (could be replaced with Redis)
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<any>>();

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

/**
 * Get cached data if valid
 */
function getCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  
  const now = Date.now();
  if (now > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  
  return entry.data;
}

/**
 * Set cache data with TTL
 */
function setCache<T>(key: string, data: T, ttlSeconds: number): void {
  const now = Date.now();
  cache.set(key, {
    data,
    timestamp: now,
    expiresAt: now + (ttlSeconds * 1000),
  });
}

/**
 * Generate cache key
 */
function getCacheKey(type: string, ...args: any[]): string {
  return `${type}:${args.join(':')}`;
}

/**
 * Clear expired cache entries
 */
function cleanupCache(): void {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now > entry.expiresAt) {
      cache.delete(key);
    }
  }
}

// Cleanup cache every 10 minutes
setInterval(cleanupCache, 10 * 60 * 1000);

// ============================================================================
// YOUTUBE API WRAPPER
// ============================================================================

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

/**
 * Make YouTube API request with error handling
 */
async function youtubeRequest(endpoint: string, params: Record<string, string>): Promise<any> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YouTube API key not configured');
  }
  
  const urlParams = new URLSearchParams({ ...params, key: apiKey });
  const url = `${YOUTUBE_API_BASE}/${endpoint}?${urlParams}`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('YouTube API quota exceeded. Quota resets at midnight Pacific Time.');
      }
      
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || response.statusText;
      throw new Error(`YouTube API error (${response.status}): ${errorMessage}`);
    }
    
    return await response.json();
  } catch (error: any) {
    // Add context to error
    throw new Error(`YouTube API request failed: ${error.message}`);
  }
}

// ============================================================================
// VIDEO FETCHING
// ============================================================================

/**
 * Search videos with caching
 */
export async function searchVideos(
  query: string,
  maxResults: number = API_LIMITS.defaultVideoLimit,
  useCache: boolean = true
): Promise<YouTubeVideo[]> {
  // Validate query
  if (!isValidQuery(query)) {
    throw new Error('Invalid search query');
  }
  
  const normalized = normalizeQuery(query);
  const cacheKey = getCacheKey('search:videos', normalized, maxResults);
  
  // Check cache
  if (useCache) {
    const cached = getCache<YouTubeVideo[]>(cacheKey);
    if (cached) {
      console.log(`[YouTube] Cache hit: videos for "${normalized}"`);
      return cached;
    }
  }
  
  console.log(`[YouTube] Searching videos: "${normalized}" (max: ${maxResults})`);
  
  // Search for videos
  const searchData = await youtubeRequest('search', {
    part: 'snippet',
    q: normalized,
    type: 'video',
    maxResults: Math.min(maxResults, API_LIMITS.maxVideosPerSearch).toString(),
    order: 'relevance',
  });
  
  if (!searchData.items || searchData.items.length === 0) {
    return [];
  }
  
  // Extract video IDs
  const videoIds = searchData.items.map((item: any) => item.id.videoId);
  
  // Get detailed video data in batches
  const videos = await batchFetchVideos(videoIds);
  
  // Cache results
  setCache(cacheKey, videos, CACHE_CONFIG.searchResultsTTL);
  
  return videos;
}

/**
 * Fetch video details by IDs with batching
 */
export async function batchFetchVideos(videoIds: string[]): Promise<YouTubeVideo[]> {
  if (videoIds.length === 0) return [];
  
  const retrievedAt = new Date().toISOString();
  const allVideos: YouTubeVideo[] = [];
  
  // Check cache for individual videos
  const uncachedIds: string[] = [];
  const cachedVideos: YouTubeVideo[] = [];
  
  for (const id of videoIds) {
    const cacheKey = getCacheKey('video', id);
    const cached = getCache<YouTubeVideo>(cacheKey);
    if (cached) {
      cachedVideos.push(cached);
    } else {
      uncachedIds.push(id);
    }
  }
  
  console.log(`[YouTube] Videos: ${cachedVideos.length} cached, ${uncachedIds.length} to fetch`);
  
  // Fetch uncached videos in batches
  const batchSize = API_LIMITS.batchSize;
  for (let i = 0; i < uncachedIds.length; i += batchSize) {
    const batch = uncachedIds.slice(i, i + batchSize);
    const batchIds = batch.join(',');
    
    const data = await youtubeRequest('videos', {
      part: 'snippet,statistics,contentDetails',
      id: batchIds,
    });
    
    if (data.items) {
      for (const item of data.items) {
        const video: YouTubeVideo = {
          videoId: item.id,
          title: item.snippet.title,
          channelId: item.snippet.channelId,
          channelTitle: item.snippet.channelTitle,
          publishedAt: item.snippet.publishedAt,
          description: item.snippet.description || '',
          thumbnails: item.snippet.thumbnails,
          statistics: {
            viewCount: item.statistics?.viewCount || '0',
            likeCount: item.statistics?.likeCount,
            commentCount: item.statistics?.commentCount,
          },
          contentDetails: {
            duration: item.contentDetails.duration,
          },
          source: 'youtube-data',
          retrievedAt,
        };
        
        allVideos.push(video);
        
        // Cache individual video
        const cacheKey = getCacheKey('video', video.videoId);
        setCache(cacheKey, video, CACHE_CONFIG.videoMetadataTTL);
      }
    }
  }
  
  // Combine cached and fetched
  return [...cachedVideos, ...allVideos];
}

// ============================================================================
// CHANNEL FETCHING
// ============================================================================

/**
 * Search for channels with caching.
 * Fetches up to maxResults by running multiple query variations in parallel
 * and deduplicating — YouTube caps each search at 50, so we spread across
 * semantic variations to reach the 100-channel target.
 */
export async function searchChannels(
  query: string,
  maxResults: number = API_LIMITS.defaultChannelLimit,
  useCache: boolean = true
): Promise<YouTubeChannel[]> {
  if (!isValidQuery(query)) throw new Error('Invalid search query');

  const normalized = normalizeQuery(query);
  const cacheKey   = getCacheKey('search:channels', normalized, maxResults);

  if (useCache) {
    const cached = getCache<YouTubeChannel[]>(cacheKey);
    if (cached) {
      console.log(`[YouTube] Cache hit: channels for "${normalized}"`);
      return cached;
    }
  }

  console.log(`[YouTube] Searching channels: "${normalized}" (target: ${maxResults})`);

  const seenIds = new Set<string>();
  const channelIds: string[] = [];
  let pageToken = '';

  // Fetch up to 2× the target so the subscriber filter has room to work
  const fetchTarget = Math.min(maxResults * 2, 100);

  while (channelIds.length < fetchTarget) {
    const remaining = Math.min(50, fetchTarget - channelIds.length);
    const params: Record<string, string> = {
      part: 'snippet',
      q: normalized,
      type: 'channel',
      maxResults: remaining.toString(),
      order: 'relevance',
    };
    if (pageToken) params.pageToken = pageToken;

    const data = await youtubeRequest('search', params).catch(() => ({ items: [] as any[], nextPageToken: undefined }));
    for (const item of (data.items || [])) {
      const id = item.id?.channelId;
      if (id && !seenIds.has(id)) {
        seenIds.add(id);
        channelIds.push(id);
        if (channelIds.length >= maxResults) break;
      }
    }
    pageToken = data.nextPageToken || '';
    if (!pageToken || !(data.items || []).length) break;
  }

  if (channelIds.length === 0) return [];

  const channels = await batchFetchChannels(channelIds);

  // Filter to channels with at least 1,000 subscribers — removes micro/spam channels
  const filtered = channels.filter(ch => {
    const subs = parseInt(ch.statistics.subscriberCount || '0', 10);
    return ch.statistics.hiddenSubscriberCount || subs >= 1000;
  });
  console.log(
    `[YouTube] Channel filter: ${channels.length} fetched → ${filtered.length} with ≥1K subs`,
  );

  setCache(cacheKey, filtered, CACHE_CONFIG.searchResultsTTL);

  console.log(`[YouTube] Fetched ${filtered.length} unique channels for "${normalized}"`);
  return filtered;
}

/**
 * Fetch channel details by IDs with batching
 */
export async function batchFetchChannels(channelIds: string[]): Promise<YouTubeChannel[]> {
  if (channelIds.length === 0) return [];
  
  const retrievedAt = new Date().toISOString();
  const allChannels: YouTubeChannel[] = [];
  
  // Check cache for individual channels
  const uncachedIds: string[] = [];
  const cachedChannels: YouTubeChannel[] = [];
  
  for (const id of channelIds) {
    const cacheKey = getCacheKey('channel', id);
    const cached = getCache<YouTubeChannel>(cacheKey);
    if (cached) {
      cachedChannels.push(cached);
    } else {
      uncachedIds.push(id);
    }
  }
  
  console.log(`[YouTube] Channels: ${cachedChannels.length} cached, ${uncachedIds.length} to fetch`);
  
  // Fetch uncached channels in batches
  const batchSize = API_LIMITS.batchSize;
  for (let i = 0; i < uncachedIds.length; i += batchSize) {
    const batch = uncachedIds.slice(i, i + batchSize);
    const batchIds = batch.join(',');
    
    const data = await youtubeRequest('channels', {
      part: 'snippet,statistics',
      id: batchIds,
    });
    
    if (data.items) {
      for (const item of data.items) {
        const channel: YouTubeChannel = {
          channelId: item.id,
          title: item.snippet.title,
          description: item.snippet.description || '',
          customUrl: item.snippet.customUrl,
          thumbnails: item.snippet.thumbnails,
          statistics: {
            viewCount: item.statistics.viewCount || '0',
            subscriberCount: item.statistics.subscriberCount || '0',
            hiddenSubscriberCount: item.statistics.hiddenSubscriberCount || false,
            videoCount: item.statistics.videoCount || '0',
          },
          publishedAt: item.snippet.publishedAt,
          source: 'youtube-data',
          retrievedAt,
        };
        
        allChannels.push(channel);
        
        // Cache individual channel
        const cacheKey = getCacheKey('channel', channel.channelId);
        setCache(cacheKey, channel, CACHE_CONFIG.channelMetadataTTL);
      }
    }
  }
  
  // Combine cached and fetched
  return [...cachedChannels, ...allChannels];
}

// ============================================================================
// COMPREHENSIVE SEARCH
// ============================================================================

/**
 * Search for videos and channels simultaneously.
 *
 * Request flow (additive — existing paths unchanged):
 *   1. Supabase cache (new, feature-flagged)  → return fresh/stale data
 *   2. In-memory cache (existing)             → return cached data
 *   3. YouTube API (existing)                 → fetch, store in both caches
 */
export async function comprehensiveSearch(
  query: string,
  videoLimit?: number,
  channelLimit?: number,
  useCache: boolean = true
): Promise<YouTubeSearchResult> {
  const normalized    = normalizeQuery(query);
  const vLimit        = videoLimit   ?? API_LIMITS.defaultVideoLimit;
  const cLimit        = channelLimit ?? API_LIMITS.defaultChannelLimit;
  const cacheKey      = getCacheKey('search:comprehensive', normalized, videoLimit, channelLimit);

  // ── NEW: Supabase cache check ──────────────────────────────────────────────
  if (useCache && isFeatureEnabled('ENABLE_YOUTUBE_DATA_LAYER')) {
    try {
      const cached = await getSearchCache(normalized, vLimit, cLimit);

      if (cached.status === 'fresh' && cached.data) {
        // Populate in-memory cache too so subsequent calls in this process are instant
        setCache(cacheKey, cached.data, CACHE_CONFIG.searchResultsTTL);
        return cached.data;
      }

      if (cached.status === 'stale' && cached.data) {
        // Stale-while-revalidate: return stale data immediately, queue background refresh
        if (isFeatureEnabled('ENABLE_STALE_WHILE_REVALIDATE') && cached.shouldRefresh) {
          const hitCount = cached.data.videos.length; // rough proxy; actual hit_count tracked in DB
          enqueueSearchRefresh(normalized, hitCount).catch(() => {/* non-fatal */});
        }
        setCache(cacheKey, cached.data, CACHE_CONFIG.searchResultsTTL);
        return cached.data;
      }
    } catch (err: any) {
      // Supabase error — fall through to existing behavior
      console.warn('[YouTube] Supabase cache check failed (falling back):', err.message);
    }
  }
  // ── END new block ──────────────────────────────────────────────────────────

  // Check in-memory cache (existing behavior)
  if (useCache) {
    const cached = getCache<YouTubeSearchResult>(cacheKey);
    if (cached) {
      console.log(`[YouTube] Cache hit: comprehensive search for "${normalized}"`);
      return cached;
    }
  }

  console.log(`[YouTube] Comprehensive search: "${normalized}"`);

  // Search videos and channels in parallel (existing behavior)
  const [videos, channels] = await Promise.all([
    searchVideos(normalized, videoLimit, useCache),
    searchChannels(normalized, channelLimit, useCache),
  ]);

  const result: YouTubeSearchResult = {
    query: normalized,
    videos,
    channels,
    totalResults: videos.length + channels.length,
    retrievedAt: new Date().toISOString(),
    source: 'youtube-data',
  };

  // Cache in memory (existing behavior)
  setCache(cacheKey, result, CACHE_CONFIG.searchResultsTTL);

  // ── NEW: persist to Supabase + track quota (fire-and-forget) ──────────────
  if (isFeatureEnabled('ENABLE_YOUTUBE_DATA_LAYER')) {
    setSearchCache(normalized, vLimit, cLimit, result).catch(() => {/* non-fatal */});
    // Each comprehensive search costs ~100 (search.list) + batch video/channel units
    trackYouTubeRequest('search.list', true, 100).catch(() => {/* non-fatal */});
  }
  // ── END new block ──────────────────────────────────────────────────────────

  return result;
}

/**
 * Multi-query search (semantic variations)
 * Searches multiple related queries and deduplicates results
 */
export async function expandedSearch(
  query: string,
  videosPerQuery: number = 10,
  useCache: boolean = true
): Promise<YouTubeSearchResult> {
  const variations = generateSemanticVariations(query);
  console.log(`[YouTube] Expanded search with ${variations.length} variations`);
  
  // Search all variations in parallel
  const results = await Promise.all(
    variations.map(q => comprehensiveSearch(q, videosPerQuery, 0, useCache))
  );
  
  // Deduplicate videos by ID
  const videoMap = new Map<string, YouTubeVideo>();
  for (const result of results) {
    for (const video of result.videos) {
      if (!videoMap.has(video.videoId)) {
        videoMap.set(video.videoId, video);
      }
    }
  }
  
  // Deduplicate channels by ID
  const channelMap = new Map<string, YouTubeChannel>();
  for (const result of results) {
    for (const channel of result.channels) {
      if (!channelMap.has(channel.channelId)) {
        channelMap.set(channel.channelId, channel);
      }
    }
  }
  
  const deduplicatedVideos = Array.from(videoMap.values());
  const deduplicatedChannels = Array.from(channelMap.values());
  
  console.log(`[YouTube] Expanded search found ${deduplicatedVideos.length} unique videos`);
  
  return {
    query: normalizeQuery(query),
    videos: deduplicatedVideos,
    channels: deduplicatedChannels,
    totalResults: deduplicatedVideos.length + deduplicatedChannels.length,
    retrievedAt: new Date().toISOString(),
    source: 'youtube-data',
  };
}

// ============================================================================
// CACHE UTILITIES
// ============================================================================

/**
 * Clear cache for a specific query
 */
export function clearQueryCache(query: string): void {
  const normalized = normalizeQuery(query);
  const patterns = [
    getCacheKey('search:videos', normalized),
    getCacheKey('search:channels', normalized),
    getCacheKey('search:comprehensive', normalized),
  ];
  
  for (const pattern of patterns) {
    for (const key of cache.keys()) {
      if (key.startsWith(pattern)) {
        cache.delete(key);
      }
    }
  }
  
  console.log(`[YouTube] Cleared cache for query: "${normalized}"`);
}

/**
 * Clear all cache
 */
export function clearAllCache(): void {
  cache.clear();
  console.log('[YouTube] Cleared all cache');
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  size: number;
  entries: Array<{ key: string; age: number; ttl: number }>;
} {
  const now = Date.now();
  const entries = Array.from(cache.entries()).map(([key, entry]) => ({
    key,
    age: Math.round((now - entry.timestamp) / 1000),
    ttl: Math.round((entry.expiresAt - now) / 1000),
  }));
  
  return {
    size: cache.size,
    entries,
  };
}
