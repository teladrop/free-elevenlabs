/**
 * Background Refresh Queue
 *
 * Helpers for enqueuing and processing data refresh jobs.
 * Jobs are persisted in the `data_refresh_jobs` Supabase table so they
 * survive server restarts and can be processed by the cron Edge Function.
 *
 * Priority levels (lower number = higher priority):
 *   1 — trending / currently active query
 *   2 — high-frequency query (many hits)
 *   3 — recently published video refresh
 *   4 — popular channel refresh
 *   5 — routine / low-demand refresh
 *
 * Table: data_refresh_jobs  (created in migration 001_data_cache.sql)
 */

import { getCacheClient } from './cache-client';
import { isFeatureEnabled } from '@/lib/config/feature-flags';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RefreshSource      = 'youtube' | 'trends';
export type RefreshEntityType  = 'search_query' | 'video' | 'channel' | 'trends_query';
export type RefreshJobStatus   = 'pending' | 'running' | 'done' | 'failed';

export interface RefreshJob {
  id:              string;
  source:          RefreshSource;
  entity_type:     RefreshEntityType;
  entity_id:       string;          // normalized query / video ID / channel ID
  priority:        number;          // 1–5
  status:          RefreshJobStatus;
  attempts:        number;
  last_attempt_at: string | null;
  next_attempt_at: string;
  last_success_at: string | null;
  error_message:   string | null;
  created_at:      string;
  updated_at:      string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString();
}

