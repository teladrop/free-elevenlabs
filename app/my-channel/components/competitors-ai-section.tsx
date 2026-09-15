'use client';

import { useState, useEffect } from 'react';
import {
  Search, Plus, Trash2, Bot, Sparkles, Loader2,
  AlertCircle, Users, Target, Zap,
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
        const res = await fetch('/api/my-channel/competitors', { headers: hdrs });
        const d = await res.json();
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
      const res = await fetch('/api/my-channel/competitors', {
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
      const res = await fetch('/api/my-channel/analyze', {
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

  const priorityMeta = {
    high: {
      icon: '🔥',
      badge: 'High',
      badgeCls: 'bg-red-500/15 text-red-400 border border-red-500/25',
      border: 'border-red-500/20',
      glow: 'before:bg-red-500/5',
    },
    medium: {
      icon: '⚡',
      badge: 'Medium',
      badgeCls: 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
      border: 'border-amber-500/20',
      glow: 'before:bg-amber-500/5',
    },
    low: {
      icon: '💡',
      badge: 'Low',
      badgeCls: 'bg-blue-500/15 text-blue-400 border border-blue-500/25',
      border: 'border-blue-500/20',
      glow: 'before:bg-blue-500/5',
    },
  };

  return (
    <div className="space-y-4">

      {/* ── Competitor management ── */}
      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <Target className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">Competitors</h2>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Search by name or YouTube URL</p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]">
            {competitors.length}/10
          </span>
        </div>

        <form onSubmit={handleAdd} className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Channel name or URL…"
              disabled={searching || competitors.length >= 10}
              className="w-full pl-8 pr-3 h-9 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-xs text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))] disabled:opacity-50 transition-all" />
          </div>
          <button type="submit" disabled={searching || !searchQuery.trim() || competitors.length >= 10}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-[hsl(var(--primary))] text-white disabled:opacity-50 hover:opacity-90 transition-opacity shrink-0">
            {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          </button>
        </form>

        {error && (
          <div className="mb-3 flex items-center gap-2 text-xs text-red-400 bg-red-500/8 border border-red-500/20 rounded-xl px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-[hsl(var(--muted-foreground))]" />
          </div>
        ) : competitors.length === 0 ? (
          <div className="text-center py-5 text-[hsl(var(--muted-foreground))]">
            <Users className="w-7 h-7 mx-auto mb-1.5 opacity-30" />
            <p className="text-xs">No competitors yet.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {competitors.map(comp => (
              <div key={comp.id}
                className="flex items-center gap-2.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 group">
                {comp.profile_image_url ? (
                  <img src={comp.profile_image_url} alt={comp.channel_title} className="w-7 h-7 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center shrink-0 text-[10px] font-bold text-zinc-300">
                    {comp.channel_title[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-[hsl(var(--foreground))] truncate">{comp.channel_title}</div>
                  <div className="flex items-center gap-2 text-[10px] text-[hsl(var(--muted-foreground))]">
                    <span>{formatNumber(comp.subscriber_count)} subs</span>
                    <span>·</span>
                    <span>{comp.avg_engagement_rate.toFixed(1)}% eng</span>
                  </div>
                </div>
                <button onClick={() => handleRemove(comp.id)} disabled={removingId === comp.id}
                  className="w-6 h-6 flex items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:text-red-400 hover:bg-red-500/8 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-40">
                  {removingId === comp.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── AI Analysis ── */}
      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
        {/* Gradient header */}
        <div className="relative bg-gradient-to-br from-[hsl(var(--primary))/15] via-purple-500/8 to-transparent px-5 py-4 border-b border-[hsl(var(--border))]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsl(var(--primary))/10,_transparent_60%)]" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-purple-600 flex items-center justify-center shadow-lg shadow-[hsl(var(--primary))/30]">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-sm font-bold text-[hsl(var(--foreground))]">AI Growth Analysis</h2>
              </div>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))] leading-relaxed">
                AI compares your metrics to competitors and gives specific, actionable growth strategies.
                {generatedAt && (
                  <span className="ml-1 text-[hsl(var(--muted-foreground))/70]">
                    {aiCached ? '· cached' : '· fresh'} · {timeAgo(generatedAt)}
                  </span>
                )}
              </p>
            </div>
            <button onClick={handleAnalyze} disabled={aiLoading || competitors.length === 0}
              className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-gradient-to-r from-[hsl(var(--primary))] to-purple-600 text-white text-xs font-bold disabled:opacity-50 hover:opacity-90 transition-opacity shadow-lg shadow-[hsl(var(--primary))/25] shrink-0">
              {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {aiLoading ? 'Analysing…' : suggestions.length > 0 ? 'Re-run' : 'Analyse'}
            </button>
          </div>
        </div>

        <div className="p-5">
          {aiError && (
            <div className="mb-3 flex items-center gap-2 text-xs text-red-400 bg-red-500/8 border border-red-500/20 rounded-xl px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />{aiError}
            </div>
          )}

          {competitors.length === 0 && suggestions.length === 0 && (
            <div className="text-center py-8 text-[hsl(var(--muted-foreground))]">
              <div className="w-12 h-12 rounded-2xl bg-[hsl(var(--background))] border border-[hsl(var(--border))] flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-6 h-6 opacity-30" />
              </div>
              <p className="text-sm font-medium">Add competitors first</p>
              <p className="text-xs mt-1 opacity-70">Then run AI analysis to get personalised growth strategies.</p>
            </div>
          )}

          {competitors.length > 0 && suggestions.length === 0 && !aiLoading && (
            <div className="text-center py-6 text-[hsl(var(--muted-foreground))]">
              <div className="w-12 h-12 rounded-2xl bg-[hsl(var(--background))] border border-[hsl(var(--border))] flex items-center justify-center mx-auto mb-3">
                <Bot className="w-6 h-6 opacity-30" />
              </div>
              <p className="text-sm font-medium">Ready to analyse</p>
              <p className="text-xs mt-1 opacity-70">{competitors.length} competitor{competitors.length !== 1 ? 's' : ''} added · Results cached 7 days</p>
            </div>
          )}

          {aiLoading && (
            <div className="flex flex-col items-center gap-4 py-10">
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))/20] to-purple-500/10 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--primary))]" />
                </div>
                <div className="absolute inset-0 rounded-2xl bg-[hsl(var(--primary))/10] animate-ping" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Analysing your channel…</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Comparing metrics against {competitors.length} competitors</p>
              </div>
            </div>
          )}

          {suggestions.length > 0 && !aiLoading && (
            <div className="space-y-3">
              {suggestions.map((s, i) => {
                const meta = priorityMeta[s.priority] ?? priorityMeta.low;
                return (
                  <div key={i} className={`relative rounded-xl border p-4 overflow-hidden ${meta.border} bg-[hsl(var(--background))]`}>
                    {/* Subtle top gradient line */}
                    <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r ${
                      s.priority === 'high' ? 'from-transparent via-red-500/60 to-transparent'
                      : s.priority === 'medium' ? 'from-transparent via-amber-500/60 to-transparent'
                      : 'from-transparent via-blue-500/60 to-transparent'
                    }`} />
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-lg shrink-0 leading-none mt-0.5">{meta.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1 flex-wrap">
                          <h3 className="text-sm font-bold text-[hsl(var(--foreground))] leading-tight">{s.title}</h3>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${meta.badgeCls}`}>
                            {meta.badge}
                          </span>
                        </div>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">{s.description}</p>
                      </div>
                    </div>
                    <div className="ml-8 space-y-2 text-xs">
                      <div className="flex gap-2 p-2.5 rounded-lg bg-[hsl(var(--card))] border border-[hsl(var(--border))/50]">
                        <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-[hsl(var(--foreground))]">Action: </span>
                          <span className="text-[hsl(var(--muted-foreground))]">{s.action}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 p-2.5 rounded-lg bg-[hsl(var(--card))] border border-[hsl(var(--border))/50]">
                        <Target className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-[hsl(var(--foreground))]">Impact: </span>
                          <span className="text-[hsl(var(--muted-foreground))]">{s.impact}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
