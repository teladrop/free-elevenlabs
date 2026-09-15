import { getAuthClientInstance } from '@/lib/db/auth-client';

export function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export async function getToken(): Promise<string> {
  const client = getAuthClientInstance();
  if (!client) return '';
  const { data } = await client.auth.getSession();
  return data.session?.access_token ?? '';
}

export async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };
}

export type VideoSort   = 'view_count' | 'published_at';
export type SyncStatus  = 'connected' | 'syncing' | 'synced' | 'sync_failed' | 'needs_reauth' | 'disconnected';
export type CompPeriod  = 'week' | 'month' | 'all';
export type CompSort    = 'views' | 'outlier';
export type ChartPeriod = '30' | '60' | '365';
export type ChartMetric = 'views' | 'subscribers' | 'videos';

export interface Competitor {
  id:                  string;
  youtube_channel_id:  string;
  channel_title:       string;
  channel_handle:      string;
  profile_image_url:   string;
  subscriber_count:    number;
  avg_engagement_rate: number;
  avg_views_per_video: number;
  upload_frequency:    number;
  last_fetched_at:     string;
}

export interface CompetitorVideo {
  videoId:         string;
  title:           string;
  thumbnailUrl:    string;
  publishedAt:     string;
  viewCount:       number;
  channelTitle:    string;
  channelHandle:   string;
  channelAvatar:   string;
  subscriberCount: number;
  outlierScore:    number;
  isOwnChannel:    boolean;
}

export interface AISuggestion {
  priority:    'high' | 'medium' | 'low';
  title:       string;
  description: string;
  action:      string;
  impact:      string;
}
