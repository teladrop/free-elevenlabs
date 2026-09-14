/**
 * Competitor Cache Manager
 *
 * Handles storing and refreshing competitor data in Supabase.
 * - Caches 10 competitor channels per user per niche
 * - Updates weekly via API route (triggered by cron or manual sync)
 * - Stores historical snapshots for trend analysis
 */

import { createClient } from '@supabase/supabase-js';
import { CompetitorChannel, discoverCompetitorChannels } from './competitor-discovery';
import { detectNiche, getNicheSearchQuery } from './niche-detection';
import { ChannelConnection, ChannelVideo } from '@/app/providers/channel-provider';

export async function getOrRefreshCompetitorData(
  userId: string,
  connection: ChannelConnection,
  videos: ChannelVideo[],
  forceRefresh: boolean = false,
): Promise<CompetitorChannel[]> {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  try {
    // 1. Detect niche (or use cached detection)
    const nicheResult = await getNicheDetection(db, userId, connection, videos);
    const { niche, confidence } = nicheResult;

    // 2. Check if we have fresh competitor data
    if (!forceRefresh) {
      const cached = await getCachedCompetitors(db, userId, niche);
      if (cached.length > 0) {
        const staleThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days
        const anyFresh = cached.some(
          (c) => Date.now() - new Date(c.last_fetched_at).getTime() < staleThreshold,
        );
        if (anyFresh) {
          return cached.map(dbRowToCompetitor);
        }
      }
    }

    // 3. Discover new competitors
    const searchQuery = getNicheSearchQuery(niche);
    const discovered = await discoverCompetitorChannels(searchQuery, 10);

    if (discovered.length === 0) {
      console.warn(`[competitor-cache] No competitors discovered for niche: ${niche}`);
      return [];
    }

    // 4. Save to database
    await saveCompetitorsToDB(db, userId, niche, discovered);

    // 5. Save snapshot
    await saveCompetitorSnapshot(db, userId, discovered);

    return discovered;
  } catch (error) {
    console.error('[competitor-cache] Error:', error);
    return [];
  }
}

// ─── Niche Detection Caching ────────────────────────────────────────────────

async function getNicheDetection(
  db: any,
  userId: string,
  connection: ChannelConnection,
  videos: ChannelVideo[],
) {
  const channelId = connection.channel_id;

  // Check if we have a cached detection
  const { data: cached } = await db
    .from('niche_detections')
    .select('*')
    .eq('user_id', userId)
    .eq('youtube_channel_id', channelId)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (cached) {
    return {
      niche: cached.detected_niche,
      confidence: cached.confidence,
    };
  }

  // Detect niche
  const result = detectNiche(connection, videos);

  // Save detection
  await db.from('niche_detections').upsert(
    {
      user_id: userId,
      youtube_channel_id: channelId,
      detected_niche: result.niche,
      confidence: result.confidence,
      channel_title: connection.channel_title,
      channel_description: connection.channel_description,
      category_tag: connection.category_tag,
      top_video_titles: videos.slice(0, 5).map((v) => v.title),
      detected_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    { onConflict: 'user_id,youtube_channel_id' },
  );

  return result;
}

// ─── Get Cached Competitors ─────────────────────────────────────────────────

async function getCachedCompetitors(
  db: any,
  userId: string,
  niche: string,
): Promise<any[]> {
  const { data, error } = await db
    .from('competitor_channels')
    .select('*')
    .eq('user_id', userId)
    .eq('niche_detected_from', niche)
    .order('subscriber_count', { ascending: false });

  if (error) {
    console.error('[competitor-cache] Query error:', error);
    return [];
  }

  return data || [];
}

// ─── Save Competitors to DB ─────────────────────────────────────────────────

async function saveCompetitorsToDB(
  db: any,
  userId: string,
  niche: string,
  competitors: CompetitorChannel[],
): Promise<void> {
  const rows = competitors.map((comp) => ({
    user_id: userId,
    niche_detected_from: niche,
    youtube_channel_id: comp.youtubeChannelId,
    channel_title: comp.title,
    channel_handle: comp.handle,
    description: comp.description,
    profile_image_url: comp.profileImageUrl,
    category: comp.categoryTag,
    subscriber_count: comp.subscriberCount,
    video_count: comp.videoCount,
    view_count: comp.viewCount,
    avg_engagement_rate: comp.avgEngagementRate,
    avg_views_per_video: comp.avgViewsPerVideo,
    upload_frequency: comp.uploadFrequency,
    last_fetched_at: new Date().toISOString(),
    data_is_stale: false,
  }));

  const { error } = await db.from('competitor_channels').upsert(rows, {
    onConflict: 'user_id,youtube_channel_id',
  });

  if (error) {
    console.error('[competitor-cache] Upsert error:', error);
    throw error;
  }
}

// ─── Save Snapshot for Historical Tracking ──────────────────────────────────

async function saveCompetitorSnapshot(
  db: any,
  userId: string,
  competitors: CompetitorChannel[],
): Promise<void> {
  // Get the competitor IDs from the database
  const { data: dbCompetitors } = await db
    .from('competitor_channels')
    .select('id, youtube_channel_id')
    .eq('user_id', userId);

  if (!dbCompetitors || dbCompetitors.length === 0) return;

  const competitorMap = new Map(
    dbCompetitors.map((c: any) => [c.youtube_channel_id, c.id]),
  );

  const snapshots = competitors
    .map((comp) => {
      const competitorId = competitorMap.get(comp.youtubeChannelId);
      if (!competitorId) return null;

      return {
        user_id: userId,
        competitor_id: competitorId,
        snapshot_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        subscriber_count: comp.subscriberCount,
        view_count: comp.viewCount,
        video_count: comp.videoCount,
        avg_engagement_rate: comp.avgEngagementRate,
      };
    })
    .filter((s) => s !== null);

  if (snapshots.length === 0) return;

  const { error } = await db.from('competitor_snapshots').upsert(snapshots, {
    onConflict: 'competitor_id,snapshot_date',
  });

  if (error) {
    console.error('[competitor-cache] Snapshot error:', error);
  }
}

// ─── Helper: Convert DB row to CompetitorChannel ────────────────────────────

function dbRowToCompetitor(row: any): CompetitorChannel {
  return {
    youtubeChannelId: row.youtube_channel_id,
    title: row.channel_title,
    handle: row.channel_handle,
    description: row.description,
    profileImageUrl: row.profile_image_url,
    categoryTag: row.category,
    subscriberCount: row.subscriber_count,
    videoCount: row.video_count,
    viewCount: row.view_count,
    avgEngagementRate: row.avg_engagement_rate,
    avgViewsPerVideo: row.avg_views_per_video,
    uploadFrequency: row.upload_frequency,
  };
}
