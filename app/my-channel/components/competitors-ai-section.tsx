'use client';

import { useState, useEffect } from 'react';
import {
  Search, Plus, Trash2, Bot, Sparkles, Loader2,
  AlertCircle, Users, Target, Zap, ChevronRight,
} from 'lucide-react';
import { formatNumber, timeAgo } from '@/lib/youtube/utils';
import { type ChannelConnection } from '@/app/providers/channel-provider';
import { authHeaders, cn, Competitor, AISuggestion } from './helpers';

export function CompetitorsAndAISection({ connection }: { connection: ChannelConnection }) {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [aiLoading,   setAiLoading]   = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching,   setSearching]   = useState(false);
  const [removingId,  setRemovingId]  = useState<string | null>(null);
  const [error,       setError]       = useState('');
  const [aiError,     setAiError]     = useState('');
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [aiCached,    setAiCached]    = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const hdrs = await authHeaders();
        const res  = await fetch('/api/my-channel/competitors', { headers: hdrs });
        const d    = await res.json();
        setCompetitors(d.competitors ?? []);
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true); setError('');
    try {
      const hdrs = await authHeaders();
      const res  = await fetch('/api/my-channel/competitors', {
        method: 'POST', headers: hdrs,
        body: JSON.stringify({ query: searchQuery.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Failed to add');
      setCompetitors(prev => [d.competitor, ...prev]);
      setSearchQuery(''); setSuggestions([]); setGeneratedAt(null);
    } catch (e: any) { setError(e.message); }
    finally { setSearching(false); }
  };

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    try {
      const hdrs = await authHeaders();
      await fetch(`/api/my-channel/competitors?id=${id}`, { method: 'DELETE', headers: hdrs });
      setCompetitors(prev => prev.filter(c => c.id !== id));
      setSuggestions([]); setGeneratedAt(null);
    } catch (e: any) { setError(e.message); }
    finally { setRemovingId(null); }
  };

  const handleAnalyze = async () => {
    setAiLoading(true); setAiError('');
    try {
      const hdrs = await authHeaders();
      const res  = await fetch('/api/my-channel/analyze', {
        method: 'POST', headers: hdrs, body: JSON.stringify({}),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'AI analysis failed');
      setSuggestions(d.suggestions ?? []);
      setGeneratedAt(d.generatedAt);
      setAiCached(d.cached ?? false);
    } catch (e: any) { setAiError(e.message); }
    finally { setAiLoading(false); }
  };

  const priorityConfig = {
    high:   { icon: '🔥', label: 'High',   ring: 'ring-red-500/30',    badge: 'bg-red-500/10 text-red-400 border border-red-500/20',    bar: 'bg-red-500',    glow: 'from-red-500/8'    },
    medium: { icon: '⚡', label: 'Medium', ring: 'ring-amber-500/30',  badge: 'bg-amber-500/10 text-amber-400 border border-amber-500/20', bar: 'bg-amber-500', glow: 'from-amber-500/8'  },
    low:    { icon: '💡', label: 'Low',    ring: 'ring-blue-500/30',   badge: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',   bar: 'bg-blue-500',  glow: 'from-blue-500/8'   },
  } as const;

  return (
    <div className="space-y-6">

      {/* ── Top row: Competitors left, AI header right ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* ── Competitor Management ─────────────────────────────────────── */}
      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <Target className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[hsl(var(--foreground))]">Competitors</h2>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Search by channel name or YouTube URL</p>
            </div>
          </div>
          <span className={cn(
            'text-xs font-bold px-2.5 py-1 rounded-full border',
            competitors.length >= 10
              ? 'bg-red-500/10 text-red-400 border-red-500/20'
              : 'bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]'
          )}>
            {competitors.length}/10
          </span>
        </div>

        <div className="p-5 space-y-4">
          {/* Search form */}
          <form onSubmit={handleAdd} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Channel name or YouTube URL…"
                disabled={searching || competitors.length >= 10}
                className="w-full pl-9 pr-3 h-10 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))/40] disabled:opacity-50 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={searching || !searchQuery.trim() || competitors.length >= 10}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-[hsl(var(--primary))] text-white disabled:opacity-50 hover:opacity-90 transition-opacity shrink-0"
            >
              {searching
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Plus className="w-4 h-4" />}
            </button>
          </form>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/8 border border-red-500/20 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}

          {/* Competitor list */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--muted-foreground))]" />
            </div>
          ) : competitors.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-12 h-12 rounded-2xl bg-[hsl(var(--background))] border border-[hsl(var(--border))] flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-[hsl(var(--muted-foreground))] opacity-40" />
              </div>
              <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">No competitors yet</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] opacity-60 mt-1">Add up to 10 channels to compare against</p>
            </div>
          ) : (
            <div className="space-y-2">
              {competitors.map(comp => (
                <div
                  key={comp.id}
                  className="group flex items-center gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-3 hover:border-[hsl(var(--primary))/30] transition-all"
                >
                  {comp.profile_image_url ? (
                    <img
                      src={comp.profile_image_url}
                      alt={comp.channel_title}
                      className="w-9 h-9 rounded-full object-cover shrink-0 ring-2 ring-[hsl(var(--border))]"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-700 flex items-center justify-center shrink-0 text-sm font-bold text-white">
                      {comp.channel_title[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">{comp.channel_title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-[hsl(var(--muted-foreground))]">{formatNumber(comp.subscriber_count)} subs</span>
                      <span className="text-[hsl(var(--border))]">·</span>
                      <span className="text-[11px] text-[hsl(var(--muted-foreground))]">{comp.avg_engagement_rate.toFixed(1)}% eng</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(comp.id)}
                    disabled={removingId === comp.id}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-40 shrink-0"
                  >
                    {removingId === comp.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── AI Growth Analysis — always full width ────────────────────── */}
      </div>
      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
        {/* Gradient header */}
        <div className="relative bg-gradient-to-br from-[hsl(var(--primary))/12] via-purple-500/6 to-transparent border-b border-[hsl(var(--border))]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsl(var(--primary))/8,_transparent_60%)] pointer-events-none" />
          <div className="relative px-5 py-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-purple-600 flex items-center justify-center shadow-lg shadow-[hsl(var(--primary))/20] shrink-0">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[hsl(var(--foreground))]">AI Growth Analysis</h2>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 leading-relaxed max-w-sm">
                    Compares your channel to competitors and delivers specific, actionable growth strategies.
                  </p>
                  {generatedAt && (
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))] opacity-60 mt-1">
                      {aiCached ? 'Cached result' : 'Fresh result'} · {timeAgo(generatedAt)}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={handleAnalyze}
                disabled={aiLoading || competitors.length === 0}
                className="flex items-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-r from-[hsl(var(--primary))] to-purple-600 text-white text-sm font-bold disabled:opacity-50 hover:opacity-90 transition-opacity shadow-lg shadow-[hsl(var(--primary))/20] shrink-0 self-start sm:self-auto"
              >
                {aiLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Analysing…</>
                  : <><Sparkles className="w-4 h-4" /> {suggestions.length > 0 ? 'Re-run' : 'Analyse'}</>}
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5">
          {aiError && (
            <div className="mb-4 flex items-center gap-2 text-sm text-red-400 bg-red-500/8 border border-red-500/20 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />{aiError}
            </div>
          )}

          {/* Empty — no competitors */}
          {competitors.length === 0 && suggestions.length === 0 && !aiLoading && (
            <div className="text-center py-12">
              <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--background))] border border-[hsl(var(--border))] flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-7 h-7 text-[hsl(var(--muted-foreground))] opacity-30" />
              </div>
              <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Add competitors first</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] opacity-70 mt-1 max-w-xs mx-auto">
                Search for competitor channels above, then run AI analysis to get personalised growth strategies.
              </p>
            </div>
          )}

          {/* Ready to analyse */}
          {competitors.length > 0 && suggestions.length === 0 && !aiLoading && (
            <div className="text-center py-12">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))/15] to-purple-500/8 border border-[hsl(var(--primary))/20] flex items-center justify-center mx-auto mb-4">
                <Bot className="w-7 h-7 text-[hsl(var(--primary))] opacity-60" />
              </div>
              <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Ready to analyse</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] opacity-70 mt-1">
                {competitors.length} competitor{competitors.length !== 1 ? 's' : ''} loaded · Results are cached for 7 days
              </p>
              <button
                onClick={handleAnalyze}
                className="mt-4 inline-flex items-center gap-2 h-9 px-5 rounded-xl bg-[hsl(var(--primary))/10] border border-[hsl(var(--primary))/25] text-[hsl(var(--primary))] text-xs font-bold hover:bg-[hsl(var(--primary))/15] transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" /> Run Analysis
              </button>
            </div>
          )}

          {/* Loading */}
          {aiLoading && (
            <div className="flex flex-col items-center gap-5 py-14">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))/20] to-purple-500/10 flex items-center justify-center">
                  <Loader2 className="w-7 h-7 animate-spin text-[hsl(var(--primary))]" />
                </div>
                <div className="absolute inset-0 rounded-2xl bg-[hsl(var(--primary))/10] animate-ping" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Analysing your channel…</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                  Comparing metrics across {competitors.length} competitor{competitors.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          )}

          {/* Results */}
          {suggestions.length > 0 && !aiLoading && (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-widest">
                {suggestions.length} Growth Strategies
              </p>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {suggestions.map((s, i) => {
                const meta = priorityConfig[s.priority] ?? priorityConfig.low;
                return (
                  <div
                    key={i}
                    className={cn(
                      'relative rounded-xl border bg-[hsl(var(--background))] overflow-hidden flex flex-col',
                      s.priority === 'high'   ? 'border-red-500/20'   :
                      s.priority === 'medium' ? 'border-amber-500/20' :
                                                'border-blue-500/20'
                    )}
                  >
                    {/* Top accent bar */}
                    <div className={cn(
                      'h-0.5 w-full shrink-0',
                      s.priority === 'high'   ? 'bg-gradient-to-r from-transparent via-red-500 to-transparent'   :
                      s.priority === 'medium' ? 'bg-gradient-to-r from-transparent via-amber-500 to-transparent' :
                                                'bg-gradient-to-r from-transparent via-blue-500 to-transparent'
                    )} />

                    <div className="p-4 flex flex-col flex-1">
                      {/* Title row */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <span className="text-xl shrink-0 leading-none mt-0.5">{meta.icon}</span>
                          <h3 className="text-sm font-bold text-[hsl(var(--foreground))] leading-snug">{s.title}</h3>
                        </div>
                        <span className={cn('text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 whitespace-nowrap', meta.badge)}>
                          {meta.label}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed mb-4 flex-1">
                        {s.description}
                      </p>

                      {/* Action + Impact chips */}
                      <div className="space-y-2">
                        <div className="flex items-start gap-2 rounded-lg bg-[hsl(var(--card))] border border-[hsl(var(--border))] px-3 py-2.5">
                          <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-widest mb-0.5">Action</p>
                            <p className="text-xs text-[hsl(var(--foreground))] leading-snug">{s.action}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 rounded-lg bg-[hsl(var(--card))] border border-[hsl(var(--border))] px-3 py-2.5">
                          <Target className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-widest mb-0.5">Impact</p>
                            <p className="text-xs text-[hsl(var(--foreground))] leading-snug">{s.impact}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