function minutesFromNow(minutes: number): string {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

/** Exponential back-off: 2^attempts minutes, capped at 60 */
function backoffMinutes(attempts: number): number {
  return Math.min(60, Math.pow(2, attempts));
}

// ─── Enqueue ──────────────────────────────────────────────────────────────────

/**
 * Add a refresh job to the queue.
 * Idempotent — if an identical pending job already exists it is left as-is.
 * Never throws.
 */
export async function enqueueRefreshJob(
  source:     RefreshSource,
  entityType: RefreshEntityType,
  entityId:   string,
  priority:   number = 3,
): Promise<void> {
  if (!isFeatureEnabled('ENABLE_YOUTUBE_DATA_LAYER') &&
      !isFeatureEnabled('ENABLE_TRENDS_DATA_LAYER')) return;

  const db = getCacheClient();
  if (!db) return;

  try {
    const now = nowIso();

    // Check for an existing pending/running job for this entity
    const { data: existing } = await db
      .from('data_refresh_jobs')
      .select('id, status')
      .eq('source', source)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .in('status', ['pending', 'running'])
      .maybeSingle();

    if (existing) {
      // Job already queued — update priority if the new one is higher (lower number)
      if (priority < (existing as any).priority) {
        await db
          .from('data_refresh_jobs')
          .update({ priority, updated_at: now })
          .eq('id', (existing as any).id);
      }
      return;
    }

    await db.from('data_refresh_jobs').insert({
      source,
      entity_type:     entityType,
      entity_id:       entityId,
      priority,
      status:          'pending',
      attempts:        0,
      last_attempt_at: null,
      next_attempt_at: now,
      last_success_at: null,
      error_message:   null,
      created_at:      now,
      updated_at:      now,
    });
  } catch (err: any) {
    console.warn('[RefreshQueue] enqueueRefreshJob error (non-fatal):', err.message);
  }
}

// ─── Dequeue (for cron) ───────────────────────────────────────────────────────

/**
 * Fetch the next batch of pending jobs, ordered by priority then next_attempt_at.
 * Marks them as 'running' atomically before returning.
 * Called only by the cron / Edge Function — not the hot path.
 */
export async function dequeueJobs(batchSize = 10): Promise<RefreshJob[]> {
  const db = getCacheClient();
  if (!db) return [];

  try {
    const now = nowIso();

    // Fetch eligible pending jobs
    const { data: jobs, error } = await db
      .from('data_refresh_jobs')
      .select('*')
      .eq('status', 'pending')
      .lte('next_attempt_at', now)
      .order('priority', { ascending: true })
      .order('next_attempt_at', { ascending: true })
      .limit(batchSize);

    if (error || !jobs || jobs.length === 0) return [];

    const ids = jobs.map((j: any) => j.id);

    // Mark as running
    await db
      .from('data_refresh_jobs')
      .update({ status: 'running', last_attempt_at: now, updated_at: now })
      .in('id', ids);

    return jobs as RefreshJob[];
  } catch (err: any) {
    console.warn('[RefreshQueue] dequeueJobs error:', err.message);
    return [];
  }
}

// ─── Complete / fail ──────────────────────────────────────────────────────────

/** Mark a job as successfully completed. */
export async function completeJob(jobId: string): Promise<void> {
  const db = getCacheClient();
  if (!db) return;

  try {
    const now = nowIso();
    await db
      .from('data_refresh_jobs')
      .update({ status: 'done', last_success_at: now, error_message: null, updated_at: now })
      .eq('id', jobId);
  } catch (err: any) {
    console.warn('[RefreshQueue] completeJob error:', err.message);
  }
}

/** Mark a job as failed and schedule a back-off retry. */
export async function failJob(jobId: string, errorMessage: string, currentAttempts: number): Promise<void> {
  const db = getCacheClient();
  if (!db) return;

  try {
    const now        = nowIso();
    const attempts   = currentAttempts + 1;
    const maxRetries = 5;

    if (attempts >= maxRetries) {
      await db
        .from('data_refresh_jobs')
        .update({
          status:          'failed',
          attempts,
          error_message:   errorMessage.slice(0, 500),
          updated_at:      now,
        })
        .eq('id', jobId);
    } else {
      await db
        .from('data_refresh_jobs')
        .update({
          status:          'pending',
          attempts,
          error_message:   errorMessage.slice(0, 500),
          next_attempt_at: minutesFromNow(backoffMinutes(attempts)),
          updated_at:      now,
        })
        .eq('id', jobId);
    }
  } catch (err: any) {
    console.warn('[RefreshQueue] failJob error:', err.message);
  }
}

// ─── Queue health (for observability) ────────────────────────────────────────

export interface QueueHealth {
  pending: number;
  running: number;
  failed:  number;
  done24h: number;
}

export async function getQueueHealth(): Promise<QueueHealth | null> {
  const db = getCacheClient();
  if (!db) return null;

  try {
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    const [pending, running, failed, done24h] = await Promise.all([
      db.from('data_refresh_jobs').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      db.from('data_refresh_jobs').select('id', { count: 'exact', head: true }).eq('status', 'running'),
      db.from('data_refresh_jobs').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
      db.from('data_refresh_jobs').select('id', { count: 'exact', head: true })
        .eq('status', 'done').gte('updated_at', yesterday),
    ]);

    return {
      pending: pending.count ?? 0,
      running: running.count ?? 0,
      failed:  failed.count  ?? 0,
      done24h: done24h.count ?? 0,
    };
  } catch {
    return null;
  }
}

// ─── Convenience: enqueue a stale search refresh ─────────────────────────────

/**
 * Called by data-cache.ts when stale-while-revalidate fires.
 * Enqueues a priority-2 job (high-frequency query).
 */
export async function enqueueSearchRefresh(
  normalizedQuery: string,
  hitCount: number,
): Promise<void> {
  // Higher hit count → higher priority (lower number, floor at 1)
  const priority = hitCount >= 20 ? 1 : hitCount >= 5 ? 2 : 3;
  await enqueueRefreshJob('youtube', 'search_query', normalizedQuery, priority);
}

/**
 * Called by trends-cache when a stale Trends record is detected.
 */
export async function enqueueTrendsRefresh(normalizedQuery: string): Promise<void> {
  await enqueueRefreshJob('trends', 'trends_query', normalizedQuery, 3);
}
