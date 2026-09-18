/**
 * YouTube Data Intelligence Cache
 *
 * Provides Supabase-backed caching for YouTube search results.
 * This is ADDITIVE — every function falls back to null/false when:
 *   - ENABLE_YOUTUBE_DATA_LAYER=false
 *   - Supabase is unavailable
 *   - Any DB error occurs
 *
 * The existing in-memory cache in lib/youtube/data-service.ts is untouched.
 * This layer sits above it:
 *
 *   Request
 *     → Supabase cache (this file)         ← new
 *       → in-memory cache (data-service)   ← existing, unchanged
 *         → YouTube API                    ← existing, unchanged
 *
 * Tables used (created in migration 001_data_cache.sql):
 *   youtube_search_cache
 *   youtube_videos
 *   youtube_channels
 */

import crypto from 'crypto';
import { getCacheClient } from './cache-client';
import { isFeatureEnabled } from '@/lib/config/feature-flags';
import type { YouTubeVideo, YouTubeChannel, YouTubeSearchResult } from '@/lib/types/research';

// ─── TTL configuration (seconds) ─────────────────────────────────────────────
// All overridable via env vars so nothing is hard-coded in logic.

function ttlSeconds(envKey: string, defaultSec: number): number {
  const v = process.env[envKey];
  if (!v) return defaultSec;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : defaultSec;
}

