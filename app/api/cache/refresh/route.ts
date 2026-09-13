/**
 * POST /api/cache/refresh
 *
 * Called by the GitHub Actions cron workflow every hour.
 * Processes a limited batch of stale refresh jobs from the queue
 * then re-fetches the underlying data using the existing services.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 *
 * Design rules:
 *   - Small controlled batch (YOUTUBE_MAX_REQUESTS_PER_JOB)
 *   - Respects quota threshold before each YouTube request
 *   - Existing behavior is NEVER affected — this only refills the cache
 *   - No response body is sent to the caller until all jobs are done
 *     (GitHub Actions waits up to 60 s then moves on regardless)
 */

import { NextRequest, NextResponse } from 'next/server';
import { dequeueJobs, completeJob, failJob } from '@/lib/db/refresh-queue';
import { canAffordRequest, trackYouTubeRequest, QUOTA_CONFIG } from '@/lib/db/quota-tracker';
import { setSearchCache } from '@/lib/db/data-cache';
import { setTrendsCache } from '@/lib/db/trends-cache';
import { isAnyDataLayerEnabled } from '@/lib/config/feature-flags';
import { comprehensiveSearch } from '@/lib/youtube/data-service';
import { fetchYoutubeTrendKeywords } from '@/lib/research/google-trends';
import { normalizeQuery } from '@/lib/youtube/normalizer';
import { API_LIMITS } from '@/lib/config/research';

export const dynamic    = 'force-dynamic';
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isAnyDataLayerEnabled()) {
    return NextResponse.json({ skipped: true, reason: 'Data layer disabled' });
  }

  const batchSize  = Math.min(QUOTA_CONFIG.maxRequestsPerJob(), 20);
  const jobs       = await dequeueJobs(batchSize);
  const results: Array<{ id: string; entity: string; status: string; error?: string }> = [];

  for (const job of jobs) {
    const entityId = job.entity_id;

    try {
      if (job.source === 'youtube' && job.entity_type === 'search_query') {
        // ~100 quota units for a search.list
        const affordable = await canAffordRequest(100);
        if (!affordable) {
          await failJob(job.id, 'Quota threshold reached', job.attempts);
          results.push({ id: job.id, entity: entityId, status: 'deferred' });
          continue;
        }

        const normalized = normalizeQuery(entityId);
        // useCache=false forces a fresh YouTube API call
        const fresh = await comprehensiveSearch(
          normalized,
          API_LIMITS.defaultVideoLimit,
          API_LIMITS.defaultChannelLimit,
          false,
        );
        await setSearchCache(
          normalized,
          API_LIMITS.defaultVideoLimit,
          API_LIMITS.defaultChannelLimit,
          fresh,
        );
        trackYouTubeRequest('search.list', true, 100).catch(() => {/* non-fatal */});
        await completeJob(job.id);
        results.push({ id: job.id, entity: entityId, status: 'refreshed' });

      } else if (job.source === 'trends' && job.entity_type === 'trends_query') {
        // Trends is free — no quota check needed
        const keywords = await fetchYoutubeTrendKeywords(entityId);
        if (keywords.length > 0) {
          await setTrendsCache(entityId, keywords);
        }
        await completeJob(job.id);
        results.push({ id: job.id, entity: entityId, status: 'refreshed' });

      } else {
        // Unknown job type — mark done to avoid stuck jobs
        await completeJob(job.id);
        results.push({ id: job.id, entity: entityId, status: 'skipped_unknown_type' });
      }
    } catch (err: any) {
      await failJob(job.id, err.message ?? 'Unknown error', job.attempts);
      results.push({ id: job.id, entity: entityId, status: 'error', error: err.message });
    }
  }

  return NextResponse.json({
    processed:  jobs.length,
    results,
    timestamp:  new Date().toISOString(),
  });
}
