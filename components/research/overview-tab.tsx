'use client';

import type { ResearchSession } from '@/lib/types/research';
import { DataBadge } from './data-badge';
import { formatNumber, timeAgo } from '@/lib/youtube/utils';
import { RankScore } from './rank-score';
import { TrendingUp, TrendingDown, Minus, Zap, BarChart2, Activity, Eye } from 'lucide-react';

interface OverviewTabProps { session: ResearchSession; }

export function OverviewTab({ session }: OverviewTabProps) {
  const { youtubeData, metrics, analysis, searchIntelligence } = session;
  if (!metrics) return <EmptyState message="No metrics available" />;

  const totalViews = youtubeData.searchResult.videos.reduce(
    (s, v) => s + parseInt(v.statistics.viewCount || '0'), 0
  );

  return (
    <div className="space-y-4">

      {/* ── Stat strip ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Eye className="w-4 h-4" />} label="Videos Found"
          value={formatNumber(youtubeData.searchResult.videos.length)}
          sub="from YouTube API" color="blue" badge="youtube-data" />
        <StatCard icon={<BarChart2 className="w-4 h-4" />} label="Total Views"
          value={formatNumber(totalViews)}
          sub="combined" color="purple" badge="youtube-data" />
        <StatCard icon={<Zap className="w-4 h-4" />} label="Breakout Videos"
          value={String(metrics.breakouts.length)}
          sub="5× channel avg" color="amber" badge="calculated" />
        <StatCard icon={<Activity className="w-4 h-4" />} label="Verified Searches"
          value={String(searchIntelligence?.searchTerms.length ?? 0)}
          sub="from suggestion APIs" color="emerald" badge="youtube-data" />
      </div>

      {/* ── Competition + Saturation + Difficulty ──────────────────────── */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">Market Analysis</h2>
          <DataBadge source="calculated" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ScoreBlock
            label="Competition"
            value={metrics.competition.level}
            score={metrics.competition.competitionScore}
            reasoning={metrics.competition.reasoning}
          />
          <ScoreBlock
            label="Saturation"
            value={metrics.saturation.level}
            score={metrics.saturation.saturationScore}
            reasoning={metrics.saturation.reasoning}
          />
          <ScoreBlock
            label="Entry Difficulty"
            value={metrics.difficulty.level}
            score={metrics.difficulty.difficultyScore}
            reasoning={metrics.difficulty.reasoning}
          />
        </div>

        {/* Difficulty breakdown */}
        <div className="mt-4 pt-4 border-t border-[hsl(var(--border))]">
          <p className="text-xs text-[hsl(var(--muted-foreground))] font-medium mb-3">Difficulty breakdown</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2">
            {Object.entries(metrics.difficulty.breakdown).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="text-[hsl(var(--muted-foreground))] capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                <span className="font-semibold text-[hsl(var(--foreground))]">{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Momentum ───────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">Momentum</h2>
          <DataBadge source="calculated" />
        </div>
        <div className="flex items-center gap-6 mb-3">
          <TrendChip trend={metrics.momentum.trend} />
          <div className="flex items-center gap-1.5">
            <div className="w-24 h-2 rounded-full bg-[hsl(var(--border))]">
              <div
                className="h-2 rounded-full bg-[hsl(var(--primary))]"
                style={{ width: `${metrics.momentum.momentumScore}%` }}
              />
            </div>
            <span className="text-sm font-bold text-[hsl(var(--foreground))]">{metrics.momentum.momentumScore}</span>
          </div>
          <div className="flex gap-6 text-xs text-[hsl(var(--muted-foreground))]">
            <span>Recent avg <span className="text-[hsl(var(--foreground))] font-semibold ml-1">{formatNumber(metrics.momentum.recentAvgViews)}</span></span>
            <span>Historical avg <span className="text-[hsl(var(--foreground))] font-semibold ml-1">{formatNumber(metrics.momentum.historicalAvgViews)}</span></span>
          </div>
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed bg-[hsl(var(--surface-elevated))] rounded-lg px-3 py-2">
          {metrics.momentum.reasoning}
        </p>
      </div>

      {/* ── Breakout videos ────────────────────────────────────────────── */}
      {metrics.breakouts.length > 0 && (
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">
              Breakout Videos
              <span className="ml-2 text-xs font-normal text-[hsl(var(--muted-foreground))]">({metrics.breakouts.length})</span>
            </h2>
            <DataBadge source="calculated" />
          </div>
          <div className="space-y-2">
            {metrics.breakouts.slice(0, 5).map((b, i) => (
              <div key={i} className="flex items-center gap-4 rounded-lg bg-[hsl(var(--surface-elevated))] px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[hsl(var(--foreground))] line-clamp-2 sm:truncate">{b.video.title}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 line-clamp-2 sm:truncate">
                    {b.video.channelTitle} · {timeAgo(b.video.publishedAt)} · {formatNumber(parseInt(b.video.statistics.viewCount))} views
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-base font-bold text-emerald-400">{b.breakoutRatio.toFixed(1)}×</span>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">breakout</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Topic clusters preview ─────────────────────────────────────── */}
      {analysis && analysis.topics.length > 0 && (
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">Topic Clusters</h2>
            <DataBadge source="ai-analysis" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {analysis.topics.slice(0, 6).map((t, i) => (
              <div key={i} className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4">
                <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{t.name}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 line-clamp-3 sm:line-clamp-2">{t.description}</p>
                <div className="flex gap-3 mt-2 text-xs text-purple-400">
                  <span>{t.videoCount} videos</span>
                  <span>·</span>
                  <span>{formatNumber(t.medianViews)} median views</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Opportunities preview ──────────────────────────────────────── */}
      {searchIntelligence && searchIntelligence.opportunities.length > 0 && (
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">
              Verified Searches
              <span className="ml-2 text-xs font-normal text-[hsl(var(--muted-foreground))]">({searchIntelligence.opportunities.length} total)</span>
            </h2>
            <DataBadge source="youtube-data" />
          </div>
          <div className="space-y-2">
            {searchIntelligence.opportunities.slice(0, 4).map((opp, i) => (
              <div key={i} className="flex items-center gap-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-4 py-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-[hsl(var(--primary))/15] text-[hsl(var(--primary))] text-xs font-bold flex items-center justify-center">
                  {opp.rank}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{opp.searchQuery}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] truncate mt-0.5">{opp.source.replace(/_/g, ' ')}</p>
                </div>
                <RankScore score={opp.opportunityScore} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function StatCard({ icon, label, value, sub, color, badge }: {
  icon: React.ReactNode; label: string; value: string; sub: string;
  color: 'blue' | 'purple' | 'amber' | 'emerald';
  badge: 'youtube-data' | 'calculated';
}) {
  const colors = {
    blue:    { bg: 'bg-blue-500/10',    text: 'text-blue-400' },
    purple:  { bg: 'bg-purple-500/10',  text: 'text-purple-400' },
    amber:   { bg: 'bg-amber-500/10',   text: 'text-amber-400' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  }[color];

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center mb-3 ${colors.text}`}>
        {icon}
      </div>
      <div className="text-2xl font-bold text-[hsl(var(--foreground))]">{value}</div>
      <div className="text-xs font-medium text-[hsl(var(--foreground))] mt-1">{label}</div>
      <div className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">{sub}</div>
    </div>
  );
}

function ScoreBlock({ label, value, score, reasoning }: {
  label: string; value: string; score: number; reasoning: string;
}) {
  const { bar, text } = score < 40
    ? { bar: 'bg-emerald-500', text: 'text-emerald-400' }
    : score < 70
      ? { bar: 'bg-amber-500',   text: 'text-amber-400' }
      : { bar: 'bg-red-500',     text: 'text-red-400' };

  return (
    <div className="space-y-2">
      <div className="text-xs text-[hsl(var(--muted-foreground))] font-medium">{label}</div>
      <div className={`text-xl font-bold capitalize ${text}`}>{value}</div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-[hsl(var(--border))]">
          <div className={`h-1.5 rounded-full ${bar}`} style={{ width: `${score}%` }} />
        </div>
        <span className="text-xs font-semibold text-[hsl(var(--foreground))]">{score}</span>
      </div>
      <p className="text-[11px] text-[hsl(var(--muted-foreground))] leading-relaxed">{reasoning}</p>
    </div>
  );
}

function TrendChip({ trend }: { trend: string }) {
  const cfg: Record<string, { icon: React.ReactNode; cls: string }> = {
    surging:  { icon: <TrendingUp  className="w-3.5 h-3.5" />, cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    growing:  { icon: <TrendingUp  className="w-3.5 h-3.5" />, cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    stable:   { icon: <Minus       className="w-3.5 h-3.5" />, cls: 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]' },
    declining:{ icon: <TrendingDown className="w-3.5 h-3.5" />, cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
  };
  const { icon, cls } = cfg[trend] ?? cfg.stable;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${cls}`}>
      {icon}{trend}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-16 text-center">
      <p className="text-sm text-[hsl(var(--muted-foreground))]">{message}</p>
    </div>
  );
}