export const CACHE_TTL = {
  /** Fresh search results — 24 h default (search.list is 100 units) */
  searchResult:  () => ttlSeconds('CACHE_TTL_SEARCH_RESULT_S',  24 * 3600),
  /** Individual video metadata — 24 h default */
  videoMeta:     () => ttlSeconds('CACHE_TTL_VIDEO_META_S',     24 * 3600),
  /** Channel metadata — 48 h default */
  channelMeta:   () => ttlSeconds('CACHE_TTL_CHANNEL_META_S',  48 * 3600),
  /**
   * Stale-while-revalidate grace window.
   * Serve cached search for this long after expiry instead of another search.list.
   * Default 24 h.
   */
  staleGrace:    () => ttlSeconds('CACHE_TTL_STALE_GRACE_S',    24 * 3600),
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** SHA-256 of the canonical query string — stable, deterministic */
export function queryHash(normalizedQuery: string): string {
  return crypto.createHash('sha256').update(normalizedQuery.toLowerCase().trim()).digest('hex');
}

function nowIso(): string {
  return new Date().toISOString();
}

function futureIso(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

/** True when data is fresh (not yet past expires_at) */
function isFresh(expiresAt: string): boolean {
  return Date.now() < new Date(expiresAt).getTime();
}

/**
 * True when data is within the stale-while-revalidate grace window.
 * The caller should serve the stale data AND queue a background refresh.
 */
function isStaleButUsable(expiresAt: string): boolean {
  const expMs    = new Date(expiresAt).getTime();
  const graceMs  = CACHE_TTL.staleGrace() * 1000;
  return Date.now() < expMs + graceMs;
}

// ─── Cache result shape ───────────────────────────────────────────────────────

export type CacheStatus = 'fresh' | 'stale' | 'miss';

export interface CachedSearchResult {
  status:        CacheStatus;
  data:          YouTubeSearchResult | null;
  /** True when stale data was returned and a background refresh is advisable */
  shouldRefresh: boolean;
}

// ─── Search cache ─────────────────────────────────────────────────────────────

/**
 * Look up a comprehensive search result in Supabase.
 * Returns { status: 'miss', data: null } when the layer is disabled or on
 * any error — the caller falls through to the existing YouTube path.
 */
export async function getSearchCache(
  normalizedQuery: string,
  videoLimit: number,
  channelLimit: number,
): Promise<CachedSearchResult> {
  if (!isFeatureEnabled('ENABLE_YOUTUBE_DATA_LAYER')) {
    return { status: 'miss', data: null, shouldRefresh: false };
  }

  const db = getCacheClient();
  if (!db) return { status: 'miss', data: null, shouldRefresh: false };

  try {
    // One cache row per query — do not fragment by video/channel limits (same 100-unit search)
    const hash = queryHash(normalizedQuery);

    const { data: row, error } = await db
      .from('youtube_search_cache')
      .select('result_payload, expires_at, hit_count')
      .eq('query_hash', hash)
      .eq('status', 'active')
      .maybeSingle();

    if (error || !row) {
      return { status: 'miss', data: null, shouldRefresh: false };
    }

    // Bump hit counter asynchronously — don't await
    db.from('youtube_search_cache')
      .update({ hit_count: (row.hit_count ?? 0) + 1, last_used_at: nowIso() })
      .eq('query_hash', hash)
      .then(() => {/* fire and forget */});

    const payload = row.result_payload as YouTubeSearchResult;

    if (isFresh(row.expires_at)) {
      console.log(`[DataCache] FRESH hit for "${normalizedQuery}"`);
      return { status: 'fresh', data: payload, shouldRefresh: false };
    }

    if (isStaleButUsable(row.expires_at)) {
      console.log(`[DataCache] STALE hit (grace window) for "${normalizedQuery}" — queuing refresh`);
      return { status: 'stale', data: payload, shouldRefresh: true };
    }

    return { status: 'miss', data: null, shouldRefresh: false };
  } catch (err: any) {
    console.warn('[DataCache] getSearchCache error (falling back):', err.message);
    return { status: 'miss', data: null, shouldRefresh: false };
  }
}

/**
 * Persist a comprehensive search result to Supabase.
 * Upserts so repeated searches overwrite stale data.
 * Also upserts individual video + channel rows for reuse across queries.
 * Never throws — all errors are logged and swallowed.
 */
export async function setSearchCache(
  normalizedQuery: string,
  videoLimit: number,
  channelLimit: number,
  result: YouTubeSearchResult,
): Promise<void> {
  if (!isFeatureEnabled('ENABLE_YOUTUBE_DATA_LAYER')) return;

  const db = getCacheClient();
  if (!db) return;

  try {
    // One cache row per query — do not fragment by video/channel limits (same 100-unit search)
    const hash = queryHash(normalizedQuery);
    const now  = nowIso();
    const exp  = futureIso(CACHE_TTL.searchResult());

    // 1. Upsert the search cache row
    const { error: cacheErr } = await db
      .from('youtube_search_cache')
      .upsert({
        normalized_query: normalizedQuery,
        query_hash:       hash,
        search_parameters: { videoLimit, channelLimit },
        result_video_ids:  result.videos.map(v => v.videoId),
        result_channel_ids: result.channels.map(c => c.channelId),
        result_payload:    result,
        status:            'active',
        expires_at:        exp,
        last_used_at:      now,
        created_at:        now,
      }, { onConflict: 'query_hash' });

    if (cacheErr) {
      console.warn('[DataCache] setSearchCache upsert error:', cacheErr.message);
    }

    // 2. Upsert individual video rows (best-effort, non-blocking)
    if (result.videos.length > 0) {
      upsertVideos(db, result.videos).catch(e =>
        console.warn('[DataCache] upsertVideos error:', e.message),
      );
    }

    // 3. Upsert individual channel rows (best-effort, non-blocking)
    if (result.channels.length > 0) {
      upsertChannels(db, result.channels).catch(e =>
        console.warn('[DataCache] upsertChannels error:', e.message),
      );
    }

    console.log(`[DataCache] Stored search result for "${normalizedQuery}" (expires ${exp})`);
  } catch (err: any) {
    console.warn('[DataCache] setSearchCache error (non-fatal):', err.message);
  }
}

function channelFromCacheRow(row: {
  youtube_channel_id: string;
  channel_title: string;
  description: string;
  thumbnail_url: string;
  subscriber_count: number;
  video_count: number;
  view_count: number;
  published_at: string | null;
  raw_metadata?: YouTubeChannel | null;
  last_fetched_at?: string;
}): YouTubeChannel {
  const raw = row.raw_metadata;
  if (raw && raw.channelId && raw.statistics) return raw;
  const thumb = row.thumbnail_url || '';
  const t = (url: string, w: number, h: number) => ({ url: url || thumb, width: w, height: h });
  return {
    channelId: row.youtube_channel_id,
    title: row.channel_title,
    description: row.description || '',
    thumbnails: {
      default: t(thumb, 88, 88),
      medium: t(thumb, 240, 240),
      high: t(thumb, 800, 800),
    },
    statistics: {
      viewCount: String(row.view_count ?? 0),
      subscriberCount: String(row.subscriber_count ?? 0),
      hiddenSubscriberCount: false,
      videoCount: String(row.video_count ?? 0),
    },
    publishedAt: row.published_at || new Date().toISOString(),
    source: 'youtube-data',
    retrievedAt: row.last_fetched_at || new Date().toISOString(),
  };
}

/** Reuse channel rows across queries — avoids channels.list when we already fetched the ID. */
export async function getCachedChannelsByIds(channelIds: string[]): Promise<YouTubeChannel[]> {
  if (!isFeatureEnabled('ENABLE_YOUTUBE_DATA_LAYER') || channelIds.length === 0) return [];
  const db = getCacheClient();
  if (!db) return [];
  try {
    const { data, error } = await db
      .from('youtube_channels')
      .select('youtube_channel_id, channel_title, description, thumbnail_url, subscriber_count, video_count, view_count, published_at, raw_metadata, last_fetched_at')
      .in('youtube_channel_id', channelIds);
    if (error || !data) return [];
    return data.map(channelFromCacheRow);
  } catch (err: any) {
    console.warn('[DataCache] getCachedChannelsByIds error:', err.message);
    return [];
  }
}

// ─── Individual video / channel upserts ──────────────────────────────────────

async function upsertVideos(db: ReturnType<typeof getCacheClient>, videos: YouTubeVideo[]): Promise<void> {
  if (!db) return;
  const rows = videos.map(v => ({
    youtube_video_id: v.videoId,
    channel_id:       v.channelId,
    title:            v.title,
    description:      v.description?.slice(0, 1000) ?? '',
    published_at:     v.publishedAt,
    thumbnail_url:    v.thumbnails?.medium?.url ?? v.thumbnails?.default?.url ?? '',
    duration:         v.contentDetails?.duration ?? '',
    view_count:       parseInt(v.statistics?.viewCount ?? '0', 10),
    like_count:       parseInt(v.statistics?.likeCount ?? '0', 10),
    comment_count:    parseInt(v.statistics?.commentCount ?? '0', 10),
    last_fetched_at:  v.retrievedAt,
    next_refresh_at:  futureIso(CACHE_TTL.videoMeta()),
  }));

  // Batch into 50-row chunks to respect Supabase row limits
  for (let i = 0; i < rows.length; i += 50) {
    const { error } = await db
      .from('youtube_videos')
      .upsert(rows.slice(i, i + 50), { onConflict: 'youtube_video_id' });
    if (error) console.warn('[DataCache] upsertVideos chunk error:', error.message);
  }
}

async function upsertChannels(db: ReturnType<typeof getCacheClient>, channels: YouTubeChannel[]): Promise<void> {
  if (!db) return;
  const rows = channels.map(c => ({
    youtube_channel_id: c.channelId,
    channel_title:      c.title,
    description:        c.description?.slice(0, 1000) ?? '',
    thumbnail_url:      c.thumbnails?.medium?.url ?? c.thumbnails?.default?.url ?? '',
    subscriber_count:   parseInt(c.statistics?.subscriberCount ?? '0', 10),
    video_count:        parseInt(c.statistics?.videoCount ?? '0', 10),
    view_count:         parseInt(c.statistics?.viewCount ?? '0', 10),
    published_at:       c.publishedAt,
    raw_metadata:       c,
    last_fetched_at:    c.retrievedAt,
    next_refresh_at:    futureIso(CACHE_TTL.channelMeta()),
  }));

  for (let i = 0; i < rows.length; i += 50) {
    const { error } = await db
      .from('youtube_channels')
      .upsert(rows.slice(i, i + 50), { onConflict: 'youtube_channel_id' });
    if (error) console.warn('[DataCache] upsertChannels chunk error:', error.message);
  }
}

// ─── Stale cache cleanup ───────────────────────────────────────────────────────

/**
 * Mark expired search cache rows as 'expired'.
 * Called by the cron refresh job — never by the hot path.
 * Returns number of rows updated, or -1 on error.
 */
export async function expireStaleSearchCache(): Promise<number> {
  const db = getCacheClient();
  if (!db) return -1;

  try {
    const { data, error } = await db
      .from('youtube_search_cache')
      .update({ status: 'expired' })
      .eq('status', 'active')
      .lt('expires_at', nowIso())
      .select('id');

    if (error) {
      console.warn('[DataCache] expireStaleSearchCache error:', error.message);
      return -1;
    }
    return data?.length ?? 0;
  } catch (err: any) {
    console.warn('[DataCache] expireStaleSearchCache unexpected error:', err.message);
    return -1;
  }
}

/**
 * Return the most-recently cached queries that need refreshing
 * (status=active, expires_at in the past, frequently used).
 * Used by the refresh cron to prioritize work.
 */
export async function getStaleCandidates(limit = 20): Promise<
  Array<{ normalized_query: string; search_parameters: Record<string, number>; hit_count: number }>
> {
  const db = getCacheClient();
  if (!db) return [];

  try {
    const { data, error } = await db
      .from('youtube_search_cache')
      .select('normalized_query, search_parameters, hit_count')
      .eq('status', 'active')
      .lt('expires_at', nowIso())
      .order('hit_count', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('[DataCache] getStaleCandidates error:', error.message);
      return [];
    }
    return (data ?? []) as Array<{ normalized_query: string; search_parameters: Record<string, number>; hit_count: number }>;
  } catch {
    return [];
  }
}
