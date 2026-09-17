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
// Formula: views ÷ 1000 × RPM
// RPM = Revenue Per Mille — what the creator actually receives per 1,000 views
// AFTER YouTube's 45% cut. This is the correct metric (not CPM which is the
// gross advertiser rate before YouTube takes its share).
//
// RPM ranges vary primarily by NICHE (content category) because advertisers
// pay vastly different rates per category. We detect niche from the search
// query and apply the appropriate RPM range:
//
//   Finance / investing / crypto     $6.00 – $15.00  (highest advertiser demand)
//   Business / marketing / SaaS      $5.00 – $12.00
//   Tech / software / AI             $4.00 – $10.00
//   Health / fitness / wellness      $3.00 –  $8.00
//   Education / how-to / tutorials   $2.50 –  $7.00
//   Food / cooking / recipes         $2.00 –  $5.00
//   Travel / lifestyle               $1.50 –  $4.00
//   Entertainment / vlogs            $1.00 –  $3.00
//   Gaming / memes / comedy          $0.50 –  $2.50  (lowest advertiser demand)
//   Default (unknown niche)          $1.50 –  $5.00
//
// Daily views  = monthly views ÷ 30
// Monthly views = avgViewsPerVideo × uploadFrequency, or totalViews÷videoCount÷12
// Yearly = monthly × 12 (no growth assumed — avoids misleading projections)

type NicheTier =
  | 'finance' | 'business' | 'tech' | 'health'
  | 'education' | 'food' | 'travel' | 'entertainment' | 'gaming' | 'default';

// RPM [low, high] in USD
const NICHE_RPM: Record<NicheTier, [number, number]> = {
  finance:       [ 6.00, 15.00],
  business:      [ 5.00, 12.00],
  tech:          [ 4.00, 10.00],
  health:        [ 3.00,  8.00],
  education:     [ 2.50,  7.00],
  food:          [ 2.00,  5.00],
  travel:        [ 1.50,  4.00],
  entertainment: [ 1.00,  3.00],
  gaming:        [ 0.50,  2.50],
  default:       [ 1.50,  5.00],
};

// Keyword → niche mapping (checked against lowercased query)
const NICHE_KEYWORDS: [NicheTier, string[]][] = [
  ['finance',       ['finance', 'invest', 'stock', 'crypto', 'bitcoin', 'trading', 'forex', 'money', 'wealth', 'dividend', 'realestate', 'real estate']],
  ['business',      ['business', 'entrepreneur', 'marketing', 'startup', 'saas', 'ecommerce', 'dropshipping', 'amazon fba', 'sales', 'agency', 'branding']],
  ['tech',          ['tech', 'software', 'coding', 'programming', 'ai', 'artificial intelligence', 'machine learning', 'cybersecurity', 'gadget', 'review', 'iphone', 'android']],
  ['health',        ['health', 'fitness', 'workout', 'gym', 'diet', 'nutrition', 'weight loss', 'yoga', 'meditation', 'mental health', 'wellness']],
  ['education',     ['education', 'tutorial', 'how to', 'learn', 'study', 'school', 'course', 'skill', 'language', 'science', 'history', 'math']],
  ['food',          ['food', 'cook', 'recipe', 'baking', 'kitchen', 'restaurant', 'eat', 'meal', 'vegan', 'keto']],
  ['travel',        ['travel', 'vlog', 'trip', 'vacation', 'adventure', 'explore', 'country', 'backpack', 'lifestyle']],
  ['gaming',        ['gaming', 'game', 'minecraft', 'fortnite', 'roblox', 'playstation', 'xbox', 'esports', 'streamer', 'twitch', 'meme', 'funny', 'comedy', 'prank']],
  ['entertainment', ['entertainment', 'music', 'dance', 'celebrity', 'movie', 'reaction', 'drama', 'gossip']],
];

function detectNiche(query: string): NicheTier {
  const q = query.toLowerCase();
  for (const [niche, keywords] of NICHE_KEYWORDS) {
    if (keywords.some(kw => q.includes(kw))) return niche;
  }
  return 'default';
}

