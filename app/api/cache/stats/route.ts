/**
 * GET /api/cache/stats
 *
 * Observability endpoint — returns:
 *   - today's YouTube API quota usage
 *   - cache hit/miss counts for YouTube search + Google Trends
 *   - refresh queue health
 *   - feature-flag states
 *
 * This route is SERVER-ONLY. It reads from the service-role Supabase client
 * so it must never be called from client components.
 *
 * Secure with the CRON_SECRET header in production:
 *   Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDailyUsageSummary, getQuotaStatus } from '@/lib/db/quota-tracker';
import { getQueueHealth } from '@/lib/db/refresh-queue';
import { getCacheClient } from '@/lib/db/cache-client';
import { isFeatureEnabled, isAnyDataLayerEnabled } from '@/lib/config/feature-flags';

export const dynamic = 'force-dynamic';

// ─── Auth guard ───────────────────────────────────────────────────────────────

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured → open (dev only)
  const auth = request.headers.get('authorization') ?? '';
  return auth === `Bearer ${secret}`;
}

// ─── Cache hit-rate query ─────────────────────────────────────────────────────

async function getCacheHitStats() {
  const db = getCacheClient();
  if (!db) return null;

  try {
    // YouTube search cache totals
    const { data: yt } = await db
      .from('youtube_search_cache')
      .select('hit_count, status');

    const ytFresh   = (yt ?? []).filter((r: any) => r.status === 'active').length;
    const ytExpired = (yt ?? []).filter((r: any) => r.status === 'expired').length;
    const ytHits    = (yt ?? []).reduce((s: number, r: any) => s + (r.hit_count ?? 0), 0);
    const ytTotal   = (yt ?? []).length;

    // Google Trends cache totals
    const { data: tr } = await db
      .from('google_trends_cache')
      .select('hit_count, status');

    const trFresh  = (tr ?? []).filter((r: any) => r.status === 'active').length;
    const trHits   = (tr ?? []).reduce((s: number, r: any) => s + (r.hit_count ?? 0), 0);
    const trTotal  = (tr ?? []).length;

    return {
      youtube_search: {
        total_rows:   ytTotal,
        active_rows:  ytFresh,
        expired_rows: ytExpired,
        total_hits:   ytHits,
        /** Approximate: hits / (hits + unique misses that caused a fetch) */
        hit_rate_pct: ytTotal > 0 ? Math.round((ytHits / Math.max(1, ytHits + ytTotal)) * 100) : 0,
      },
      google_trends: {
        total_rows:  trTotal,
        active_rows: trFresh,
        total_hits:  trHits,
        hit_rate_pct: trTotal > 0 ? Math.round((trHits / Math.max(1, trHits + trTotal)) * 100) : 0,
      },
    };
  } catch {
    return null;
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isAnyDataLayerEnabled()) {
    return NextResponse.json({
      enabled:  false,
      message:  'Data intelligence layer is disabled. Set ENABLE_DATA_CACHE=true to enable.',
      flags: {
        ENABLE_DATA_CACHE:               process.env.ENABLE_DATA_CACHE ?? 'not set',
        ENABLE_YOUTUBE_DATA_LAYER:       process.env.ENABLE_YOUTUBE_DATA_LAYER ?? 'not set',
        ENABLE_TRENDS_DATA_LAYER:        process.env.ENABLE_TRENDS_DATA_LAYER ?? 'not set',
        ENABLE_STALE_WHILE_REVALIDATE:   process.env.ENABLE_STALE_WHILE_REVALIDATE ?? 'not set',
        ENABLE_QUOTA_PROTECTION:         process.env.ENABLE_QUOTA_PROTECTION ?? 'not set',
      },
    });
  }

  const [quotaStatus, usageSummary, queueHealth, cacheStats] = await Promise.all([
    getQuotaStatus(),
    getDailyUsageSummary(),
    getQueueHealth(),
    getCacheHitStats(),
  ]);

  return NextResponse.json({
    enabled:    true,
    timestamp:  new Date().toISOString(),

    flags: {
      ENABLE_DATA_CACHE:                     isFeatureEnabled('ENABLE_DATA_CACHE'),
      ENABLE_YOUTUBE_DATA_LAYER:             isFeatureEnabled('ENABLE_YOUTUBE_DATA_LAYER'),
      ENABLE_TRENDS_DATA_LAYER:              isFeatureEnabled('ENABLE_TRENDS_DATA_LAYER'),
      ENABLE_STALE_WHILE_REVALIDATE:         isFeatureEnabled('ENABLE_STALE_WHILE_REVALIDATE'),
      ENABLE_QUOTA_PROTECTION:               isFeatureEnabled('ENABLE_QUOTA_PROTECTION'),
      ENABLE_EXTERNAL_DATA_RANKING_SIGNALS:  isFeatureEnabled('ENABLE_EXTERNAL_DATA_RANKING_SIGNALS'),
    },

    quota: {
      used_today:       quotaStatus.usedToday,
      daily_limit:      quotaStatus.dailyLimit,
      safety_limit:     quotaStatus.safetyLimit,
      remaining:        quotaStatus.remaining,
      within_budget:    quotaStatus.withinBudget,
      usage_pct:        quotaStatus.dailyLimit > 0
        ? Math.round((quotaStatus.usedToday / quotaStatus.dailyLimit) * 100)
        : 0,
    },

    usage_today: usageSummary ?? { message: 'No usage recorded today' },

    cache: cacheStats ?? { message: 'Cache stats unavailable' },

    refresh_queue: queueHealth ?? { message: 'Queue health unavailable' },
  });
}
