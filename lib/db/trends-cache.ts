/**
 * Google Trends Data Cache
 *
 * Supabase-backed cache for Google Trends results.
 * ADDITIVE — falls back silently to null when:
 *   - ENABLE_TRENDS_DATA_LAYER=false
 *   - Supabase is unavailable
 *   - Any DB error occurs
 *
 * The existing in-memory cache inside lib/research/google-trends.ts is
 * untouched.  This layer wraps it:
 *
 *   fetchYoutubeTrendKeywords(query)
 *     → getTrendsCache(query)           ← new (this file)
 *       hit  → return cached TrendKeyword[]
 *       miss → existing google-trends.ts fetch  ← unchanged
 *                → setTrendsCache(...)           ← new (this file)
 *                → return result
 *
 * Table used: google_trends_cache  (created in migration 001_data_cache.sql)
 */

import crypto from 'crypto';
import { getCacheClient } from './cache-client';
import { isFeatureEnabled } from '@/lib/config/feature-flags';
import type { TrendKeyword } from '@/lib/research/google-trends';

// ─── TTL ─────────────────────────────────────────────────────────────────────

function ttlSeconds(envKey: string, defaultSec: number): number {
  const v = process.env[envKey];
  if (!v) return defaultSec;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : defaultSec;
}

/** Google Trends data TTL — default 6 h, matches existing in-memory cache */
export function trendsTtlSeconds(): number {
  return ttlSeconds('CACHE_TTL_TRENDS_S', 6 * 3600);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function trendsHash(normalizedQuery: string, region: string, timeRange: string): string {
  return crypto
    .createHash('sha256')
    .update(`${normalizedQuery.toLowerCase().trim()}|${region}|${timeRange}`)
    .digest('hex');
}

function nowIso(): string {
  return new Date().toISOString();
}

function futureIso(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function isFresh(expiresAt: string): boolean {
  return Date.now() < new Date(expiresAt).getTime();
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Look up a Trends result in Supabase.
 * Returns null on miss, disabled layer, or any error.
 */
export async function getTrendsCache(
  normalizedQuery: string,
  region = '',
  timeRange = 'today 12-m',
): Promise<TrendKeyword[] | null> {
  if (!isFeatureEnabled('ENABLE_TRENDS_DATA_LAYER')) return null;

  const db = getCacheClient();
  if (!db) return null;

  try {
    const hash = trendsHash(normalizedQuery, region, timeRange);

    const { data: row, error } = await db
      .from('google_trends_cache')
      .select('trend_data, expires_at, hit_count')
      .eq('query_hash', hash)
      .eq('status', 'active')
      .maybeSingle();

    if (error || !row) return null;
    if (!isFresh(row.expires_at)) return null;

    // Bump hit counter — fire and forget
    db.from('google_trends_cache')
      .update({ hit_count: (row.hit_count ?? 0) + 1, last_used_at: nowIso() })
      .eq('query_hash', hash)
      .then(() => {/* intentional no-op */});

    console.log(`[TrendsCache] FRESH hit for "${normalizedQuery}"`);
    return row.trend_data as TrendKeyword[];
  } catch (err: any) {
    console.warn('[TrendsCache] getTrendsCache error (falling back):', err.message);
    return null;
  }
}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Persist a Trends result to Supabase.
 * Upserts so re-fetches overwrite stale rows.
 * Never throws — errors are logged and swallowed.
 */
export async function setTrendsCache(
  normalizedQuery: string,
  keywords: TrendKeyword[],
  region = '',
  timeRange = 'today 12-m',
): Promise<void> {
  if (!isFeatureEnabled('ENABLE_TRENDS_DATA_LAYER')) return;

  const db = getCacheClient();
  if (!db) return;

  try {
    const hash = trendsHash(normalizedQuery, region, timeRange);
    const now  = nowIso();
    const exp  = futureIso(trendsTtlSeconds());

    const { error } = await db
      .from('google_trends_cache')
      .upsert({
        normalized_query: normalizedQuery,
        query_hash:       hash,
        region,
        time_range:       timeRange,
        category:         0,
        trend_data:       keywords,
        status:           'active',
        expires_at:       exp,
        last_used_at:     now,
        created_at:       now,
      }, { onConflict: 'query_hash' });

    if (error) {
      console.warn('[TrendsCache] setTrendsCache upsert error:', error.message);
      return;
    }

    console.log(
      `[TrendsCache] Stored ${keywords.length} trend keywords for "${normalizedQuery}" (expires ${exp})`,
    );
  } catch (err: any) {
    console.warn('[TrendsCache] setTrendsCache error (non-fatal):', err.message);
  }
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

/**
 * Mark expired Trends cache rows as 'expired'.
 * Called by the cron refresh job — never by the hot path.
 */
export async function expireStaleTrendsCache(): Promise<number> {
  const db = getCacheClient();
  if (!db) return -1;

  try {
    const { data, error } = await db
      .from('google_trends_cache')
      .update({ status: 'expired' })
      .eq('status', 'active')
      .lt('expires_at', nowIso())
      .select('id');

    if (error) {
      console.warn('[TrendsCache] expireStaleTrendsCache error:', error.message);
      return -1;
    }
    return data?.length ?? 0;
  } catch (err: any) {
    console.warn('[TrendsCache] expireStaleTrendsCache unexpected error:', err.message);
    return -1;
  }
}
