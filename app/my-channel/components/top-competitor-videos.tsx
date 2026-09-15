'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { PlayCircle, RefreshCw, ChevronDown } from 'lucide-react';
import { formatNumber, timeAgo } from '@/lib/youtube/utils';
import { authHeaders, cn, CompPeriod, CompSort, CompetitorVideo } from './helpers';
import { Toggle, OutlierBadge, TabBtn } from './ui-atoms';

export function TopCompetitorVideos() {
  const [videos,     setVideos]     = useState<CompetitorVideo[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [period,     setPeriod]     = useState<CompPeriod>('month');
  const [sortBy,     setSortBy]     = useState<CompSort>('views');
  const [includeOwn, setIncludeOwn] = useState(false);
  const [lastFetch,  setLastFetch]  = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    try {
      const hdrs = await authHeaders();
      const params = new URLSearchParams({ sortBy, period, includeOwn: String(includeOwn), limit: '15' });
      const res = await fetch(`/api/my-channel/competitor-videos?${params}`, { headers: hdrs });
      if (!res.ok) return;
      const d = await res.json();
      setVideos(d.videos ?? []);
      setLastFetch(new Date());
    } catch {}
    finally { setLoading(false); }
  }, [sortBy, period, includeOwn]);

  useEffect(() => { fetchVideos(); }, [fetchVideos]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    timerRef.current = setInterval(fetchVideos, 5 * 60 * 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchVideos]);

  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center">
            <PlayCircle className="w-3.5 h-3.5 text-red-400" />
          </div>
          <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">
            Top Videos From Your Competitors
          </h2>
          {lastFetch && (
            <span className="text-[10px] text-[hsl(var(--muted-foreground))] hidden sm:block">
              · updated {timeAgo(lastFetch.toISOString())}
            </span>
          )}
        </div>
        <Toggle enabled={includeOwn} onChange={setIncludeOwn} label="Include my channel" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <div className="relative">
          <select value={sortBy} onChange={e => setSortBy(e.target.value as CompSort)}
            className="appearance-none pl-3 pr-7 h-8 rounded-xl bg-[hsl(var(--background))] border border-[hsl(var(--border))] text-xs text-[hsl(var(--foreground))] cursor-pointer focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]">
            <option value="views">Views</option>
            <option value="outlier">Outlier Score</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[hsl(var(--muted-foreground))] pointer-events-none" />
        </div>
        <div className="relative">
          <select value={period} onChange={e => setPeriod(e.target.value as CompPeriod)}
            className="appearance-none pl-3 pr-7 h-8 rounded-xl bg-[hsl(var(--background))] border border-[hsl(var(--border))] text-xs text-[hsl(var(--foreground))] cursor-pointer focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]">
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="all">All time</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[hsl(var(--muted-foreground))] pointer-events-none" />
        </div>
        <button onClick={fetchVideos}
          className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-[hsl(var(--border))] text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
          <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} /> Refresh
        </button>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[56px_1fr_80px_80px] gap-3 px-2 pb-2 border-b border-[hsl(var(--border))]">
        <div />
        <div className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Videos</div>
        <div className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] text-right">Views</div>
        <div className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] text-right">Outlier Score</div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col gap-2 mt-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-[hsl(var(--background))] animate-pulse" />
          ))}
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center py-10 text-[hsl(var(--muted-foreground))]">
          <PlayCircle className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">No competitor videos found</p>
          <p className="text-xs mt-1 opacity-70">Add competitors, then check back for their top videos.</p>
        </div>
      ) : (
        <div className="space-y-1.5 mt-2">
          {videos.map((vid) => (
            <a key={vid.videoId}
              href={`https://youtube.com/watch?v=${vid.videoId}`}
              target="_blank" rel="noopener noreferrer"
              className={cn(
                'grid grid-cols-[56px_1fr_80px_80px] gap-3 items-center rounded-xl border px-2 py-2 hover:bg-white/3 transition-colors group',
                vid.isOwnChannel
                  ? 'border-[hsl(var(--primary))/30] bg-[hsl(var(--primary))/5]'
                  : 'border-[hsl(var(--border))] bg-[hsl(var(--background))]',
              )}
            >
              {vid.thumbnailUrl ? (
                <img src={vid.thumbnailUrl} alt="" className="w-14 h-10 rounded-lg object-cover" />
              ) : (
                <div className="w-14 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                  <PlayCircle className="w-5 h-5 text-zinc-600" />
                </div>
              )}

              <div className="min-w-0">
                <p className="text-xs font-semibold text-[hsl(var(--foreground))] line-clamp-2 leading-snug group-hover:text-[hsl(var(--primary))] transition-colors">
                  {vid.title}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  {vid.channelAvatar && (
                    <img src={vid.channelAvatar} alt="" className="w-3.5 h-3.5 rounded-full shrink-0" />
                  )}
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                    {vid.channelTitle} · {formatNumber(vid.subscriberCount)} subscribers
                  </span>
                  {vid.publishedAt && (
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                      · {timeAgo(vid.publishedAt)}
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm font-bold text-[hsl(var(--foreground))]">
                  {formatNumber(vid.viewCount)}
                </div>
              </div>

              <div className="flex justify-end">
                <OutlierBadge score={vid.outlierScore} />
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
