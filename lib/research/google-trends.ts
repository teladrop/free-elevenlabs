/**
 * Free YouTube keyword planner via Google Trends (YouTube search property).
 *
 * Google Ads Keyword Planner is paid. Trends related queries are free and
 * include a relative interest score (0–100 among related terms).
 * Never invent monthly search-volume counts.
 */

import { sanitizeSearchText, isVerifiedSearchTerm } from '@/lib/youtube/autocomplete';
import { getTrendsCache, setTrendsCache } from '@/lib/db/trends-cache';
import { isFeatureEnabled } from '@/lib/config/feature-flags';

export interface TrendKeyword {
  term: string;
  relativeVolume: number; // 0–100 among this related set
  sourceId: string;
  retrievedAt: string;
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { data: TrendKeyword[]; expiresAt: number }>();

function stripTrendsPrefix(text: string): string {
  return text.replace(/^\)\]\}',?\s*/, '');
}

async function trendsGet(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'application/json,text/plain,*/*',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const raw = stripTrendsPrefix(await res.text());
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

interface ExploreWidget {
  id?: string;
  title?: string;
  token?: string;
  request?: unknown;
}

function relatedWidget(explore: any): ExploreWidget | null {
  const widgets: ExploreWidget[] = explore?.widgets || [];
  return (
    widgets.find(w => w.id === 'RELATED_QUERIES') ||
    widgets.find(w => String(w.title || '').toLowerCase().includes('related quer')) ||
    null
  );
}

function parseRelatedList(items: any[] | undefined, sourceId: string, retrievedAt: string): TrendKeyword[] {
  if (!Array.isArray(items)) return [];
  const out: TrendKeyword[] = [];
  for (const item of items) {
    const term = sanitizeSearchText(String(item?.query || ''));
    if (!isVerifiedSearchTerm(term)) continue;
    const value = Number(item?.value);
    if (!Number.isFinite(value) || value < 0 || value > 100) continue;
    out.push({ term, relativeVolume: Math.round(value), sourceId, retrievedAt });
  }
  return out;
}

export async function fetchYoutubeTrendKeywords(userQuery: string): Promise<TrendKeyword[]> {
  const seed = sanitizeSearchText(userQuery);
  if (!isVerifiedSearchTerm(seed)) return [];

  // ── NEW: Supabase cache check (additive — falls back on any error) ─────────
  if (isFeatureEnabled('ENABLE_TRENDS_DATA_LAYER')) {
    try {
      const sbCached = await getTrendsCache(seed);
      if (sbCached !== null) {
        // Populate in-memory cache so subsequent in-process calls are instant
        cache.set(seed.toLowerCase(), {
          data:      sbCached,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
        return sbCached;
      }
    } catch (err: any) {
      console.warn('[Trends] Supabase cache check failed (falling back):', err.message);
    }
  }
  // ── END new block ──────────────────────────────────────────────────────────

  // Existing in-memory cache (unchanged)
  const cached = cache.get(seed.toLowerCase());
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  const retrievedAt = new Date().toISOString();
  const exploreReq = {
    comparisonItem: [{ keyword: seed, geo: '', time: 'today 12-m' }],
    category: 0,
    property: 'youtube',
  };
  const exploreUrl =
    `https://trends.google.com/trends/api/explore?hl=en-US&tz=0&req=${encodeURIComponent(JSON.stringify(exploreReq))}`;

  const explore = await trendsGet(exploreUrl);
  const widget = relatedWidget(explore);
  if (!widget?.token || !widget.request) {
    cache.set(seed.toLowerCase(), { data: [], expiresAt: Date.now() + CACHE_TTL_MS });
    return [];
  }

  const relatedUrl =
    `https://trends.google.com/trends/api/widgetdata/relatedsearches?hl=en-US&tz=0&token=${encodeURIComponent(widget.token)}&req=${encodeURIComponent(JSON.stringify(widget.request))}`;

  const related = await trendsGet(relatedUrl);
  const ranked = (related as any)?.default?.rankedList || [];
  const top = ranked[0]?.rankedKeyword || ranked.find((r: any) => r?.rankedKeyword)?.rankedKeyword;

  const keywords = parseRelatedList(top, seed, retrievedAt);
  cache.set(seed.toLowerCase(), { data: keywords, expiresAt: Date.now() + CACHE_TTL_MS });
  console.log(`[Trends] "${seed}" → ${keywords.length} YouTube related queries`);

  // ── NEW: persist to Supabase (fire-and-forget) ─────────────────────────────
  if (isFeatureEnabled('ENABLE_TRENDS_DATA_LAYER') && keywords.length > 0) {
    setTrendsCache(seed, keywords).catch(() => {/* non-fatal */});
  }
  // ── END new block ──────────────────────────────────────────────────────────

  return keywords;
}
