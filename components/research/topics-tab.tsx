'use client';

import { useState } from 'react';
import type {
  ResearchSession,
  TopicCandidate,
  TopicAngle,
  ResearchSignal,
} from '@/lib/types/research';
import { DataBadge } from './data-badge';
import { formatNumber } from '@/lib/youtube/utils';
import {
  ChevronDown,
  ChevronRight,
  Layers,
  TrendingUp,
  Zap,
  Search,
  AlertCircle,
  Compass,
  ArrowUpRight,
  BookOpen,
} from 'lucide-react';

// ─── Angle metadata ────────────────────────────────────────────────────────

const ANGLE_META: Record<
  TopicAngle,
  { label: string; color: string; bg: string; border: string }
> = {
  why:            { label: 'Why',           color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
  how:            { label: 'How',           color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20' },
  what:           { label: 'What',          color: 'text-sky-400',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20' },
  who:            { label: 'Who',           color: 'text-teal-400',    bg: 'bg-teal-500/10',    border: 'border-teal-500/20' },
  comparison:     { label: 'Comparison',    color: 'text-purple-400',  bg: 'bg-purple-500/10',  border: 'border-purple-500/20' },
  story:          { label: 'Story',         color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  numbers:        { label: 'Numbers',       color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20' },
  mystery:        { label: 'Mystery',       color: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/20' },
  controversy:    { label: 'Controversy',   color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20' },
  failure:        { label: 'Failure',       color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20' },
  rise:           { label: 'Rise',          color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  fall:           { label: 'Fall',          color: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/20' },
  explainer:      { label: 'Explainer',     color: 'text-indigo-400',  bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20' },
  timeline:       { label: 'Timeline',      color: 'text-teal-400',    bg: 'bg-teal-500/10',    border: 'border-teal-500/20' },
  transformation: { label: 'Transform',     color: 'text-pink-400',    bg: 'bg-pink-500/10',    border: 'border-pink-500/20' },
  curiosity:      { label: 'Curiosity',     color: 'text-yellow-400',  bg: 'bg-yellow-500/10',  border: 'border-yellow-500/20' },
  contrarian:     { label: 'Contrarian',    color: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20' },
  investigation:  { label: 'Investigation', color: 'text-indigo-400',  bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20' },
  general:        { label: 'General',       color: 'text-[hsl(var(--muted-foreground))]', bg: 'bg-[hsl(var(--surface-elevated))]', border: 'border-[hsl(var(--border))]' },
};

// All filterable angles (excludes 'general' which just means unclassified)
const FILTER_ANGLES: TopicAngle[] = [
  'why', 'how', 'what', 'who', 'numbers', 'comparison', 'story',
  'mystery', 'controversy', 'failure', 'rise', 'fall', 'explainer',
  'timeline', 'transformation', 'curiosity', 'contrarian', 'investigation',
];

// ─── Source label map ────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  user_query:           'User query',
  youtube_autocomplete: 'YouTube autocomplete',
  google_autocomplete:  'Google autocomplete',
  google_trends:        'Google Trends',
  'youtube-data':       'YouTube data',
  calculated:           'Calculated',
};

// ─── Signal badge ─────────────────────────────────────────────────────────────

function SignalBadge({ signal }: { signal: ResearchSignal }) {
  const isRising = signal.type === 'rising_query';
  const isTrend  = signal.type === 'trend_query' || isRising;
  const isBreakout = signal.type === 'breakout_signal';

  const base = 'inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border';

  if (isRising) {
    return (
      <span className={`${base} bg-emerald-500/10 text-emerald-400 border-emerald-500/20`}>
        <TrendingUp className="w-2.5 h-2.5" />
        Rising · {signal.trend}
      </span>
    );
  }
  if (isTrend) {
    return (
      <span className={`${base} bg-blue-500/10 text-blue-400 border-blue-500/20`}>
        <TrendingUp className="w-2.5 h-2.5" />
        Trends · {signal.volume ?? '—'}
      </span>
    );
  }
  if (isBreakout) {
    return (
      <span className={`${base} bg-purple-500/10 text-purple-400 border-purple-500/20`}>
        <Zap className="w-2.5 h-2.5" />
        Breakout channel
      </span>
    );
  }

  const sourceLabel = SOURCE_LABELS[signal.source] ?? signal.source;
  return (
    <span className={`${base} bg-[hsl(var(--surface-elevated))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]`}>
      <Search className="w-2.5 h-2.5" />
      {sourceLabel}
    </span>
  );
}

// ─── Evidence score bar ──────────────────────────────────────────────────────

function EvidenceBar({ score }: { score: number }) {
  const color =
    score >= 70 ? 'bg-emerald-500' :
    score >= 45 ? 'bg-amber-500' :
    'bg-[hsl(var(--muted-foreground))]';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full bg-[hsl(var(--border))]">
        <div
          className={`h-1 rounded-full ${color} transition-all`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-[10px] text-[hsl(var(--muted-foreground))] w-6 text-right">{score}</span>
    </div>
  );
}

// ─── Single candidate card ────────────────────────────────────────────────────

function CandidateCard({
  candidate,
  rank,
}: {
  candidate: TopicCandidate;
  rank: number;
}) {
  const [open, setOpen] = useState(false);
  const meta = ANGLE_META[candidate.angle];

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[hsl(var(--surface-hover))] transition-colors text-left"
      >
        {/* Rank */}
        <span className="w-5 h-5 shrink-0 flex items-center justify-center rounded bg-[hsl(var(--surface-elevated))] text-[hsl(var(--muted-foreground))] text-[10px] font-bold">
          {rank}
        </span>

        {/* Topic + angle */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[hsl(var(--foreground))] break-words">
              {candidate.topic}
            </span>
            {candidate.angle !== 'general' && (
              <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.bg} ${meta.color} ${meta.border}`}>
                {meta.label}
              </span>
            )}
          </div>
          {/* Signal badges (show up to 3) */}
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {candidate.supportingSignals.slice(0, 3).map((s, i) => (
              <SignalBadge key={i} signal={s} />
            ))}
            {candidate.supportingSignals.length > 3 && (
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                +{candidate.supportingSignals.length - 3} more
              </span>
            )}
          </div>
        </div>

        {/* Evidence bar (desktop) */}
        <div className="shrink-0 w-24 hidden sm:block">
          <EvidenceBar score={candidate.evidenceScore} />
        </div>

        <span className="text-[hsl(var(--muted-foreground))] shrink-0">
          {open
            ? <ChevronDown className="w-4 h-4" />
            : <ChevronRight className="w-4 h-4" />}
        </span>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-4 py-4 space-y-4">

          {/* Discovery reason */}
          <div>
            <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1">
              Why this appeared
            </p>
            <p className="text-xs text-[hsl(var(--foreground))] leading-relaxed">
              {candidate.discoveryReason}
            </p>
          </div>

          {/* All signals */}
          {candidate.supportingSignals.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">
                Evidence sources ({candidate.supportingSignals.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {candidate.supportingSignals.map((s, i) => (
                  <SignalBadge key={i} signal={s} />
                ))}
              </div>
            </div>
          )}

          {/* Corroborating YouTube videos */}
          {candidate.relatedVideos.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">
                Corroborating videos ({candidate.relatedVideos.length})
              </p>
              <div className="space-y-1.5">
                {candidate.relatedVideos.map((vid, j) => (
                  <a
                    key={j}
                    href={`https://youtube.com/watch?v=${vid.videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-lg bg-[hsl(var(--card))] px-3 py-2 hover:bg-[hsl(var(--surface-hover))] transition-colors text-xs group"
                  >
                    <img
                      src={vid.thumbnails?.default?.url ?? ''}
                      alt=""
                      className="w-10 h-7 object-cover rounded shrink-0"
                    />
                    <span className="flex-1 text-[hsl(var(--foreground))] line-clamp-1 group-hover:text-[hsl(var(--primary))] transition-colors">
                      {vid.title}
                    </span>
                    <span className="shrink-0 text-[hsl(var(--muted-foreground))]">
                      {formatNumber(parseInt(vid.statistics.viewCount, 10))} views
                    </span>
                    <ArrowUpRight className="w-3 h-3 text-[hsl(var(--muted-foreground))] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Evidence score breakdown */}
          <div>
            <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1.5">
              Evidence score
            </p>
            <EvidenceBar score={candidate.evidenceScore} />
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">
              Score = provider diversity (×25) + Trends signal (×20) + rising signal (×20) + video corroboration (×20) + multi-seed confirmation (×15)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  icon,
  title,
  subtitle,
  count,
  children,
  accentColor = 'text-[hsl(var(--foreground))]',
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  count: number;
  children: React.ReactNode;
  accentColor?: string;
}) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={accentColor}>{icon}</span>
          <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">
            {title}
            <span className="ml-2 text-xs font-normal text-[hsl(var(--muted-foreground))]">
              ({count})
            </span>
          </h2>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">· {subtitle}</span>
        </div>
        {/* Custom badge — not AI, not YouTube, it's derived from verified searches */}
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-[hsl(var(--surface-elevated))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]">
          <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--muted-foreground))]" />
          Verified searches
        </span>
      </div>
      {children}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface TopicsTabProps { session: ResearchSession; }

export function TopicsTab({ session }: TopicsTabProps) {
  const { discoveredTopics } = session;
  const [angleFilter, setAngleFilter] = useState<TopicAngle | 'all'>('all');

  // ── Empty state: no discovery data at all ────────────────────────────────
  if (!discoveredTopics) {
    return (
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-16 text-center space-y-3">
        <Compass className="w-8 h-8 text-[hsl(var(--muted-foreground))] mx-auto" />
        <p className="text-sm font-semibold text-[hsl(var(--foreground))]">No topic discoveries available</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] max-w-sm mx-auto">
          Topic discovery requires verified search terms from YouTube autocomplete, Google autocomplete,
          or Google Trends. Try a different query or check if the search providers are reachable.
        </p>
      </div>
    );
  }

  const { direct, related, emerging, all, totalSignals } = discoveredTopics;

  // ── Filter all candidates by angle ──────────────────────────────────────
  function applyFilter(list: TopicCandidate[]): TopicCandidate[] {
    if (angleFilter === 'all') return list;
    return list.filter(c => c.angle === angleFilter);
  }

  const filteredDirect   = applyFilter(direct);
  const filteredRelated  = applyFilter(related);
  const filteredEmerging = applyFilter(emerging);
  const totalFiltered    = filteredDirect.length + filteredRelated.length + filteredEmerging.length;

  // Determine which angles actually appear in the data (to hide empty filter chips)
  const presentAngles = new Set(all.map(c => c.angle));

  // ── Zero state after filtering ────────────────────────────────────────
  const noDiscoveries = all.length === 0;

  return (
    <div className="space-y-4">

      {/* ── Stats bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 flex-wrap px-1">
        <div className="flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            <span className="font-semibold text-[hsl(var(--foreground))]">{totalSignals}</span> verified signals
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            <span className="font-semibold text-[hsl(var(--foreground))]">{all.length}</span> topic candidates
          </span>
        </div>
        {emerging.length > 0 && (
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs text-emerald-400 font-medium">
              {emerging.length} emerging
            </span>
          </div>
        )}
        <div className="ml-auto text-[10px] text-[hsl(var(--muted-foreground))]">
          Query: <span className="font-mono">{discoveredTopics.sourceQuery}</span>
        </div>
      </div>

      {/* ── Angle filter chips ─────────────────────────────────────────── */}
      {all.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-[hsl(var(--muted-foreground))] font-medium uppercase tracking-wide shrink-0">
            Filter:
          </span>
          <button
            onClick={() => setAngleFilter('all')}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              angleFilter === 'all'
                ? 'bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]'
                : 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))] hover:text-[hsl(var(--foreground))]'
            }`}
          >
            All ({all.length})
          </button>
          {FILTER_ANGLES.filter(a => presentAngles.has(a)).map(angle => {
            const count = all.filter(c => c.angle === angle).length;
            const m = ANGLE_META[angle];
            const active = angleFilter === angle;
            return (
              <button
                key={angle}
                onClick={() => setAngleFilter(active ? 'all' : angle)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  active
                    ? `${m.bg} ${m.color} ${m.border}`
                    : 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))] hover:text-[hsl(var(--foreground))]'
                }`}
              >
                {m.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* ── No discoveries state ────────────────────────────────────────── */}
      {noDiscoveries && (
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-12 text-center space-y-2">
          <p className="text-sm font-semibold text-[hsl(var(--foreground))]">
            No verified topic discoveries found
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] max-w-sm mx-auto">
            The search providers returned terms, but none met the minimum evidence threshold.
            This is the correct result — the system will not invent topics.
          </p>
        </div>
      )}

      {/* ── Filter produced zero results ────────────────────────────────── */}
      {!noDiscoveries && totalFiltered === 0 && (
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 text-center">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            No candidates match the <span className="font-semibold text-[hsl(var(--foreground))]">{ANGLE_META[angleFilter as TopicAngle]?.label}</span> filter.
          </p>
        </div>
      )}

      {/* ── Emerging topics ─────────────────────────────────────────────── */}
      {filteredEmerging.length > 0 && (
        <Section
          icon={<TrendingUp className="w-4 h-4" />}
          title="Emerging"
          subtitle="Rising trend signals from Google Trends (YouTube search)"
          count={filteredEmerging.length}
          accentColor="text-emerald-400"
        >
          <div className="space-y-2">
            {filteredEmerging.map((c, i) => (
              <CandidateCard key={c.id} candidate={c} rank={i + 1} />
            ))}
          </div>
        </Section>
      )}

      {/* ── Directly related topics ─────────────────────────────────────── */}
      {filteredDirect.length > 0 && (
        <Section
          icon={<Search className="w-4 h-4" />}
          title="Directly Related"
          subtitle="Sub-topics extending your exact query"
          count={filteredDirect.length}
          accentColor="text-blue-400"
        >
          <div className="space-y-2">
            {filteredDirect.map((c, i) => (
              <CandidateCard key={c.id} candidate={c} rank={i + 1} />
            ))}
          </div>
        </Section>
      )}

      {/* ── Related topics ───────────────────────────────────────────────── */}
      {filteredRelated.length > 0 && (
        <Section
          icon={<Compass className="w-4 h-4" />}
          title="Related"
          subtitle="Connected subjects from verified search data"
          count={filteredRelated.length}
          accentColor="text-purple-400"
        >
          <div className="space-y-2">
            {filteredRelated.map((c, i) => (
              <CandidateCard key={c.id} candidate={c} rank={i + 1} />
            ))}
          </div>
        </Section>
      )}

      {/* ── Provenance footer ─────────────────────────────────────────────── */}
      {all.length > 0 && (
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-5 py-4">
          <p className="text-[11px] text-[hsl(var(--muted-foreground))] leading-relaxed">
            <span className="font-semibold text-[hsl(var(--foreground))]">How this works:</span>{' '}
            Topic candidates are discovered deterministically from{' '}
            <span className="font-medium text-[hsl(var(--foreground))]">{totalSignals} verified search terms</span>{' '}
            collected from YouTube autocomplete, Google autocomplete, and Google Trends (YouTube search property).
            No AI invents topics. No search terms are fabricated. Every candidate is traceable to a real
            provider response. Evidence scores are calculated from provider diversity, Trends signals,
            video corroboration, and multi-seed confirmation — not from any AI model.
            Empty results mean the data did not support additional discoveries.
          </p>
        </div>
      )}
    </div>
  );
}