interface EarningsEstimate {
  dailyLow:     number;
  dailyHigh:    number;
  monthlyLow:   number;
  monthlyHigh:  number;
  yearlyLow:    number;
  yearlyHigh:   number;
  monthlyViews: number;
  niche:        NicheTier;
  rpmLow:       number;
  rpmHigh:      number;
}

function estimateEarnings(
  niche: NicheTier,
  totalViews: number,
  avgViewsPerVideo: number,
  uploadFrequency: number,
  videoCount: number,
): EarningsEstimate {
  const [rpmLow, rpmHigh] = NICHE_RPM[niche];

  // Monthly views: prefer frequency × avg views; fall back to lifetime average
  const monthlyViews = uploadFrequency > 0
    ? avgViewsPerVideo * uploadFrequency
    : videoCount > 0
      ? totalViews / videoCount / 12
      : 0;

  const dailyViews  = monthlyViews / 30;
  const monthlyLow  = Math.round(monthlyViews / 1000 * rpmLow);
  const monthlyHigh = Math.round(monthlyViews / 1000 * rpmHigh);

  return {
    dailyLow:     Math.round(dailyViews / 1000 * rpmLow),
    dailyHigh:    Math.round(dailyViews / 1000 * rpmHigh),
    monthlyLow,
    monthlyHigh,
    yearlyLow:    monthlyLow  * 12,
    yearlyHigh:   monthlyHigh * 12,
    monthlyViews: Math.round(monthlyViews),
    niche,
    rpmLow,
    rpmHigh,
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

  // Detect niche once from the session query — applies to all channels
  const niche = useMemo(() => detectNiche(session.query), [session.query]);

  // ── Enriched rows (memoised) ─────────────────────────────────────────────
  const allRows = useMemo(() => channels.map(ch => {
    const cm   = channelMetricsMap.get(ch.channelId);
    const subs = parseInt(ch.statistics.subscriberCount || '0', 10);
    const totalViews = parseInt(ch.statistics.viewCount || '0', 10);
    const vidCount   = parseInt(ch.statistics.videoCount || '0', 10);
    const opp  = cm ? calcOpportunityScore(cm, subs) : 0;
    const tier = getSizeTier(subs);
    const earnings = estimateEarnings(
      niche,
      totalViews,
      cm?.avgViewsPerVideo ?? 0,
      cm?.uploadFrequency  ?? 0,
      vidCount,
    );
    return { channel: ch, cm, subs, totalViews, opp, tier, earnings };
  }), [channels, channelMetricsMap, niche]);

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
                        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Daily </span>
                        <span className="text-xs font-semibold text-[hsl(var(--foreground))]">
                          {fmtMoney(earnings.dailyLow)} – {fmtMoney(earnings.dailyHigh)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Monthly </span>
                        <span className={`text-xs font-bold ${sort === 'earnings' ? 'text-emerald-400' : 'text-[hsl(var(--foreground))]'}`}>
                          {fmtMoney(earnings.monthlyLow)} – {fmtMoney(earnings.monthlyHigh)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Yearly </span>
                        <span className="text-xs font-semibold text-[hsl(var(--foreground))]">
                          {fmtMoney(earnings.yearlyLow)} – {fmtMoney(earnings.yearlyHigh)}
                        </span>
                      </div>
                    </div>
                    <p className="text-[9px] text-[hsl(var(--muted-foreground))] opacity-60 mt-0.5">
                      RPM ${earnings.rpmLow}–${earnings.rpmHigh} · {earnings.niche} niche · ~{formatNumber(earnings.monthlyViews)} views/mo
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
          use RPM (views ÷ 1000 × RPM) — the creator&apos;s actual take after YouTube&apos;s 45% cut.
          RPM range is set by detected niche (finance/tech/gaming etc.) from the search query.
          Daily = monthly ÷ 30. Yearly = monthly × 12.
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
