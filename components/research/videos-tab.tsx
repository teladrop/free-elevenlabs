'use client';

import { useState } from 'react';
import type { ResearchSession } from '@/lib/types/research';
import { DataBadge } from './data-badge';
import { formatNumber, timeAgo } from '@/lib/youtube/utils';
import { ExternalLink, Zap } from 'lucide-react';

interface VideosTabProps { session: ResearchSession; }
type SortField = 'views' | 'engagement' | 'age' | 'velocity';
type SortDir   = 'asc' | 'desc';

export function VideosTab({ session }: VideosTabProps) {
  const { youtubeData, metrics } = session;
  const [sort, setSort]           = useState<SortField>('views');
  const [dir,  setDir]            = useState<SortDir>('desc');
  const [onlyBreakouts, setBreakouts] = useState(false);

  if (!metrics) {
    return <Empty message="No video data available" />;
  }

  const videoMap    = new Map(youtubeData.searchResult.videos.map(v => [v.videoId, v]));
  const breakoutSet = new Set(metrics.breakouts.map(b => b.video.videoId));

  let rows = metrics.videoMetrics
    .map(m => ({ video: videoMap.get(m.videoId)!, m, breakout: breakoutSet.has(m.videoId) }))
    .filter(r => r.video);

  if (onlyBreakouts) rows = rows.filter(r => r.breakout);

  rows.sort((a, b) => {
    const vals: Record<SortField, [number, number]> = {
      views:      [a.m.views,          b.m.views],
      engagement: [a.m.engagementRate, b.m.engagementRate],
      age:        [a.m.ageInDays,      b.m.ageInDays],
      velocity:   [a.m.viewsPerDay,    b.m.viewsPerDay],
    };
    const [av, bv] = vals[sort];
    return dir === 'desc' ? bv - av : av - bv;
  });

  const handleSort = (f: SortField) => {
    if (f === sort) setDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSort(f); setDir('desc'); }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-5 py-3 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[hsl(var(--foreground))]">
            {rows.length} videos
            <span className="text-[hsl(var(--muted-foreground))] font-normal ml-2">· {metrics.breakouts.length} breakouts</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DataBadge source="youtube-data" />
          <DataBadge source="calculated" />
          <div className="w-px h-4 bg-[hsl(var(--border))]" />
          <ToggleBtn active={onlyBreakouts} onClick={() => setBreakouts(v => !v)} label="⚡ Breakouts only" />
          <div className="w-px h-4 bg-[hsl(var(--border))]" />
          {(['views','engagement','velocity','age'] as SortField[]).map(f => (
            <SortBtn key={f} label={SORT_LABELS[f]} active={sort === f} dir={sort === f ? dir : undefined} onClick={() => handleSort(f)} />
          ))}
        </div>
      </div>

      {/* Video rows */}
      <div className="space-y-2">
        {rows.map(({ video, m, breakout }, i) => (
          <div
            key={video.videoId}
            className={`rounded-xl border bg-[hsl(var(--card))] flex gap-4 p-4 transition-colors hover:bg-[hsl(var(--surface-hover))] ${
              breakout ? 'border-emerald-500/30' : 'border-[hsl(var(--border))]'
            }`}
          >
            {/* Rank */}
            <div className="shrink-0 w-6 text-center pt-1">
              <span className="text-xs text-[hsl(var(--muted-foreground))] font-medium">{i + 1}</span>
            </div>

            {/* Thumbnail */}
            <div className="shrink-0 relative">
              <img
                src={video.thumbnails.medium.url}
                alt={video.title}
                className="w-36 h-[82px] object-cover rounded-lg"
              />
              {breakout && (
                <span className="absolute -top-1.5 -right-1.5 flex items-center gap-0.5 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  <Zap className="w-2.5 h-2.5" /> BREAKOUT
                </span>
              )}
            </div>

            {/* Meta */}
            <div className="flex-1 min-w-0">
              <a
                href={`https://youtube.com/watch?v=${video.videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary))] line-clamp-2 leading-snug flex items-start gap-1 group"
              >
                <span className="flex-1">{video.title}</span>
                <ExternalLink className="w-3 h-3 mt-0.5 shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
              </a>
              <a
                href={`https://youtube.com/channel/${video.channelId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mt-1 inline-block"
              >
                {video.channelTitle}
              </a>
              <span className="text-xs text-[hsl(var(--muted-foreground))] ml-2">· {timeAgo(video.publishedAt)}</span>

              {/* Metrics strip */}
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
                <Metric label="Views"      value={formatNumber(m.views)} highlight={sort === 'views'} />
                <Metric label="Likes"      value={formatNumber(m.likes)} />
                <Metric label="Comments"   value={formatNumber(m.comments)} />
                <Metric label="Engagement" value={`${m.engagementRate.toFixed(2)}%`} highlight={sort === 'engagement'} />
                <Metric label="Views/day"  value={formatNumber(m.viewsPerDay)} highlight={sort === 'velocity'} />
                {m.viewsToSubsRatio !== null && (
                  <Metric label="Views/sub" value={m.viewsToSubsRatio.toFixed(2)} />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {rows.length === 0 && <Empty message={onlyBreakouts ? 'No breakout videos found' : 'No videos to display'} />}
    </div>
  );
}

const SORT_LABELS: Record<SortField, string> = { views: 'Views', engagement: 'Engagement', velocity: 'Velocity', age: 'Age' };

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
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

function ToggleBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
        active
          ? 'bg-emerald-500/12 text-emerald-400 border-emerald-500/30'
          : 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))] hover:text-[hsl(var(--foreground))]'
      }`}
    >
      {label}
    </button>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-16 text-center">
      <p className="text-sm text-[hsl(var(--muted-foreground))]">{message}</p>
    </div>
  );
}
