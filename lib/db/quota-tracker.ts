/**
 * YouTube API Quota Tracker
 *
 * Records every YouTube API call and checks whether today's budget allows
 * another request.  All writes are best-effort — quota protection NEVER
 * prevents a request from completing if the tracker itself fails.
 *
 * Quota costs (YouTube Data API v3 defaults):
 *   search.list  → 100 units
 *   videos.list  →   1 unit per video (batched up to 50)
 *   channels.list→   1 unit per channel (batched up to 50)
 *
 * Table used: data_source_usage  (created in migration 001_data_cache.sql)
 *
 * Environment variables:
 *   YOUTUBE_DAILY_QUOTA_LIMIT          — default 10 000 (free tier)
 *   YOUTUBE_QUOTA_SAFETY_PERCENTAGE    — default 80 (stop at 80% used)
 *   YOUTUBE_MAX_REQUESTS_PER_JOB       — default 50
 *   YOUTUBE_MAX_CONCURRENT_REQUESTS    — default 5
 */

import { getCacheClient } from './cache-client';
import { isFeatureEnabled } from '@/lib/config/feature-flags';

// ─── Configuration ────────────────────────────────────────────────────────────

function envInt(key: string, fallback: number): number {
  const v = process.env[key];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const QUOTA_CONFIG = {
  dailyLimit:          () => envInt('YOUTUBE_DAILY_QUOTA_LIMIT',       10_000),
  safetyPct:           () => envInt('YOUTUBE_QUOTA_SAFETY_PERCENTAGE', 80),
  maxRequestsPerJob:   () => envInt('YOUTUBE_MAX_REQUESTS_PER_JOB',    50),
  maxConcurrent:       () => envInt('YOUTUBE_MAX_CONCURRENT_REQUESTS', 5),
} as const;

// ─── Operation cost table ─────────────────────────────────────────────────────

export type YouTubeOperation =
  | 'search.list'
  | 'videos.list'
  | 'channels.list'
  | 'unknown';

const OPERATION_COST: Record<YouTubeOperation, number> = {
  'search.list':   100,
  'videos.list':   1,
  'channels.list': 1,
  'unknown':       1,
};

export function operationCost(op: YouTubeOperation): number {
  return OPERATION_COST[op] ?? 1;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function nowIso(): string {
  return new Date().toISOString();
}

// ─── Track a completed request ────────────────────────────────────────────────

/**
 * Record one YouTube API call in the usage table.
 * Fire-and-forget — never awaited in the hot path.
 */
export async function trackYouTubeRequest(
  operation: YouTubeOperation,
  success: boolean,
  quotaUnits?: number,
): Promise<void> {
  if (!isFeatureEnabled('ENABLE_YOUTUBE_DATA_LAYER')) return;

  const db = getCacheClient();
  if (!db) return;

  const date  = todayUtc();
  const units = quotaUnits ?? operationCost(operation);
  const now   = nowIso();

  try {
    // Try to increment an existing row for today
    const { data: existing } = await db
      .from('data_source_usage')
      .select('id, request_count, successful_count, failed_count, quota_units_used')
      .eq('source', 'youtube')
      .eq('operation', operation)
      .eq('date', date)
      .maybeSingle();

    if (existing) {
      await db
        .from('data_source_usage')
        .update({
          request_count:    existing.request_count + 1,
          successful_count: existing.successful_count + (success ? 1 : 0),
          failed_count:     existing.failed_count    + (success ? 0 : 1),
          quota_units_used: existing.quota_units_used + units,
          updated_at:       now,
        })
        .eq('id', existing.id);
    } else {
      await db
        .from('data_source_usage')
        .insert({
          source:           'youtube',
          operation,
          date,
          request_count:    1,
          successful_count: success ? 1 : 0,
          failed_count:     success ? 0 : 1,
          quota_units_used: units,
          created_at:       now,
          updated_at:       now,
        });
    }
  } catch (err: any) {
    // Quota tracking failure must NEVER impact the caller
    console.warn('[QuotaTracker] trackYouTubeRequest error (non-fatal):', err.message);
  }
}

// ─── Check remaining budget ───────────────────────────────────────────────────

export interface QuotaStatus {
  /** Units used today */
  usedToday:      number;
  /** Configured daily limit */
  dailyLimit:     number;
  /** Units remaining before safety threshold */
  remaining:      number;
  /** Safety threshold in units (limit × safetyPct / 100) */
  safetyLimit:    number;
  /** True when we are still within the safety threshold */
  withinBudget:   boolean;
  /** True when Supabase is unavailable — callers should assume budget is OK */
  unavailable:    boolean;
}

/**
 * Returns the current quota status for today.
 * If Supabase is unavailable, returns { unavailable: true, withinBudget: true }
 * so callers never block requests due to tracker failure.
 */
export async function getQuotaStatus(): Promise<QuotaStatus> {
  const limit       = QUOTA_CONFIG.dailyLimit();
  const safetyLimit = Math.floor(limit * QUOTA_CONFIG.safetyPct() / 100);

  const unavailableResult: QuotaStatus = {
    usedToday:    0,
    dailyLimit:   limit,
    remaining:    safetyLimit,
    safetyLimit,
    withinBudget: true,
    unavailable:  true,
  };

  if (!isFeatureEnabled('ENABLE_YOUTUBE_DATA_LAYER')) return unavailableResult;

  const db = getCacheClient();
  if (!db) return unavailableResult;

  try {
    const { data, error } = await db
      .from('data_source_usage')
      .select('quota_units_used')
      .eq('source', 'youtube')
      .eq('date', todayUtc());

    if (error) return unavailableResult;

    const usedToday = (data ?? []).reduce(
      (sum: number, row: any) => sum + (row.quota_units_used ?? 0),
      0,
    );

    const remaining     = Math.max(0, safetyLimit - usedToday);
    const withinBudget  = usedToday < safetyLimit;

    return { usedToday, dailyLimit: limit, remaining, safetyLimit, withinBudget, unavailable: false };
  } catch (err: any) {
    console.warn('[QuotaTracker] getQuotaStatus error (assuming budget OK):', err.message);
    return unavailableResult;
  }
}

/**
 * Quick check: can we afford `units` more quota units today?
 * Always returns true when the tracker is unavailable.
 */
export async function canAffordRequest(units: number): Promise<boolean> {
  const status = await getQuotaStatus();
  if (status.unavailable) return true;
  return status.remaining >= units;
}

// ─── Today's summary (for observability endpoint) ────────────────────────────

export interface DailyUsageSummary {
  date:          string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalQuotaUnits: number;
  byOperation:   Record<string, { requests: number; units: number }>;
}

export async function getDailyUsageSummary(): Promise<DailyUsageSummary | null> {
  const db = getCacheClient();
  if (!db) return null;

  const date = todayUtc();

  try {
    const { data, error } = await db
      .from('data_source_usage')
      .select('operation, request_count, successful_count, failed_count, quota_units_used')
      .eq('source', 'youtube')
      .eq('date', date);

    if (error || !data) return null;

    const byOperation: Record<string, { requests: number; units: number }> = {};
    let totalRequests = 0;
    let successfulRequests = 0;
    let failedRequests = 0;
    let totalQuotaUnits = 0;

    for (const row of data) {
      byOperation[row.operation] = {
        requests: row.request_count,
        units:    row.quota_units_used,
      };
      totalRequests      += row.request_count;
      successfulRequests += row.successful_count;
      failedRequests     += row.failed_count;
      totalQuotaUnits    += row.quota_units_used;
    }

    return { date, totalRequests, successfulRequests, failedRequests, totalQuotaUnits, byOperation };
  } catch {
    return null;
  }
}
