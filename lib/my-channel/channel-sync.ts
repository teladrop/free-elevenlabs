/**
 * Channel Sync
 *
 * Syncs the user's own YouTube channel data into Supabase:
 *   1. Channel metadata snapshot
 *   2. Video list (uploads playlist, batched 50 at a time)
 *   3. Daily snapshots for trend tracking
 *
 * Called by:  app/api/my-channel/sync/route.ts
 * Reads from: YouTube Data API v3 (using user's OAuth access token)
 * Writes to:  user_channel_videos, user_channel_snapshots, user_youtube_connections
 *
 * NEVER called from Client Components.
 */

import { getServerAuthClient } from '@/lib/db/auth-server';
import { getValidAccessToken } from './youtube-oauth';

const YT_BASE = 'https://www.googleapis.com/youtube/v3';

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function ytGet(path: string, accessToken: string): Promise<any> {
  const res = await fetch(`${YT_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 401) throw new Error('YouTube token expired');
  if (res.status === 429 || res.status === 403) throw new Error('YouTube quota exceeded');
  if (!res.ok) throw new Error(`YouTube API error (${res.status})`);
  return res.json();
}

/** Get the uploads playlist ID for a channel */
async function getUploadsPlaylistId(channelId: string, accessToken: string): Promise<string> {
  const data = await ytGet(
    `/channels?part=contentDetails&id=${channelId}`,
    accessToken,
  );
  const playlistId = data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!playlistId) throw new Error('Could not find uploads playlist for channel');
  return playlistId;
}

/** Fetch all video IDs from the uploads playlist (paginated, up to maxVideos) */
async function fetchUploadVideoIds(
  playlistId: string,
  accessToken: string,
  maxVideos = 200,
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken = '';

  while (ids.length < maxVideos) {
    const remaining = Math.min(50, maxVideos - ids.length);
    const pageParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
    const data = await ytGet(
      `/playlistItems?part=contentDetails&playlistId=${playlistId}&maxResults=${remaining}${pageParam}`,
      accessToken,
    );

    for (const item of data.items ?? []) {
      const vid = item.contentDetails?.videoId;
      if (vid) ids.push(vid);
    }

    pageToken = data.nextPageToken ?? '';
    if (!pageToken) break;
  }

  return ids;
}

/** Fetch full video details in batches of 50 */
async function fetchVideoDetails(videoIds: string[], accessToken: string): Promise<any[]> {
  const results: any[] = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50).join(',');
    const data = await ytGet(
      `/videos?part=snippet,statistics,contentDetails&id=${batch}`,
      accessToken,
    );
    results.push(...(data.items ?? []));
  }
  return results;
}

// ─── Main sync function ───────────────────────────────────────────────────────

export interface SyncResult {
  videosUpserted:   number;
  snapshotCreated:  boolean;
  error:            string | null;
  syncedAt:         string;
}

export async function syncUserChannel(userId: string): Promise<SyncResult> {
  const db = getServerAuthClient();
  if (!db) return { videosUpserted: 0, snapshotCreated: false, error: 'DB unavailable', syncedAt: new Date().toISOString() };

  const syncedAt = new Date().toISOString();

  try {
    // ── 1. Load connection + tokens ──────────────────────────────────────────
    const { data: conn, error: connErr } = await db
      .from('user_youtube_connections')
      .select('youtube_channel_id, access_token, refresh_token, token_expires_at')
      .eq('user_id', userId)
      .eq('status', 'connected')
      .maybeSingle();

    if (connErr || !conn) throw new Error('No connected YouTube channel found');

    // Mark as syncing
    await db
      .from('user_youtube_connections')
      .update({ status: 'syncing', updated_at: syncedAt })
      .eq('user_id', userId);

    // ── 2. Get a valid access token (auto-refresh if needed) ─────────────────
    const tokenResult = await getValidAccessToken({
      access_token:     conn.access_token,
      refresh_token:    conn.refresh_token,
      token_expires_at: conn.token_expires_at,
    });

    if (tokenResult.refreshed && tokenResult.new_expires_at) {
      await db
        .from('user_youtube_connections')
        .update({
          access_token:     tokenResult.access_token,
          token_expires_at: tokenResult.new_expires_at.toISOString(),
          updated_at:       syncedAt,
        })
        .eq('user_id', userId);
    }

    const accessToken   = tokenResult.access_token;
    const channelId     = conn.youtube_channel_id;

    // ── 3. Fetch channel stats for snapshot ───────────────────────────────────
    const channelData = await ytGet(
      `/channels?part=snippet,statistics&id=${channelId}`,
      accessToken,
    );
    const channelItem = channelData.items?.[0];
    if (!channelItem) throw new Error('Channel not found');

    const subscriberCount = parseInt(channelItem.statistics?.subscriberCount ?? '0', 10);
    const viewCount       = parseInt(channelItem.statistics?.viewCount       ?? '0', 10);
    const videoCountStat  = parseInt(channelItem.statistics?.videoCount      ?? '0', 10);

    // Update channel summary on connection row
    await db
      .from('user_youtube_connections')
      .update({
        channel_title:    channelItem.snippet?.title ?? '',
        channel_handle:   channelItem.snippet?.customUrl ?? '',
        thumbnail_url:    channelItem.snippet?.thumbnails?.medium?.url ?? '',
        subscriber_count: subscriberCount,
        view_count:       viewCount,
        video_count:      videoCountStat,
        updated_at:       syncedAt,
      })
      .eq('user_id', userId);

    // ── 4. Upsert daily channel snapshot ─────────────────────────────────────
    const today = new Date().toISOString().slice(0, 10);
    await db
      .from('user_channel_snapshots')
      .upsert({
        user_id:            userId,
        youtube_channel_id: channelId,
        snapshot_date:      today,
        subscriber_count:   subscriberCount,
        view_count:         viewCount,
        video_count:        videoCountStat,
      }, { onConflict: 'user_id,youtube_channel_id,snapshot_date' });

    // ── 5. Fetch video IDs from uploads playlist ──────────────────────────────
    const uploadsPlaylistId = await getUploadsPlaylistId(channelId, accessToken);
    const videoIds          = await fetchUploadVideoIds(uploadsPlaylistId, accessToken, 200);

    // ── 6. Fetch video details in batches ─────────────────────────────────────
    const videoItems = await fetchVideoDetails(videoIds, accessToken);

    // ── 7. Upsert videos ──────────────────────────────────────────────────────
    let videosUpserted = 0;
    const CHUNK = 50;
    for (let i = 0; i < videoItems.length; i += CHUNK) {
      const chunk = videoItems.slice(i, i + CHUNK).map(item => ({
        user_id:            userId,
        youtube_video_id:   item.id,
        youtube_channel_id: channelId,
        title:              (item.snippet?.title ?? '').slice(0, 500),
        description:        (item.snippet?.description ?? '').slice(0, 1000),
        published_at:       item.snippet?.publishedAt ?? null,
        thumbnail_url:      item.snippet?.thumbnails?.medium?.url
                         ?? item.snippet?.thumbnails?.default?.url
                         ?? '',
        duration:           item.contentDetails?.duration ?? '',
        view_count:         parseInt(item.statistics?.viewCount    ?? '0', 10),
        like_count:         parseInt(item.statistics?.likeCount    ?? '0', 10),
        comment_count:      parseInt(item.statistics?.commentCount ?? '0', 10),
        last_synced_at:     syncedAt,
      }));

      const { error: upsertErr } = await db
        .from('user_channel_videos')
        .upsert(chunk, { onConflict: 'user_id,youtube_video_id' });

      if (!upsertErr) videosUpserted += chunk.length;
    }

    // ── 8. Upsert video snapshots for today ───────────────────────────────────
    const snapshots = videoItems.map(item => ({
      user_id:          userId,
      youtube_video_id: item.id,
      snapshot_date:    today,
      view_count:       parseInt(item.statistics?.viewCount    ?? '0', 10),
      like_count:       parseInt(item.statistics?.likeCount    ?? '0', 10),
      comment_count:    parseInt(item.statistics?.commentCount ?? '0', 10),
    }));
    for (let i = 0; i < snapshots.length; i += CHUNK) {
      await db
        .from('user_video_snapshots')
        .upsert(snapshots.slice(i, i + CHUNK), {
          onConflict: 'user_id,youtube_video_id,snapshot_date',
        });
    }

    // ── 9. Mark sync complete ─────────────────────────────────────────────────
    await db
      .from('user_youtube_connections')
      .update({
        status:        'synced',
        last_synced_at: syncedAt,
        sync_error:    null,
        updated_at:    syncedAt,
      })
      .eq('user_id', userId);

    console.log(`[ChannelSync] ✓ user=${userId} videos=${videosUpserted}`);

    return { videosUpserted, snapshotCreated: true, error: null, syncedAt };

  } catch (err: any) {
    const msg = err.message ?? 'Unknown sync error';
    console.error('[ChannelSync] error:', msg);

    // Mark sync failed
    await db?.from('user_youtube_connections')
      .update({ status: 'sync_failed', sync_error: msg.slice(0, 500), updated_at: syncedAt })
      .eq('user_id', userId);

    return { videosUpserted: 0, snapshotCreated: false, error: msg, syncedAt };
  }
}

// ─── Read helpers (used by the page) ─────────────────────────────────────────

export async function getConnectionForUser(userId: string) {
  const db = getServerAuthClient();
  if (!db) return null;
  const { data } = await db
    .from('user_youtube_connections')
    .select(`
      youtube_channel_id, channel_title, channel_handle, thumbnail_url,
      subscriber_count, video_count, view_count,
      status, connected_at, last_synced_at, sync_error
    `)   // ← deliberately excludes access_token and refresh_token
    .eq('user_id', userId)
    .maybeSingle();
  return data ?? null;
}

export async function getVideosForUser(userId: string, limit = 50, orderBy: 'published_at' | 'view_count' = 'published_at') {
  const db = getServerAuthClient();
  if (!db) return [];
  const { data } = await db
    .from('user_channel_videos')
    .select('youtube_video_id, title, published_at, thumbnail_url, duration, view_count, like_count, comment_count')
    .eq('user_id', userId)
    .order(orderBy, { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getChannelSnapshots(userId: string, days = 30) {
  const db = getServerAuthClient();
  if (!db) return [];
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const { data } = await db
    .from('user_channel_snapshots')
    .select('snapshot_date, subscriber_count, view_count, video_count')
    .eq('user_id', userId)
    .gte('snapshot_date', since)
    .order('snapshot_date', { ascending: true });
  return data ?? [];
}
