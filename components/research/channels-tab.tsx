'use client';

import { useState, useMemo } from 'react';
import type { ResearchSession, ChannelMetrics, YouTubeChannel } from '@/lib/types/research';
import { DataBadge } from './data-badge';
import { formatNumber, timeAgo } from '@/lib/youtube/utils';
import { ExternalLink, Users, TrendingUp, BarChart2, Video, Star, Eye, Zap, DollarSign } from 'lucide-react';

interface ChannelsTabProps { session: ResearchSession; }

type SortField = 'subscribers' | 'totalViews' | 'avgViews' | 'engagement' | 'opportunity' | 'videos' | 'earnings';
type SortDir   = 'asc' | 'desc';
type SizeFilter = 'all' | 'nano' | 'micro' | 'mid' | 'large' | 'mega';

// ─── Estimated earnings ───────────────────────────────────────────────────────
// YouTube doesn't expose real earnings through its public API. We estimate
// using the same methodology as VidIQ:
//
//   earnings = (views / 1000) × CPM × 0.55
//
// The 0.55 is the creator's revenue share after YouTube's cut.
// CPM = advertiser cost per 1,000 impressions (what brands pay YouTube).
//
// CPM ranges by channel size (2023–2024 industry benchmarks):
//   Nano  (<10K subs)   $1.00 – $3.00   low advertiser demand
//   Micro (10–100K)     $2.00 – $5.00   growing reach
//   Mid   (100K–1M)     $3.00 – $7.00   brand-deal sweet spot
//   Large (1M–10M)      $4.00 – $10.00  premium inventory
//   Mega  (10M+)        $5.00 – $12.00  top-tier
//
// Monthly views = avgViewsPerVideo × uploadFrequency (videos/month).
// Falls back to totalViews / videoCount / 12 if frequency is unavailable.
// Yearly = monthly × 12.

interface EarningsEstimate {
  monthlyLow:   number;
  monthlyHigh:  number;
  yearlyLow:    number;
  yearlyHigh:   number;
  monthlyViews: number;
}

const CPM: Record<SizeFilter, [number, number]> = {
  all:   [2.00,  6.00],
  nano:  [1.00,  3.00],
  micro: [2.00,  5.00],
  mid:   [3.00,  7.00],
  large: [4.00, 10.00],
  mega:  [5.00, 12.00],
};

// Creator keeps 55% of ad revenue (YouTube takes 45%)
const CREATOR_SHARE = 0.55;

