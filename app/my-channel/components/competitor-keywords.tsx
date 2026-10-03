'use client';

import { useState, useMemo } from 'react';
import { Tag, Hash, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { Competitor } from './helpers';

interface Props {
  competitors: Competitor[];
}

interface KeywordEntry {
  keyword:   string;
  channels:  string[]; // which competitors use this keyword
  count:     number;
}

export function CompetitorKeywords({ competitors }: Props) {
  const [expanded,   setExpanded]   = useState(false);
  const [activeTab,  setActiveTab]  = useState<'keywords' | 'topics'>('keywords');
  const [copied,     setCopied]     = useState<string | null>(null);
  const [showAll,    setShowAll]    = useState(false);

  // Aggregate keywords across all competitors
  const { keywordEntries, topicEntries } = useMemo(() => {
    const kwMap   = new Map<string, Set<string>>();
    const topicMap = new Map<string, Set<string>>();

    for (const comp of competitors) {
      const kws    = comp.channel_keywords   ?? [];
      const topics = comp.topic_categories   ?? [];

      for (const kw of kws) {
        const key = kw.toLowerCase().trim();
        if (!key) continue;
        if (!kwMap.has(key)) kwMap.set(key, new Set());
        kwMap.get(key)!.add(comp.channel_title);
      }

      for (const t of topics) {
        const key = t.toLowerCase().trim();
        if (!key) continue;
        if (!topicMap.has(key)) topicMap.set(key, new Set());
        topicMap.get(key)!.add(comp.channel_title);
      }
    }

    const toEntries = (map: Map<string, Set<string>>): KeywordEntry[] =>
      Array.from(map.entries())
        .map(([keyword, channels]) => ({ keyword, channels: Array.from(channels), count: channels.size }))
        .sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword));

    return { keywordEntries: toEntries(kwMap), topicEntries: toEntries(topicMap) };
  }, [competitors]);

  const totalKw     = keywordEntries.length;
  const totalTopics = topicEntries.length;
  const hasData     = totalKw > 0 || totalTopics > 0;

  const activeEntries = activeTab === 'keywords' ? keywordEntries : topicEntries;
  const VISIBLE_LIMIT = 30;
  const shown = showAll ? activeEntries : activeEntries.slice(0, VISIBLE_LIMIT);

  const copyAll = () => {
    const text = activeEntries.map(e => e.keyword).join(', ');
    navigator.clipboard.writeText(text);
    setCopied('all');
    setTimeout(() => setCopied(null), 2000);
  };

  const copyOne = (kw: string) => {
    navigator.clipboard.writeText(kw);
    setCopied(kw);
    setTimeout(() => setCopied(null), 2000);
  };

  // Per-competitor keyword count summary for the header
  const withKeywords = competitors.filter(c => (c.channel_keywords ?? []).length > 0).length;

  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">

      {/* ── Header ── */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-[hsl(var(--surface-elevated))] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-violet-500/15 flex items-center justify-center">
            <Tag className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Competitor Channel Keywords</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              {hasData
                ? `${totalKw} keywords · ${totalTopics} topics across ${withKeywords}/${competitors.length} channels`
                : competitors.length === 0
                  ? 'Add competitors to see their keywords'
                  : 'No keywords found — channels may not have set any'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasData && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400">
              {totalKw + totalTopics}
            </span>
          )}
          {expanded
            ? <ChevronUp className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
            : <ChevronDown className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />}
        </div>
      </button>

      {/* ── Body ── */}
      {expanded && (
        <div className="border-t border-[hsl(var(--border))] px-5 py-4 space-y-4">

          {!hasData ? (
            <div className="text-center py-8">
              <Hash className="w-8 h-8 text-[hsl(var(--muted-foreground))] opacity-30 mx-auto mb-2" />
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                {competitors.length === 0
                  ? 'Add competitor channels first'
                  : 'None of your competitors have set channel keywords'}
              </p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] opacity-60 mt-1">
                Keywords are set in YouTube Studio → Customisation → Basic info
              </p>
            </div>
          ) : (
            <>
              {/* Tabs + copy all */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex gap-1 p-0.5 rounded-lg bg-[hsl(var(--surface-elevated))]">
                  <button
                    onClick={() => { setActiveTab('keywords'); setShowAll(false); }}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      activeTab === 'keywords'
                        ? 'bg-violet-500/20 text-violet-400'
                        : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                    }`}
                  >
                    Keywords <span className="opacity-60 ml-1">{totalKw}</span>
                  </button>
                  <button
                    onClick={() => { setActiveTab('topics'); setShowAll(false); }}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      activeTab === 'topics'
                        ? 'bg-violet-500/20 text-violet-400'
                        : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                    }`}
                  >
                    Topics <span className="opacity-60 ml-1">{totalTopics}</span>
                  </button>
                </div>

                {activeEntries.length > 0 && (
                  <button
                    onClick={copyAll}
                    className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                  >
                    {copied === 'all'
                      ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copied all</>
                      : <><Copy className="w-3.5 h-3.5" /> Copy all</>}
                  </button>
                )}
              </div>

              {/* Per-channel breakdown header */}
              {activeTab === 'keywords' && (
                <div className="space-y-2">
                  {competitors.filter(c => (c.channel_keywords ?? []).length > 0).map(comp => (
                    <div key={comp.id} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2.5">
                      <div className="flex items-center gap-2 mb-2">
                        {comp.profile_image_url
                          ? <img src={comp.profile_image_url} alt={comp.channel_title} className="w-5 h-5 rounded-full object-cover" />
                          : <div className="w-5 h-5 rounded-full bg-[hsl(var(--surface-elevated))] flex items-center justify-center text-[10px] font-bold">{comp.channel_title[0]}</div>}
                        <span className="text-xs font-semibold text-[hsl(var(--foreground))] truncate">{comp.channel_title}</span>
                        <span className="text-[10px] text-[hsl(var(--muted-foreground))] ml-auto shrink-0">{comp.channel_keywords.length} keywords</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {comp.channel_keywords.map((kw, i) => (
                          <button
                            key={i}
                            onClick={() => copyOne(kw)}
                            title="Click to copy"
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-all border ${
                              copied === kw
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))] hover:border-violet-500/40 hover:text-violet-400 hover:bg-violet-500/8'
                            }`}
                          >
                            <Hash className="w-2.5 h-2.5 shrink-0" />
                            {kw}
                            {copied === kw && <Check className="w-2.5 h-2.5 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Aggregated cross-channel view */}
              {activeEntries.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2">
                    {activeTab === 'keywords' ? 'Shared keywords (used by multiple channels)' : 'Topic categories'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {shown.map((entry, i) => (
                      <button
                        key={i}
                        onClick={() => copyOne(entry.keyword)}
                        title={`Used by: ${entry.channels.join(', ')}`}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                          copied === entry.keyword
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : entry.count > 1
                              ? 'bg-violet-500/12 text-violet-300 border-violet-500/25 hover:bg-violet-500/20'
                              : 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))] hover:border-violet-500/30 hover:text-violet-400'
                        }`}
                      >
                        {activeTab === 'topics'
                          ? <Tag className="w-3 h-3 shrink-0" />
                          : <Hash className="w-3 h-3 shrink-0" />}
                        {entry.keyword}
                        {entry.count > 1 && (
                          <span className={`text-[10px] px-1 py-0.5 rounded-full ${
                            copied === entry.keyword ? 'bg-emerald-500/20' : 'bg-violet-500/20 text-violet-300'
                          }`}>
                            {entry.count}
                          </span>
                        )}
                        {copied === entry.keyword && <Check className="w-3 h-3 shrink-0" />}
                      </button>
                    ))}
                  </div>

                  {activeEntries.length > VISIBLE_LIMIT && (
                    <button
                      onClick={() => setShowAll(s => !s)}
                      className="mt-3 text-xs text-[hsl(var(--primary))] hover:underline"
                    >
                      {showAll
                        ? 'Show less'
                        : `Show ${activeEntries.length - VISIBLE_LIMIT} more ${activeTab === 'keywords' ? 'keywords' : 'topics'}`}
                    </button>
                  )}
                </div>
              )}

              {/* Channels with no keywords notice */}
              {activeTab === 'keywords' && competitors.filter(c => !(c.channel_keywords ?? []).length).length > 0 && (
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] opacity-60">
                  {competitors.filter(c => !(c.channel_keywords ?? []).length).map(c => c.channel_title).join(', ')}
                  {' '}{competitors.filter(c => !(c.channel_keywords ?? []).length).length === 1 ? 'has' : 'have'} no keywords set.
                  Re-add {competitors.filter(c => !(c.channel_keywords ?? []).length).length === 1 ? 'this channel' : 'these channels'} to refresh.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
