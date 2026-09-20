'use client';

import { useState } from 'react';
import type { ResearchSession, RealOpportunity } from '@/lib/types/research';
import { DataBadge } from './data-badge';
import { formatNumber } from '@/lib/youtube/utils';
import { Search, X, ChevronRight } from 'lucide-react';
import { SEARCH_SOURCE_LABEL } from '@/lib/types/research';
import { RankScore } from './rank-score';

type FilterLevel = 'all' | 'low' | 'moderate' | 'high';
interface OpportunitiesTabProps { session: ResearchSession; }

export function OpportunitiesTab({ session }: OpportunitiesTabProps) {
  const si = session.searchIntelligence;
  const [selected, setSelected] = useState<RealOpportunity | null>(null);
  const [filter, setFilter] = useState<FilterLevel>('all');
  const [copied, setCopied] = useState<number | null>(null);

  if (!si || si.opportunities.length === 0) {
    return (
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-16 text-center">
        <Search className="w-10 h-10 mx-auto text-[hsl(var(--muted-foreground))] mb-3" />
        <p className="text-sm text-[hsl(var(--muted-foreground))]">No verified related searches available.</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))]/60 mt-1">
          Suggestion providers returned no real search queries for this topic
        </p>
      </div>
    );
  }

  const all = si.opportunities;
  const counts = {
    all: all.length,
    low: all.filter(o => o.competitionLevel === 'low').length,
    moderate: all.filter(o => o.competitionLevel === 'moderate').length,
    high: all.filter(o => o.competitionLevel === 'high').length,
  };
  const filtered = filter === 'all' ? all : all.filter(o => o.competitionLevel === filter);

  const copyQuery = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-5 py-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-semibold text-[hsl(var(--foreground))]">
              {filtered.length} Verified Searches
            </p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              Ranked by Volume×0.40 + (100−Competition)×0.35 + Engagement×0.25
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <DataBadge source="calculated" />
            <div className="w-px h-4 bg-[hsl(var(--border))]" />
            {(['all', 'low', 'moderate', 'high'] as FilterLevel[]).map(f => (
              <FilterBtn
                key={f}
                label={f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                count={counts[f]}
                active={filter === f}
                level={f}
                onClick={() => setFilter(f)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className={`space-y-2 transition-all duration-300 ${selected ? 'lg:w-3/5' : 'w-full'}`}>
          {filtered.map((opp, i) => (
            <button
              key={`${opp.source}-${opp.searchQuery}-${i}`}
              onClick={() => setSelected(selected === opp ? null : opp)}
              className={`w-full text-left rounded-xl border p-3 sm:p-4 transition-all hover:bg-[hsl(var(--surface-hover))] ${
                selected === opp
                  ? 'border-[hsl(var(--primary))/40] bg-[hsl(var(--primary))/5]'
                  : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'
              }`}
            >
              <div className="flex items-start gap-2 sm:gap-3">
                <span className="shrink-0 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[hsl(var(--surface-elevated))] text-[hsl(var(--muted-foreground))] text-xs font-bold flex items-center justify-center mt-0.5">
                  {opp.rank}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-[hsl(var(--foreground))] leading-snug flex items-start gap-1.5">
                      <Search className="w-3 h-3 text-[hsl(var(--muted-foreground))] shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{opp.searchQuery}</span>
                    </p>
                    <RankScore score={opp.opportunityScore} />
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 mt-2 flex-wrap">
                    <CompPill level={opp.competitionLevel} />
                    <span className="text-[10px] sm:text-[11px] text-[hsl(var(--muted-foreground))]">
                      Vol {opp.volumeScore} · Comp {opp.competitionScore} · Eng {opp.engagementScore}
                    </span>
                    {!selected && <ChevronRight className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))] ml-auto hidden sm:inline" />}
                  </div>
                </div>
              </div>
            </button>
          ))}

          {filtered.length === 0 && (
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-12 text-center">
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No opportunities match this filter</p>
            </div>
          )}
        </div>

        {selected && (
          <div className="w-full lg:w-2/5 lg:shrink-0 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto space-y-3">
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 sm:p-5">
              <div className="flex items-start justify-between mb-4 gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Search className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-widest font-semibold">Real Search Query</span>
                  </div>
                  <p className="text-sm font-semibold text-[hsl(var(--foreground))] leading-snug break-words">
                    {selected.searchQuery}
                  </p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="shrink-0 w-6 h-6 rounded-lg bg-[hsl(var(--surface-elevated))] flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-4 mb-4 pb-4 border-b border-[hsl(var(--border))]">
                <div className="text-center">
                  <div className={`text-2xl sm:text-3xl font-extrabold ${scoreColor(selected.opportunityScore)}`}>
                    {selected.opportunityScore}
                  </div>
                  <div className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">opportunity score</div>
                </div>
                <div className="flex-1 space-y-2">
                  <ScoreRow label="Volume" value={selected.volumeScore} />
                  <ScoreRow label="Competition" value={selected.competitionScore} invert />
                  <ScoreRow label="Engagement" value={selected.engagementScore} />
                </div>
              </div>

              <div className="space-y-2 text-xs mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-[hsl(var(--muted-foreground))]">Competition</span>
                  <CompPill level={selected.competitionLevel} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[hsl(var(--muted-foreground))]">Matching videos in results</span>
                  <span className="font-semibold text-[hsl(var(--foreground))]">{selected.videoMatches}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[hsl(var(--muted-foreground))]">Match views (demand proxy)</span>
                  <span className="font-semibold text-[hsl(var(--foreground))]">{formatNumber(selected.totalMatchViews)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[hsl(var(--muted-foreground))]">Avg engagement</span>
                  <span className="font-semibold text-[hsl(var(--foreground))]">{selected.avgEngagementRate.toFixed(2)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[hsl(var(--muted-foreground))]">Source</span>
                  <span className="font-semibold text-[hsl(var(--foreground))]">{SEARCH_SOURCE_LABEL[selected.source]}</span>
                </div>
              </div>

              <p className="text-[10px] text-[hsl(var(--muted-foreground))] mb-4 leading-relaxed">
                {selected.scoreBreakdown.formula}. Volume is a YouTube views proxy, not Keyword Planner search volume.
              </p>

              <div className="rounded-lg bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border))] px-3 py-2.5 flex items-center justify-between gap-3">
                <p className="text-xs text-[hsl(var(--foreground))] font-medium truncate">
                  {selected.searchQuery}
                </p>
                <button
                  onClick={() => copyQuery(selected.searchQuery, selected.rank)}
                  className={`shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                    copied === selected.rank
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))] hover:text-[hsl(var(--foreground))]'
                  }`}
                >
                  {copied === selected.rank ? '✓ Copied' : 'Copy'}
                </button>
              </div>

              <div className="mt-4 pt-3 border-t border-[hsl(var(--border))]">
                <DataBadge source="calculated" />
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1.5">
                  Provenance: {selected.source} · seed “{selected.sourceId}”
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreRow({ label, value, invert }: { label: string; value: number; invert?: boolean }) {
  const shown = invert ? 100 - value : value;
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
      <span className="font-semibold text-[hsl(var(--foreground))]">{value}</span>
      <span className="sr-only">{shown}</span>
    </div>
  );
}

function FilterBtn({ label, count, active, level, onClick }: {
  label: string; count: number; active: boolean;
  level: FilterLevel; onClick: () => void;
}) {
  const activeClass: Record<FilterLevel, string> = {
    all:      'bg-[hsl(var(--primary))/12] text-[hsl(var(--primary))] border-[hsl(var(--primary))/30]',
    low:      'bg-emerald-500/12 text-emerald-400 border-emerald-500/30',
    moderate: 'bg-amber-500/12 text-amber-400 border-amber-500/30',
    high:     'bg-red-500/10 text-red-400 border-red-500/25',
  };
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
        active
          ? activeClass[level]
          : 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))] hover:text-[hsl(var(--foreground))]'
      }`}
    >
      {label} <span className="opacity-60">({count})</span>
    </button>
  );
}

function CompPill({ level }: { level: string }) {
  const cls: Record<string, string> = {
    low:      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    moderate: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    high:     'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return (
    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${cls[level] ?? cls.moderate}`}>
      {level}
    </span>
  );
}

function scoreColor(s: number) {
  if (s >= 70) return 'text-emerald-400';
  if (s >= 50) return 'text-amber-400';
  return 'text-[hsl(var(--muted-foreground))]';
}