function estimateEarnings(
  tier: SizeFilter,
  totalViews: number,
  avgViewsPerVideo: number,
  uploadFrequency: number,
  videoCount: number,
): EarningsEstimate {
  const [cpmLow, cpmHigh] = CPM[tier] ?? CPM.all;

  const monthlyViews = uploadFrequency > 0
    ? avgViewsPerVideo * uploadFrequency
    : videoCount > 0
      ? totalViews / videoCount / 12
      : 0;

  const monthlyLow  = Math.round(monthlyViews / 1000 * cpmLow  * CREATOR_SHARE);
  const monthlyHigh = Math.round(monthlyViews / 1000 * cpmHigh * CREATOR_SHARE);

  return {
    monthlyLow,
    monthlyHigh,
    yearlyLow:    monthlyLow  * 12,
    yearlyHigh:   monthlyHigh * 12,
    monthlyViews: Math.round(monthlyViews),
  };
}

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n}`;
}

// ─── Small-creator opportunity score ──────────────────────────────────────────
// Deterministic formula — no AI, no invented numbers.
//
// A channel is a "small creator opportunity" when:
//   • engagement is high relative to its subscriber count
//     (audience is active but channel hasn't blown up yet)
//   • it has a reasonable number of videos (not brand-new)
//   • its avg views / subscriber ratio is decent (content resonates)
//
// Score = 0–100, calculated from real data already in ChannelMetrics.
//
// Formula:
//   engagementFactor = min(cm.avgEngagementRate / 5, 1) × 40     (5% = max)
//   viewsRatioFactor = min(cm.avgViewsPerVideo / subs, 1) × 35   (1:1 = max)
//   activityFactor   = min(cm.videoCount / 50, 1) × 15           (50 vids = max)
//   freshnessFactor  = recentUploads >= 1 ? 10 : 0               (active recently)
//
// Only meaningful for channels with subs < 200 000 (above that they're not "small").

function calcOpportunityScore(
  cm: ChannelMetrics,
  subs: number,
): number {
  if (subs <= 0) return 0;

  const engagementFactor = Math.min(cm.avgEngagementRate / 5, 1) * 40;
  const viewsRatioFactor = Math.min(cm.avgViewsPerVideo / Math.max(subs, 1), 1) * 35;
  const activityFactor   = Math.min(cm.videoCount / 50, 1) * 15;
  const freshnessFactor  = (cm.recentUploads ?? 0) >= 1 ? 10 : 0;

  const raw = engagementFactor + viewsRatioFactor + activityFactor + freshnessFactor;
  return Math.min(100, Math.round(raw));
}

// ─── Channel size tiers ───────────────────────────────────────────────────────
type SizeTier = { label: string; min: number; max: number; color: string; bg: string };

const SIZE_TIERS: Record<SizeFilter, SizeTier> = {
  all:   { label: 'All',          min: 0,          max: Infinity,   color: 'text-[hsl(var(--foreground))]',    bg: 'bg-[hsl(var(--surface-elevated))]' },
  nano:  { label: 'Nano <10K',    min: 1_000,      max: 10_000,     color: 'text-emerald-400',                bg: 'bg-emerald-500/10' },
  micro: { label: 'Micro 10–100K',min: 10_000,     max: 100_000,    color: 'text-sky-400',                    bg: 'bg-sky-500/10' },
  mid:   { label: 'Mid 100K–1M',  min: 100_000,    max: 1_000_000,  color: 'text-blue-400',                   bg: 'bg-blue-500/10' },
  large: { label: 'Large 1M–10M', min: 1_000_000,  max: 10_000_000, color: 'text-purple-400',                 bg: 'bg-purple-500/10' },
  mega:  { label: 'Mega 10M+',    min: 10_000_000, max: Infinity,   color: 'text-amber-400',                  bg: 'bg-amber-500/10' },
};

function getSizeTier(subs: number): SizeFilter {
  if (subs >= 10_000_000) return 'mega';
  if (subs >= 1_000_000)  return 'large';
  if (subs >= 100_000)    return 'mid';
  if (subs >= 10_000)     return 'micro';
  return 'nano';
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ChannelsTab({ session }: ChannelsTabProps) {
  const { youtubeData, metrics } = session;
  const [sort,       setSort]       = useState<SortField>('subscribers');
  const [dir,        setDir]        = useState<SortDir>('desc');
  const [sizeFilter, setSizeFilter] = useState<SizeFilter>('all');
  const [showCount,  setShowCount]  = useState(50);

  const channels = youtubeData.searchResult.channels;
  const channelMetricsMap = useMemo(
    () => new Map((metrics?.channelMetrics ?? []).map(cm => [cm.channelId, cm])),
    [metrics],
  );

  // ── Enriched rows (memoised) ─────────────────────────────────────────────
  const allRows = useMemo(() => channels.map(ch => {
    const cm   = channelMetricsMap.get(ch.channelId);
    const subs = parseInt(ch.statistics.subscriberCount || '0', 10);
    const totalViews = parseInt(ch.statistics.viewCount || '0', 10);
    const vidCount   = parseInt(ch.statistics.videoCount || '0', 10);
    const opp  = cm ? calcOpportunityScore(cm, subs) : 0;
    const tier = getSizeTier(subs);
    const earnings = estimateEarnings(
      tier,
      totalViews,
      cm?.avgViewsPerVideo ?? 0,
      cm?.uploadFrequency  ?? 0,
      vidCount,
    );
    return { channel: ch, cm, subs, totalViews, opp, tier, earnings };
  }), [channels, channelMetricsMap]);

  // ── Filter by size tier ──────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    if (sizeFilter === 'all') return allRows;
    const tier = SIZE_TIERS[sizeFilter];
    return allRows.filter(r => r.subs >= tier.min && r.subs < tier.max);
  }, [allRows, sizeFilter]);

  // ── Sort ─────────────────────────────────────────────────────────────────
  const sortedRows = useMemo(() => [...filteredRows].sort((a, b) => {
    let av = 0, bv = 0;
    switch (sort) {
      case 'subscribers': av = a.subs;                              bv = b.subs;                              break;
      case 'totalViews':  av = a.totalViews;                        bv = b.totalViews;                        break;
      case 'avgViews':    av = a.cm?.avgViewsPerVideo ?? 0;         bv = b.cm?.avgViewsPerVideo ?? 0;         break;
      case 'engagement':  av = a.cm?.avgEngagementRate ?? 0;        bv = b.cm?.avgEngagementRate ?? 0;        break;
      case 'opportunity': av = a.opp;                               bv = b.opp;                               break;
      case 'earnings':    av = a.earnings.monthlyLow;               bv = b.earnings.monthlyLow;               break;
      case 'videos':      av = parseInt(a.channel.statistics.videoCount || '0', 10);
                          bv = parseInt(b.channel.statistics.videoCount || '0', 10); break;
    }
    return dir === 'desc' ? bv - av : av - bv;
  }), [filteredRows, sort, dir]);

  const visibleRows = sortedRows.slice(0, showCount);

  // ── Summary stats ────────────────────────────────────────────────────────
  const totalSubs     = channels.reduce((s, c) => s + parseInt(c.statistics.subscriberCount || '0', 10), 0);
  const maxSubs       = Math.max(...channels.map(c => parseInt(c.statistics.subscriberCount || '0', 10)), 1);
  const avgEngagement = metrics?.channelMetrics.length
    ? metrics.channelMetrics.reduce((s, c) => s + c.avgEngagementRate, 0) / metrics.channelMetrics.length
    : 0;
  const smallOpps = allRows.filter(r => r.subs < 200_000 && r.opp >= 60).length;

  const handleSort = (f: SortField) => {
    if (f === sort) setDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSort(f); setDir('desc'); }
  };

  if (channels.length === 0) {
    return (
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-16 text-center">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">No channel data found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── Summary strip ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard icon={<Users     className="w-4 h-4" />} label="Channels"         value={String(channels.length)}        color="blue" />
        <SummaryCard icon={<TrendingUp className="w-4 h-4" />} label="Total Subs"      value={formatNumber(totalSubs)}         color="purple" />
        <SummaryCard icon={<Eye       className="w-4 h-4" />} label="Avg Engagement"   value={`${avgEngagement.toFixed(2)}%`}  color="amber" />
        <SummaryCard icon={<Star      className="w-4 h-4" />} label="Small Opp (≥60)"  value={String(smallOpps)}               color="emerald" />
      </div>

      {/* ── Toolbar ───────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-5 py-3 space-y-3">

        {/* Row 1: counts + badges */}
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-sm font-semibold text-[hsl(var(--foreground))] flex-1">
            {sortedRows.length} channels
            {sizeFilter !== 'all' && (
              <span className="ml-1.5 text-xs font-normal text-[hsl(var(--muted-foreground))]">
                (filtered from {allRows.length})
              </span>
            )}
          </p>
          <DataBadge source="youtube-data" />
          <DataBadge source="calculated" />
        </div>

        {/* Row 2: size filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-[hsl(var(--muted-foreground))] font-medium uppercase tracking-wide shrink-0">
            Size:
          </span>
          {(Object.entries(SIZE_TIERS) as [SizeFilter, SizeTier][]).map(([key, tier]) => {
            const count = key === 'all' ? allRows.length : allRows.filter(r => r.tier === key).length;
            const active = sizeFilter === key;
            return (
              <button key={key} onClick={() => setSizeFilter(key)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  active
                    ? `${tier.bg} ${tier.color} border-current/30`
                    : 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))] hover:text-[hsl(var(--foreground))]'
                }`}
              >
                {tier.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Row 3: sort buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-[hsl(var(--muted-foreground))] font-medium uppercase tracking-wide shrink-0">
            Sort:
          </span>
          {(Object.keys(SORT_LABELS) as SortField[]).map(f => (
            <SortBtn key={f} label={SORT_LABELS[f]} active={sort === f}
              dir={sort === f ? dir : undefined} onClick={() => handleSort(f)} />
          ))}
        </div>
      </div>

      {/* ── Channel cards ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        {visibleRows.map(({ channel, cm, subs, totalViews, opp, tier, earnings }, i) => {
          const subsWidth     = Math.max(2, Math.round((subs / maxSubs) * 100));
          const tierMeta      = SIZE_TIERS[tier];
          const isSmallOpp    = subs < 200_000 && opp >= 60;

          return (
            <div key={channel.channelId}
              className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] flex gap-4 p-4 hover:bg-[hsl(var(--surface-hover))] transition-colors"
            >
              {/* Rank */}
              <div className="shrink-0 w-6 text-center pt-1">
                <span className="text-xs text-[hsl(var(--muted-foreground))] font-medium">
                  {i + 1}
                </span>
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

              {/* Body */}
              <div className="flex-1 min-w-0">

                {/* Title row */}
                <div className="flex items-start justify-between gap-4 mb-1.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <a href={`https://youtube.com/channel/${channel.channelId}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-sm font-semibold text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary))] flex items-center gap-1 group"
                      >
                        {channel.title}
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                      </a>
                      {/* Size tier badge */}
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tierMeta.bg} ${tierMeta.color}`}>
                        {tierMeta.label}
                      </span>
                      {/* Small creator opportunity badge */}
                      {isSmallOpp && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center gap-0.5">
                          <Zap className="w-2.5 h-2.5" /> Small Opp
                        </span>
                      )}
                    </div>
                    {channel.description && (
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 line-clamp-1">
                        {channel.description}
                      </p>
                    )}
                  </div>

                  {/* Subscriber count (right) */}
                  <div className="shrink-0 text-right">
                    <div className={`text-base font-bold ${tierMeta.color}`}>
                      {formatNumber(subs)}
                    </div>
                    <div className="text-[10px] text-[hsl(var(--muted-foreground))]">subscribers</div>
                  </div>
                </div>

                {/* Sub bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-[10px] text-[hsl(var(--muted-foreground))] mb-1">
                    <span>{formatNumber(subs)} subs · {formatNumber(totalViews)} total views</span>
                    <span>{subsWidth}% of top</span>
                  </div>
                  <div className="h-1 rounded-full bg-[hsl(var(--border))]">
                    <div className={`h-1 rounded-full ${tierMeta.bg.replace('bg-', 'bg-').replace('/10', '/60')}`}
                      style={{ width: `${subsWidth}%` }} />
                  </div>
                </div>

                {/* Metric chips */}
                <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                  <Chip label="Videos"      value={formatNumber(parseInt(channel.statistics.videoCount || '0', 10))} />
                  <Chip label="Total views" value={formatNumber(totalViews)} highlight={sort === 'totalViews'} />
                  <Chip label="Joined"      value={channel.publishedAt ? timeAgo(channel.publishedAt) : '—'} />
                  {cm && <>
                    <Chip label="Avg views/video"  value={formatNumber(cm.avgViewsPerVideo)}           highlight={sort === 'avgViews'} />
                    <Chip label="Engagement"       value={`${cm.avgEngagementRate.toFixed(2)}%`}        highlight={sort === 'engagement'} />
                    <Chip label="Recent uploads"   value={`${cm.recentUploads ?? 0} (30d)`} />
                    {cm.uploadFrequency > 0 && (
                      <Chip label="Frequency" value={`${cm.uploadFrequency.toFixed(1)}/mo`} />
                    )}
                    <Chip label="Opp score"  value={`${opp}/100`} highlight={sort === 'opportunity'}
                      valueClass={opp >= 70 ? 'text-emerald-400' : opp >= 45 ? 'text-amber-400' : undefined} />
                  </>}
                </div>

                {/* Estimated earnings badge */}
                <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/6 px-3 py-2">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <div>
                        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Est. monthly </span>
                        <span className={`text-xs font-bold ${sort === 'earnings' ? 'text-emerald-400' : 'text-[hsl(var(--foreground))]'}`}>
                          {fmtMoney(earnings.monthlyLow)} – {fmtMoney(earnings.monthlyHigh)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Est. yearly </span>
                        <span className="text-xs font-semibold text-[hsl(var(--foreground))]">
                          {fmtMoney(earnings.yearlyLow)} – {fmtMoney(earnings.yearlyHigh)}
                        </span>
                      </div>
                    </div>
                    <p className="text-[9px] text-[hsl(var(--muted-foreground))] opacity-60 mt-0.5">
                      Estimate only · CPM ${CPM[tier][0]}–${CPM[tier][1]} × 55% creator share · ~{formatNumber(earnings.monthlyViews)} views/mo
                    </p>
                  </div>
                </div>

                {/* Opportunity score bar (only for small channels) */}
                {cm && subs < 200_000 && (
                  <div className="mt-2.5">
                    <div className="flex items-center justify-between text-[10px] text-[hsl(var(--muted-foreground))] mb-1">
                      <span>Small Creator Opportunity</span>
                      <span className={opp >= 70 ? 'text-emerald-400 font-semibold' : opp >= 45 ? 'text-amber-400' : ''}>
                        {opp}/100
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[hsl(var(--border))]">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          opp >= 70 ? 'bg-emerald-500' : opp >= 45 ? 'bg-amber-500' : 'bg-[hsl(var(--muted-foreground))]'
                        }`}
                        style={{ width: `${opp}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
                      Engagement (×40) + views÷subs ratio (×35) + content volume (×15) + recent activity (×10)
                    </p>
                  </div>
                )}

                {/* Best video */}
                {cm?.bestVideo && (
                  <div className="mt-2.5 rounded-lg bg-[hsl(var(--surface-elevated))] px-3 py-2 text-xs">
                    <span className="text-[hsl(var(--muted-foreground))]">Best video: </span>
                    <a
                      href={`https://youtube.com/watch?v=${cm.bestVideo.videoId}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary))] font-medium line-clamp-1"
                    >
                      {cm.bestVideo.title}
                    </a>
                    <span className="ml-2 text-[hsl(var(--muted-foreground))]">
                      {formatNumber(parseInt(cm.bestVideo.statistics.viewCount, 10))} views
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Load more ─────────────────────────────────────────────────── */}
      {showCount < sortedRows.length && (
        <div className="text-center">
          <button
            onClick={() => setShowCount(n => n + 50)}
            className="px-6 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            Load more ({sortedRows.length - showCount} remaining)
          </button>
        </div>
      )}

      {/* ── Score legend ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-5 py-4">
        <p className="text-[11px] text-[hsl(var(--muted-foreground))] leading-relaxed">
          <span className="font-semibold text-[hsl(var(--foreground))]">Small Creator Opportunity score</span>{' '}
          identifies channels under 200K subs where the audience is unusually engaged.
          Score = engagement rate (×40) + views÷subs ratio (×35) + video volume (×15) + recent uploads (×10).
          All data is from YouTube API — no AI, no invented metrics.
          {' '}<span className="font-semibold text-[hsl(var(--foreground))]">Earnings</span>{' '}
          use CPM × 55% creator share (VidIQ methodology) — CPM is the advertiser rate per 1,000 views.
          Monthly views derived from upload frequency × avg views per video.
        </p>
      </div>
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SORT_LABELS: Record<SortField, string> = {
  subscribers: 'Subscribers',
  totalViews:  'Total Views',
  avgViews:    'Avg Views/Video',
  engagement:  'Engagement',
  opportunity: 'Opp Score',
  videos:      'Videos',
  earnings:    'Est. Earnings',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({
  icon, label, value, color,
}: {
  icon: React.ReactNode; label: string; value: string;
  color: 'blue' | 'purple' | 'amber' | 'emerald';
}) {
  const bg = {
    blue:    'bg-blue-500/10 text-blue-400',
    purple:  'bg-purple-500/10 text-purple-400',
    amber:   'bg-amber-500/10 text-amber-400',
    emerald: 'bg-emerald-500/10 text-emerald-400',
  }[color];
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-3`}>{icon}</div>
      <div className="text-xl font-bold text-[hsl(var(--foreground))]">{value}</div>
      <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{label}</div>
    </div>
  );
}

function Chip({
  label, value, highlight, valueClass,
}: {
  label: string; value: string; highlight?: boolean; valueClass?: string;
}) {
  return (
    <div>
      <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{label}</div>
      <div className={`text-xs font-semibold ${
        valueClass ?? (highlight ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--foreground))]')
      }`}>
        {value}
      </div>
    </div>
  );
}

function SortBtn({
  label, active, dir, onClick,
}: {
  label: string; active: boolean; dir?: SortDir; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
        active
          ? 'bg-[hsl(var(--primary))/12] text-[hsl(var(--primary))] border-[hsl(var(--primary))/30]'
          : 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))] hover:text-[hsl(var(--foreground))]'
      }`}
    >
      {label}{active && <span className="ml-0.5 opacity-70">{dir === 'desc' ? ' ↓' : ' ↑'}</span>}
    </button>
  );
}
