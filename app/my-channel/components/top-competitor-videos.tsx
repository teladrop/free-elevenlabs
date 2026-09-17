'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { PlayCircle, RefreshCw, ChevronDown, AlertCircle, ExternalLink, TrendingUp } from 'lucide-react';
import { formatNumber, timeAgo } from '@/lib/youtube/utils';
import { authHeaders, cn, CompPeriod, CompSort, CompetitorVideo, Competitor } from './helpers';
import { Toggle, OutlierBadge, TabBtn } from './ui-atoms';

export function TopCompetitorVideos() {
  const [videos,     setVideos]     = useState<CompetitorVideo[]>([]);
  const [fallback,   setFallback]   = useState<Competitor[]>([]);  // competitor channel cards if no API key
  const [loading,    setLoading]    = useState(true);
  const [period,     setPeriod]     = useState<CompPeriod>('month');
  const [sortBy,     setSortBy]     = useState<CompSort>('views');
  const [includeOwn, setIncludeOwn] = useState(false);
  const [lastFetch,  setLastFetch]  = useState<Date | null>(null);
  const [noApiKey,   setNoApiKey]   = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    setNoApiKey(false);
    try {
      const hdrs = await authHeaders();
      const params = new URLSearchParams({ sortBy, period, includeOwn: String(includeOwn), limit: '15' });
      const res = await fetch(`/api/my-channel/competitor-videos?${params}`, { headers: hdrs });
      const d = await res.json();

      if (!res.ok) {
        // YouTube API key not configured — fall back to showing stored competitor channels
        if (res.status === 500 && d.error?.includes('API key')) {
          setNoApiKey(true);
          // Load stored competitors as fallback
          const compRes = await fetch('/api/my-channel/competitors', { headers: hdrs });
          const compD   = await compRes.json();
          setFallback(compD.competitors ?? []);
        }
        return;
      }

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
          <div>
            <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">
              Top Videos From Your Competitors
            </h2>
            {lastFetch && (
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] hidden sm:block">
                Updated {timeAgo(lastFetch.toISOString())}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Toggle enabled={includeOwn} onChange={setIncludeOwn} label="Include my channel" />
          <button onClick={fetchVideos}
            className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-white/5 transition-colors disabled:opacity-40">
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Filters — only show when we have video data */}
      {!noApiKey && (
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
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col gap-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-[hsl(var(--background))] animate-pulse" />
          ))}
        </div>
      )}

      {/* No API key — show competitor channel cards instead */}
      {!loading && noApiKey && (
        <div>
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-amber-400 font-semibold">YouTube API key not configured</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                Add <code className="bg-white/8 px-1 rounded">YOUTUBE_API_KEY</code> in Settings to see individual videos.
                Showing stored competitor channel stats instead.
              </p>
            </div>
          </div>

          {fallback.length === 0 ? (
            <div className="text-center py-10 text-[hsl(var(--muted-foreground))]">
              <PlayCircle className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No competitors added yet</p>
              <p className="text-xs mt-1 opacity-70">Add competitor channels in the section above.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {fallback.map(comp => (
                <a key={comp.id}
                  href={`https://youtube.com/${comp.channel_handle || 'channel/' + comp.youtube_channel_id}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 hover:border-[hsl(var(--primary))/30] hover:bg-[hsl(var(--surface-elevated))] transition-all group"
                >
                  {comp.profile_image_url ? (
                    <img src={comp.profile_image_url} alt={comp.channel_title}
                      className="w-10 h-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center shrink-0 text-sm font-bold text-white">
                      {comp.channel_title[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[hsl(var(--foreground))] group-hover:text-[hsl(var(--primary))] transition-colors truncate">
                      {comp.channel_title}
                    </p>
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
                      {formatNumber(comp.subscriber_count)} subs · {comp.avg_engagement_rate.toFixed(1)}% engagement
                      {comp.upload_frequency > 0 && ` · ${comp.upload_frequency.toFixed(1)} videos/mo`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-bold text-[hsl(var(--foreground))]">
                      {formatNumber(comp.avg_views_per_video)}
                    </div>
                    <div className="text-[10px] text-[hsl(var(--muted-foreground))]">avg views</div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Videos list */}
      {!loading && !noApiKey && (
        <>
          {videos.length === 0 ? (
            <div className="text-center py-10 text-[hsl(var(--muted-foreground))]">
              <PlayCircle className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No competitor videos found</p>
              <p className="text-xs mt-1 opacity-70">Add competitors and ensure a YouTube API key is configured.</p>
            </div>
          ) : (
            <>
              {/* Column headers */}
              <div className="grid grid-cols-[56px_1fr_80px_80px] gap-3 px-2 pb-2 mb-1 border-b border-[hsl(var(--border))]">
                <div />
                <div className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Video</div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] text-right">Views</div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] text-right">Outlier</div>
              </div>
              <div className="space-y-1.5">
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
                          {vid.channelTitle} · {formatNumber(vid.subscriberCount)} subs
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
            </>
          )}
        </>
      )}
    </div>
  );
}
