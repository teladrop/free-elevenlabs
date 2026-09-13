'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { useState } from 'react';
import { Search, AlertCircle, Loader2, Eye, Zap, Users, Lightbulb, FileText, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { OverviewTab }      from '@/components/research/overview-tab';
import { VideosTab }        from '@/components/research/videos-tab';
import { ChannelsTab }      from '@/components/research/channels-tab';
import { TopicsTab }        from '@/components/research/topics-tab';
import { OpportunitiesTab } from '@/components/research/opportunities-tab';
import { TitlesTab }        from '@/components/research/titles-tab';
import { DataSourceLegend } from '@/components/research/data-badge';

import type { ResearchResponse } from '@/lib/types/research';

type TabId = 'overview' | 'videos' | 'channels' | 'topics' | 'opportunities' | 'titles';

export default function ResearchPage() {
  const [query,    setQuery]    = useState('');
  const [data,     setData]     = useState<ResearchResponse | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const handleSearch = async () => {
    const q = query.trim();
    if (!q || loading) return;

    setLoading(true);
    setError('');
    setData(null);
    setActiveTab('overview');

    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, videoLimit: 25, channelLimit: 10, useCache: true }),
      });

      const json = await res.json();

      if (!res.ok) {
        if (res.status === 429) throw new Error(json.details || 'YouTube quota exceeded. Try again later.');
        throw new Error(json.details || json.error || res.statusText);
      }

      setData(json as ResearchResponse);
    } catch (e: any) {
      setError(e.message || 'Research failed');
    } finally {
      setLoading(false);
    }
  };

  const s = data?.session;

  const TABS: { id: TabId; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'overview',      label: 'Overview',      icon: <Eye       className="w-3.5 h-3.5" /> },
    { id: 'videos',        label: 'Videos',        icon: <Zap       className="w-3.5 h-3.5" />, count: s?.youtubeData.searchResult.videos.length },
    { id: 'channels',      label: 'Channels',      icon: <Users     className="w-3.5 h-3.5" />, count: s?.youtubeData.searchResult.channels.length },
    { id: 'topics',        label: 'Topics',        icon: <Layers    className="w-3.5 h-3.5" />, count: s?.analysis?.topics.length },
    { id: 'opportunities', label: 'Opportunities', icon: <Lightbulb className="w-3.5 h-3.5" />, count: s?.searchIntelligence?.opportunities.length },
    { id: 'titles',        label: 'Titles',        icon: <FileText  className="w-3.5 h-3.5" />, count: s?.searchIntelligence?.titles.length },
  ];

  return (
    <AppLayout>
      <div className="min-h-screen bg-[hsl(var(--background))]">

        {/* ── Top bar ──────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-20 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))/95] backdrop-blur-sm">
          <div className="px-6 h-14 flex items-center gap-4">
            <div className="flex items-center gap-2 shrink-0">
              <Search className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
              <span className="text-sm font-semibold text-[hsl(var(--foreground))]">YouTube Research</span>
            </div>

            {/* Search bar */}
            <div className="flex-1 flex items-center gap-2 max-w-2xl">
              <div className="flex-1 flex items-center bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border))] rounded-lg px-3 h-9 gap-2 focus-within:border-[hsl(var(--primary))/60] transition-colors">
                <Search className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))] shrink-0" />
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="Search any topic — e.g. how McDonald's makes money"
                  disabled={loading}
                  className="flex-1 bg-transparent text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] outline-none min-w-0"
                />
                {query && !loading && (
                  <button onClick={() => setQuery('')}
                    className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] text-xs shrink-0">✕</button>
                )}
              </div>
              <button
                onClick={handleSearch}
                disabled={loading || !query.trim()}
                className="h-9 px-4 rounded-lg bg-[hsl(var(--primary))] text-white text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0"
              >
                {loading
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Researching…</>
                  : <><Search className="w-3.5 h-3.5" /> Research</>
                }
              </button>
            </div>

            {/* Source legend – only when data loaded */}
            {data && (
              <div className="hidden xl:flex ml-auto">
                <DataSourceLegend />
              </div>
            )}
          </div>

          {/* ── Tab bar ──────────────────────────────────────────────── */}
          {data && (
            <div className="px-6 flex items-center gap-1 border-t border-[hsl(var(--border))]">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-1.5 px-4 h-10 text-xs font-medium transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'text-[hsl(var(--foreground))]'
                      : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.count != null && tab.count > 0 && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      activeTab === tab.id
                        ? 'bg-[hsl(var(--primary))/15] text-[hsl(var(--primary))]'
                        : 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--muted-foreground))]'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="tab-underline"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-[hsl(var(--primary))] rounded-full"
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Content ────────────────────────────────────────────────── */}
        <div className="px-6 py-5 max-w-[1600px] mx-auto">

          {/* Error */}
          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-3">
                {[1,2,3,4].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
              </div>
              <div className="skeleton h-48 rounded-xl" />
              <div className="skeleton h-64 rounded-xl" />
            </div>
          )}

          {/* Tab panels */}
          {data && s && !loading && (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
              >
                {activeTab === 'overview'      && <OverviewTab      session={s} />}
                {activeTab === 'videos'        && <VideosTab        session={s} />}
                {activeTab === 'channels'      && <ChannelsTab      session={s} />}
                {activeTab === 'topics'        && <TopicsTab        session={s} />}
                {activeTab === 'opportunities' && <OpportunitiesTab session={s} />}
                {activeTab === 'titles'        && <TitlesTab        session={s} />}
              </motion.div>
            </AnimatePresence>
          )}

          {/* Empty state */}
          {!data && !loading && !error && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[hsl(var(--primary))/10] flex items-center justify-center mb-5">
                <Search className="w-7 h-7 text-[hsl(var(--primary))]" />
              </div>
              <h2 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-2">YouTube Research Intelligence</h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))] max-w-md mb-10">
                Enter any topic above to analyze real YouTube data, identify breakout videos, measure competition, and generate content opportunities.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl w-full">
                {[
                  { num: '1', label: 'YouTube Data',      desc: 'Real videos & channels',       color: 'text-red-400',     bg: 'bg-red-500/8 border-red-500/15' },
                  { num: '2', label: 'Calculated Metrics', desc: 'Transparent formulas',         color: 'text-blue-400',    bg: 'bg-blue-500/8 border-blue-500/15' },
                  { num: '3', label: 'AI Analysis',        desc: 'Pattern interpretation',       color: 'text-purple-400',  bg: 'bg-purple-500/8 border-purple-500/15' },
                  { num: '4', label: 'Verified Searches',  desc: 'Real suggestion queries',      color: 'text-emerald-400', bg: 'bg-emerald-500/8 border-emerald-500/15' },
                ].map(s => (
                  <div key={s.num} className={`rounded-xl border p-4 text-left ${s.bg}`}>
                    <div className={`text-xs font-bold mb-1 ${s.color}`}>{s.num}</div>
                    <div className="text-xs font-semibold text-[hsl(var(--foreground))]">{s.label}</div>
                    <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
