'use client';

import { useState } from 'react';
import type { ResearchSession } from '@/lib/types/research';
import { DataBadge } from './data-badge';
import { formatNumber, timeAgo } from '@/lib/youtube/utils';
import { ExternalLink, Users, TrendingUp, BarChart2, Video } from 'lucide-react';

interface ChannelsTabProps { session: ResearchSession; }
type SortField = 'subscribers' | 'avgViews' | 'videos' | 'engagement';
type SortDir   = 'asc' | 'desc';

export function ChannelsTab({ session }: ChannelsTabProps) {
  const { youtubeData, metrics } = session;
  const [sort, setSort] = useState<SortField>('subscribers');
  const [dir,  setDir]  = useState<SortDir>('desc');

  const channels = youtubeData.searchResult.channels;
  const channelMetricsMap = new Map(
    (metrics?.channelMetrics ?? []).map(cm => [cm.channelId, cm])
  );

  // Build sorted rows
  const rows = channels
    .map(ch => ({
      channel: ch,
      cm: channelMetricsMap.get(ch.channelId),
      subs: parseInt(ch.statistics.subscriberCount || '0'),
      vidCount: parseInt(ch.statistics.videoCount || '0'),
    }))
    .sort((a, b) => {
      let av: number, bv: number;
      switch (sort) {
        case 'subscribers': av = a.subs;                              bv = b.subs;                              break;
        case 'avgViews':    av = a.cm?.avgViewsPerVideo ?? 0;         bv = b.cm?.avgViewsPerVideo ?? 0;         break;
        case 'videos':      av = a.vidCount;                          bv = b.vidCount;                          break;
        case 'engagement':  av = a.cm?.avgEngagementRate ?? 0;        bv = b.cm?.avgEngagementRate ?? 0;        break;
      }
      return dir === 'desc' ? bv - av : av - bv;
    });

  const handleSort = (f: SortField) => {
    if (f === sort) setDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSort(f); setDir('desc'); }
  };

  // Quick stats from all channels
  const totalSubs     = channels.reduce((s, c) => s + parseInt(c.statistics.subscriberCount || '0'), 0);
  const maxSubs       = Math.max(...channels.map(c => parseInt(c.statistics.subscriberCount || '0')), 1);
  const avgEngagement = metrics?.channelMetrics.length
    ? metrics.channelMetrics.reduce((s, c) => s + c.avgEngagementRate, 0) / metrics.channelMetrics.length
    : 0;

  if (channels.length === 0) {
    return (
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-16 text-center">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">No channel data found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard icon={<Users className="w-4 h-4" />}     label="Channels"       value={String(channels.length)}       color="blue" />
        <SummaryCard icon={<TrendingUp className="w-4 h-4" />} label="Total Subs"    value={formatNumber(totalSubs)}        color="purple" />
        <SummaryCard icon={<BarChart2 className="w-4 h-4" />}  label="Avg Engagement" value={`${avgEngagement.toFixed(2)}%`} color="amber" />
        <SummaryCard icon={<Video className="w-4 h-4" />}      label="Largest Channel" value={formatNumber(maxSubs) + ' subs'} color="emerald" />
      </div>

      {/* Toolbar */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-5 py-3 flex items-center gap-3 flex-wrap">
        <p className="text-sm font-semibold text-[hsl(var(--foreground))] flex-1">{rows.length} channels</p>
        <DataBadge source="youtube-data" />
        <DataBadge source="calculated" />
        <div className="w-px h-4 bg-[hsl(var(--border))]" />
        {(['subscribers','avgViews','engagement','videos'] as SortField[]).map(f => (
          <SortBtn key={f} label={SORT_LABELS[f]} active={sort === f} dir={sort === f ? dir : undefined} onClick={() => handleSort(f)} />
        ))}
      </div>

      {/* Channel cards */}
      <div className="space-y-2">
        {rows.map(({ channel, cm, subs }, i) => {
          const subsWidth = Math.max(2, Math.round((subs / maxSubs) * 100));
          return (
            <div key={channel.channelId}
              className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] flex gap-4 p-4 hover:bg-[hsl(var(--surface-hover))] transition-colors"
            >
              {/* Rank */}
              <div className="shrink-0 w-6 text-center pt-1">
                <span className="text-xs text-[hsl(var(--muted-foreground))] font-medium">{i + 1}</span>
              </div>

              {/* Avatar */}
              <div className="shrink-0">
                {channel.thumbnails?.default?.url ? (
                  <img src={channel.thumbnails.default.url} alt={channel.title}
                    className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[hsl(var(--surface-elevated))] flex items-center justify-center">
                    <Users className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <a href={`https://youtube.com/channel/${channel.channelId}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-sm font-semibold text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary))] flex items-center gap-1 group"
                    >
                      {channel.title}
                      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                    </a>
                    {channel.description && (
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 line-clamp-1">{channel.description}</p>
                    )}
                  </div>
                  {/* Authority score — use subs as proxy since no authorityScore field */}
                  {cm && (
                    <div className="shrink-0 text-right">
                      <div className={`text-base font-bold ${authorityColor(Math.min(100, Math.round(cm.subscribers / 10000)))}`}>
                        {formatNumber(cm.subscribers)}
                      </div>
                      <div className="text-[10px] text-[hsl(var(--muted-foreground))]">subscribers</div>
                    </div>
                  )}
                </div>

                {/* Sub bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-[10px] text-[hsl(var(--muted-foreground))] mb-1">
                    <span>{formatNumber(subs)} subscribers</span>
                    <span>{subsWidth}% of top</span>
                  </div>
                  <div className="h-1 rounded-full bg-[hsl(var(--border))]">
                    <div className="h-1 rounded-full bg-[hsl(var(--primary))]" style={{ width: `${subsWidth}%` }} />
                  </div>
                </div>

                {/* Metric chips */}
                <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                  <Chip label="Videos"   value={formatNumber(parseInt(channel.statistics.videoCount || '0'))} />
                  <Chip label="Joined"   value={channel.publishedAt ? timeAgo(channel.publishedAt) : '—'} />
                  {cm && <>
                    <Chip label="Avg views"  value={formatNumber(cm.avgViewsPerVideo)}   highlight={sort === 'avgViews'} />
                    <Chip label="Engagement" value={`${cm.avgEngagementRate.toFixed(2)}%`} highlight={sort === 'engagement'} />
                    <Chip label="Best video" value={cm.bestVideo ? formatNumber(parseInt(cm.bestVideo.statistics.viewCount)) + ' views' : '—'} />
                    {cm.uploadFrequency && (
                      <Chip label="Frequency" value={`${cm.uploadFrequency.toFixed(1)}/wk`} />
                    )}
                  </>}
                </div>

                {/* Best video */}
                {cm?.bestVideo && (
                  <div className="mt-3 rounded-lg bg-[hsl(var(--surface-elevated))] px-3 py-2 text-xs">
                    <span className="text-[hsl(var(--muted-foreground))]">Best: </span>
                    <a
                      href={`https://youtube.com/watch?v=${cm.bestVideo.videoId}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary))] font-medium line-clamp-1"
                    >
                      {cm.bestVideo.title}
                    </a>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const SORT_LABELS: Record<SortField, string> = {
  subscribers: 'Subscribers', avgViews: 'Avg Views', engagement: 'Engagement', videos: 'Videos',
};

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: 'blue'|'purple'|'amber'|'emerald' }) {
  const bg = { blue:'bg-blue-500/10 text-blue-400', purple:'bg-purple-500/10 text-purple-400', amber:'bg-amber-500/10 text-amber-400', emerald:'bg-emerald-500/10 text-emerald-400' }[color];
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-3`}>{icon}</div>
      <div className="text-xl font-bold text-[hsl(var(--foreground))]">{value}</div>
      <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{label}</div>
    </div>
  );
}

function Chip({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{label}</div>
      <div className={`text-xs font-semibold ${highlight ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--foreground))]'}`}>{value}</div>
    </div>
  );
}

function SortBtn({ label, active, dir, onClick }: { label: string; active: boolean; dir?: SortDir; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
        active
          ? 'bg-[hsl(var(--primary))/12] text-[hsl(var(--primary))] border-[hsl(var(--primary))/30]'
          : 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))] hover:text-[hsl(var(--foreground))]'
      }`}
    >
      {label}{active && <span className="ml-0.5 opacity-70">{dir === 'desc' ? '↓' : '↑'}</span>}
    </button>
  );
}

function authorityColor(s: number) {
  if (s >= 70) return 'text-emerald-400';
  if (s >= 40) return 'text-amber-400';
  return 'text-[hsl(var(--muted-foreground))]';
}
