/**
 * POST /api/cache/cleanup
 *
 * Marks expired search and Trends cache rows as 'expired'.
 * Called by the GitHub Actions cron after the refresh job.
 * Safe to call frequently — only touches rows past their expires_at.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server';
import { expireStaleSearchCache } from '@/lib/db/data-cache';
import { expireStaleTrendsCache } from '@/lib/db/trends-cache';
import { isAnyDataLayerEnabled } from '@/lib/config/feature-flags';

export const dynamic = 'force-dynamic';

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

  const [ytExpired, trExpired] = await Promise.all([
    expireStaleSearchCache(),
    expireStaleTrendsCache(),
  ]);

  return NextResponse.json({
    youtube_search_expired: ytExpired,
    trends_expired:         trExpired,
    timestamp:              new Date().toISOString(),
  });
}
