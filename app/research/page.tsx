'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Search, AlertCircle, Loader2, Eye, Zap, Users, Lightbulb,
  FileText, Layers, Copy, Check, BarChart2, RefreshCw,
  Mic2, FolderPlus, Wand2, Tag, ArrowRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { OverviewTab }      from '@/components/research/overview-tab';
import { VideosTab }        from '@/components/research/videos-tab';
import { ChannelsTab }      from '@/components/research/channels-tab';
import { TopicsTab }        from '@/components/research/topics-tab';
import { OpportunitiesTab } from '@/components/research/opportunities-tab';
import { TitlesTab }        from '@/components/research/titles-tab';
import { DataSourceLegend } from '@/components/research/data-badge';

import type { ResearchResponse } from '@/lib/types/research';

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId =
  | 'overview' | 'videos' | 'channels' | 'topics'
  | 'opportunities' | 'titles'
  | 'ideas' | 'titlesgen';

interface ContentIdea {
  category: string;
  title: string;
  angle: string;
  hook: string;
  value: string;
  visualPotential: number;
  searchability: number;
  storytellingPotential: number;
}
interface TitleCat { category: string; titles: string[] }

// ─── SessionStorage key ───────────────────────────────────────────────────────
const SS_KEY = 'research_page_state';

interface PersistedState {
  query:       string;
  data:        ResearchResponse | null;
  activeTab:   TabId;
  ideas:       ContentIdea[];
  ideasContext: string;
  titleCats:   TitleCat[];
}

function loadState(): Partial<PersistedState> {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveState(state: PersistedState) {
  try { sessionStorage.setItem(SS_KEY, JSON.stringify(state)); } catch {}
}

// ─── Score colour helper ──────────────────────────────────────────────────────

function scoreColor(v: number) {
  return v >= 8 ? 'text-emerald-400' : v >= 6 ? 'text-amber-400' : 'text-red-400';
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ResearchPage() {
  // Restore persisted state on first render
  const persisted = useRef(loadState());

  // ── Research state ────────────────────────────────────────────────────────
  const [query,     setQuery]     = useState(persisted.current.query     ?? '');
  const [data,      setData]      = useState<ResearchResponse | null>(persisted.current.data ?? null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [activeTab, setActiveTab] = useState<TabId>(persisted.current.activeTab ?? 'overview');

  // ── Content Ideas state ───────────────────────────────────────────────────
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [ideas,        setIdeas]        = useState<ContentIdea[]>(persisted.current.ideas ?? []);
  const [ideasError,   setIdeasError]   = useState('');
  const [ideasContext, setIdeasContext] = useState(persisted.current.ideasContext ?? '');

  // ── Title Generator state ─────────────────────────────────────────────────
  const [titlesLoading, setTitlesLoading] = useState(false);
  const [titleCats,     setTitleCats]     = useState<TitleCat[]>(persisted.current.titleCats ?? []);
  const [titlesError,   setTitlesError]   = useState('');
  const [copied,        setCopied]        = useState<string | null>(null);

  // ── Persist state whenever any key piece changes ──────────────────────────
  useEffect(() => {
    saveState({ query, data, activeTab, ideas, ideasContext, titleCats });
  }, [query, data, activeTab, ideas, ideasContext, titleCats]);

  // ── Research handler ──────────────────────────────────────────────────────
  const handleSearch = async () => {
    const q = query.trim();
    if (!q || loading) return;
    setLoading(true);
    setError('');
    setData(null);
    setActiveTab('overview');
    // Clear AI results when a new search runs
    setIdeas([]);
    setTitleCats([]);
    setIdeasError('');
    setTitlesError('');
    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, videoLimit: 50, channelLimit: 50, useCache: true }),
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

  // ── Ideas handler ─────────────────────────────────────────────────────────
  const generateIdeas = useCallback(async () => {
    const topic = query.trim();
    if (!topic) return;
    setIdeasLoading(true);
    setIdeasError('');
    setIdeas([]);
    // Build context from research data if available
    const researchContext = ideasContext || data?.session?.searchTerms
      ?.slice(0, 10)
      .map(t => t.term)
      .join(', ') || '';
    try {
      const r = await fetch('/api/ideas/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, researchPatterns: researchContext }),
      });
      let d: any;
      try { d = await r.json(); }
      catch { throw new Error(`Server error (${r.status})`); }
      if (!d.success) throw new Error(d.error || 'Generation failed');
      setIdeas(d.data.ideas || []);
    } catch (e: any) {
      setIdeasError(e.message || 'Failed');
    } finally {
      setIdeasLoading(false);
    }
  }, [query, ideasContext, data]);

  // ── Titles handler ────────────────────────────────────────────────────────
  const generateTitles = useCallback(async () => {
    const topic = query.trim();
    if (!topic) return;
    setTitlesLoading(true);
    setTitlesError('');
    setTitleCats([]);
    const researchData = data?.session?.searchTerms
      ?.slice(0, 10)
      .map(t => t.term)
      .join(', ') || '';
    try {
      const r = await fetch('/api/titles/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, researchData }),
      });
      let d: any;
      try { d = await r.json(); }
      catch { throw new Error(`Server error (${r.status})`); }
      if (!d.success) throw new Error(d.error || 'Generation failed');
      setTitleCats(d.data.byCategory || []);
    } catch (e: any) {
      setTitlesError(e.message || 'Failed');
    } finally {
      setTitlesLoading(false);
    }
  }, [query, data]);

  const copy = (t: string) => {
    navigator.clipboard.writeText(t);
    setCopied(t);
    setTimeout(() => setCopied(null), 1800);
  };

  const s = data?.session;

  // ── Tab definitions ───────────────────────────────────────────────────────
  const TABS: { id: TabId; label: string; icon: React.ReactNode; count?: number; aiOnly?: boolean }[] = [
    { id: 'overview',      label: 'Overview',      icon: <Eye       className="w-3.5 h-3.5" /> },
    { id: 'videos',        label: 'Videos',        icon: <Zap       className="w-3.5 h-3.5" />, count: s?.youtubeData.searchResult.videos.length },
    { id: 'channels',      label: 'Channels',      icon: <Users     className="w-3.5 h-3.5" />, count: s?.youtubeData.searchResult.channels.length },
    { id: 'topics',        label: 'Topics',        icon: <Layers    className="w-3.5 h-3.5" />, count: s?.discoveredTopics?.all.length },
    { id: 'opportunities', label: 'Opportunities', icon: <Lightbulb className="w-3.5 h-3.5" />, count: s?.searchIntelligence?.opportunities.length },
    { id: 'titles',        label: 'Titles',        icon: <FileText  className="w-3.5 h-3.5" />, count: s?.searchIntelligence?.titles.length },
    { id: 'ideas',         label: 'AI Ideas',      icon: <BarChart2 className="w-3.5 h-3.5" />, count: ideas.length || undefined, aiOnly: true },
    { id: 'titlesgen',     label: 'AI Titles',     icon: <Zap       className="w-3.5 h-3.5" />, count: titleCats.flatMap(c => c.titles).length || undefined, aiOnly: true },
  ];

  const showTabs = data || query.trim().length > 0;

  return (
    <AppLayout>
      <div className="min-h-screen bg-[hsl(var(--background))]">

        {/* ── Top bar ──────────────────────────────────────────────── */}
        <div className="sticky top-0 z-20 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))/95] backdrop-blur-sm">
          <div className="px-3 sm:px-6 h-14 flex items-center gap-2 sm:gap-4">

            {/* Title — hidden on small screens to save space */}
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <Search className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
              <span className="text-sm font-semibold text-[hsl(var(--foreground))]">YouTube Research</span>
            </div>

            {/* Search bar */}
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 flex items-center bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border))] rounded-lg px-3 h-9 gap-2 focus-within:border-[hsl(var(--primary))/60] transition-colors">
                <Search className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))] shrink-0" />
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="Search any topic…"
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
                className="h-9 px-3 sm:px-4 rounded-lg bg-[hsl(var(--primary))] text-white text-sm font-semibold flex items-center gap-1.5 hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0"
              >
                {loading
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span className="hidden sm:inline"> Researching…</span></>
                  : <><Search className="w-3.5 h-3.5" /><span className="hidden sm:inline"> Research</span></>
                }
              </button>
            </div>

            {data && (
              <div className="hidden xl:flex ml-auto shrink-0">
                <DataSourceLegend />
              </div>
            )}
          </div>

          {/* ── Tab bar ────────────────────────────────────────────── */}
          {showTabs && (
            <div className="px-3 sm:px-6 flex items-center gap-0.5 border-t border-[hsl(var(--border))] overflow-x-auto scrollbar-hide">
              {TABS.map(tab => {
                // AI-only tabs always show when there's a query
                const visible = tab.aiOnly ? query.trim().length > 0 : true;
                if (!visible) return null;
                // Data tabs only show when data is loaded
                if (!tab.aiOnly && !data) return null;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 h-10 text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                      activeTab === tab.id
                        ? 'text-[hsl(var(--foreground))]'
                        : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                    }`}
                  >
                    {tab.icon}
                    <span className="hidden xs:inline sm:inline">{tab.label}</span>
                    {tab.count != null && tab.count > 0 && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        activeTab === tab.id
                          ? 'bg-[hsl(var(--primary))/15] text-[hsl(var(--primary))]'
                          : 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--muted-foreground))]'
                      }`}>
                        {tab.count}
                      </span>
                    )}
                    {tab.aiOnly && (
                      <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-purple-500/15 text-purple-400 hidden sm:inline">AI</span>
                    )}
                    {activeTab === tab.id && (
                      <motion.div
                        layoutId="tab-underline"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-[hsl(var(--primary))] rounded-full"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Content ──────────────────────────────────────────────── */}
        <div className="px-3 sm:px-6 py-4 sm:py-5 max-w-[1600px] mx-auto">

          {/* Error */}
          {error && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[1,2,3,4].map(i => <div key={i} className="skeleton h-20 sm:h-24 rounded-xl" />)}
              </div>
              <div className="skeleton h-40 sm:h-48 rounded-xl" />
              <div className="skeleton h-52 sm:h-64 rounded-xl" />
            </div>
          )}

          {/* ── Research tab panels ─────────────────────────────────── */}
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

          {/* ── AI Ideas tab ─────────────────────────────────────────── */}
          {activeTab === 'ideas' && !loading && (
            <AnimatePresence mode="wait">
              <motion.div key="ideas-panel" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>

                {/* Context + generate */}
                <div className="mb-4 flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={ideasContext}
                    onChange={e => setIdeasContext(e.target.value)}
                    placeholder="Optional: paste extra context or notes…"
                    className="flex-1 h-9 bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border))] rounded-lg px-3 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] outline-none focus:border-[hsl(var(--primary))/60] transition-colors"
                  />
                  <button
                    onClick={generateIdeas}
                    disabled={ideasLoading || !query.trim()}
                    className="h-9 px-4 rounded-lg bg-[hsl(var(--primary))] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-40 shrink-0 transition-opacity"
                  >
                    {ideasLoading
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
                      : <><Lightbulb className="w-3.5 h-3.5" /> Generate Ideas</>
                    }
                  </button>
                </div>

                {ideasError && (
                  <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-400">{ideasError}</p>
                  </div>
                )}

                {ideasLoading && (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--primary))]" />
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">Generating content ideas…</p>
                  </div>
                )}

                {!ideasLoading && ideas.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">
                      <span className="font-semibold text-[hsl(var(--foreground))]">{ideas.length}</span> ideas for <span className="font-semibold text-[hsl(var(--foreground))]">{query}</span>
                    </p>
                    {ideas.map((idea, i) => (
                      <div key={i} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary))/30] transition-colors overflow-hidden">
                        {/* Card header: category + scores */}
                        <div className="flex items-center justify-between px-4 pt-3 pb-0 gap-3">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[hsl(var(--primary))/10] text-[hsl(var(--primary))] border border-[hsl(var(--primary))/20]">
                            {idea.category}
                          </span>
                          <div className="flex gap-3 shrink-0">
                            {[
                              { l: 'Visual', v: idea.visualPotential },
                              { l: 'Search', v: idea.searchability },
                              { l: 'Story',  v: idea.storytellingPotential },
                            ].map(sc => (
                              <div key={sc.l} className="text-center">
                                <p className={`text-sm font-bold leading-none ${scoreColor(sc.v)}`}>{sc.v}</p>
                                <p className="text-[9px] text-[hsl(var(--muted-foreground))] mt-0.5">{sc.l}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Title */}
                        <div className="px-4 pt-2 pb-0">
                          <p className="text-sm font-bold text-[hsl(var(--foreground))] leading-snug">
                            {idea.title || idea.angle}
                          </p>
                        </div>

                        {/* Divider + Hook */}
                        {idea.hook && idea.hook !== idea.title && idea.hook !== idea.angle && (
                          <>
                            <div className="mx-4 mt-2.5 border-t border-[hsl(var(--border))]" />
                            <div className="px-4 py-2.5 flex items-start gap-2">
                              <span className="shrink-0 mt-0.5 text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] w-8">Hook</span>
                              <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed italic">
                                "{idea.hook}"
                              </p>
                            </div>
                          </>
                        )}

                        {/* ── Action buttons ── */}
                        <div className="mx-4 mt-2 mb-3 border-t border-[hsl(var(--border))] pt-3 flex flex-wrap gap-2">
                          {/* Create Project → script → voice flow */}
                          <Link
                            href={`/projects?newTitle=${encodeURIComponent(idea.title || idea.angle)}&newTopic=${encodeURIComponent(query)}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[hsl(var(--primary))] text-white hover:opacity-90 transition-opacity"
                          >
                            <FolderPlus className="w-3 h-3" /> Create Project
                          </Link>

                          {/* Write Script */}
                          <Link
                            href={`/scripts/generator?topic=${encodeURIComponent(idea.title || idea.angle)}&research=${encodeURIComponent(JSON.stringify({ topic: query, angle: idea.title, keywords: [], difficulty: 'medium', opportunityScore: 75 }))}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] text-[hsl(var(--foreground))] hover:border-[hsl(var(--primary))/50] hover:text-[hsl(var(--primary))] transition-all"
                          >
                            <FileText className="w-3 h-3" /> Write Script
                          </Link>

                          {/* Visuals */}
                          <Link
                            href={`/visuals/prompts`}
                            onClick={() => sessionStorage.setItem('pendingIdeaTitle', idea.title || idea.angle)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] text-[hsl(var(--foreground))] hover:border-[hsl(var(--primary))/50] hover:text-[hsl(var(--primary))] transition-all"
                          >
                            <Layers className="w-3 h-3" /> Visuals
                          </Link>

                          {/* Voiceover */}
                          <Link
                            href={`/voice`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] text-[hsl(var(--foreground))] hover:border-[hsl(var(--primary))/50] hover:text-[hsl(var(--primary))] transition-all"
                          >
                            <Mic2 className="w-3 h-3" /> Voiceover
                          </Link>

                          {/* Optimize — tags, description, thumbnail */}
                          <Link
                            href={`/optimize?topic=${encodeURIComponent(idea.title || idea.angle)}&niche=${encodeURIComponent(query)}&hook=${encodeURIComponent(idea.hook || '')}&value=${encodeURIComponent(idea.value || '')}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-purple-500/30 bg-purple-500/8 text-purple-400 hover:bg-purple-500/15 transition-all"
                          >
                            <Tag className="w-3 h-3" /> Optimize
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!ideasLoading && ideas.length === 0 && !ideasError && (
                  <EmptyAI
                    icon={<Lightbulb className="w-10 h-10" />}
                    title="Generate Content Ideas"
                    desc={query.trim() ? `Click Generate Ideas to get AI-powered content ideas for "${query}"` : 'Run a research search first, then generate ideas based on real YouTube data'}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          )}

          {/* ── AI Title Generator tab ────────────────────────────── */}
          {activeTab === 'titlesgen' && !loading && (
            <AnimatePresence mode="wait">
              <motion.div key="titlesgen-panel" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>

                <div className="mb-4 flex justify-end">
                  <button
                    onClick={generateTitles}
                    disabled={titlesLoading || !query.trim()}
                    className="h-9 px-4 rounded-lg bg-[hsl(var(--primary))] text-white text-sm font-semibold flex items-center gap-2 hover:opacity-90 disabled:opacity-40 transition-opacity"
                  >
                    {titlesLoading
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
                      : <><Zap className="w-3.5 h-3.5" /> Generate Titles</>
                    }
                  </button>
                </div>

                {titlesError && (
                  <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-400">{titlesError}</p>
                  </div>
                )}

                {titlesLoading && (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--primary))]" />
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">Generating titles…</p>
                  </div>
                )}

                {!titlesLoading && titleCats.length > 0 && (
                  <div className="space-y-6">
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      <span className="font-semibold text-[hsl(var(--foreground))]">
                        {titleCats.reduce((s, c) => s + c.titles.length, 0)}
                      </span> titles for <span className="font-semibold text-[hsl(var(--foreground))]">{query}</span>
                    </p>
                    {titleCats.map(cat => (
                      <div key={cat.category}>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">
                          {cat.category}
                        </p>
                        <div className="space-y-1.5">
                          {cat.titles.map((t, i) => (
                            <div key={i}
                              className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 flex items-center gap-3 hover:border-[hsl(var(--primary))/30] transition-colors group"
                            >
                              <p className="flex-1 text-sm text-[hsl(var(--foreground))]">{t}</p>
                              <button
                                onClick={() => copy(t)}
                                className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] transition-colors p-1"
                              >
                                {copied === t
                                  ? <Check className="w-4 h-4 text-emerald-400" />
                                  : <Copy className="w-4 h-4" />
                                }
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!titlesLoading && titleCats.length === 0 && !titlesError && (
                  <EmptyAI
                    icon={<Zap className="w-10 h-10" />}
                    title="Generate YouTube Titles"
                    desc={query.trim() ? `Click Generate Titles to create 30 titles across 10 angles for "${query}"` : 'Run a research search first to inform title generation'}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          )}

          {/* ── Empty state (no data, no query) ─────────────────────── */}
          {!data && !loading && !error && activeTab === 'overview' && (
            <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[hsl(var(--primary))/10] flex items-center justify-center mb-5">
                <Search className="w-6 h-6 sm:w-7 sm:h-7 text-[hsl(var(--primary))]" />
              </div>
              <h2 className="text-base sm:text-lg font-semibold text-[hsl(var(--foreground))] mb-2">
                YouTube Research Intelligence
              </h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))] max-w-md mb-8 sm:mb-10 px-4">
                Enter any topic above to analyze real YouTube data, identify breakout videos,
                measure competition, generate content opportunities and AI-powered ideas.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl w-full px-2">
                {[
                  { num: '1', label: 'YouTube Data',       desc: 'Real videos & channels',   color: 'text-red-400',     bg: 'bg-red-500/8 border-red-500/15' },
                  { num: '2', label: 'Calculated Metrics', desc: 'Transparent formulas',      color: 'text-blue-400',    bg: 'bg-blue-500/8 border-blue-500/15' },
                  { num: '3', label: 'Topic Discovery',    desc: 'Verified search signals',   color: 'text-purple-400',  bg: 'bg-purple-500/8 border-purple-500/15' },
                  { num: '4', label: 'AI Ideas & Titles',  desc: 'Content angle generation',  color: 'text-emerald-400', bg: 'bg-emerald-500/8 border-emerald-500/15' },
                ].map(c => (
                  <div key={c.num} className={`rounded-xl border p-3 sm:p-4 text-left ${c.bg}`}>
                    <div className={`text-xs font-bold mb-1 ${c.color}`}>{c.num}</div>
                    <div className="text-xs font-semibold text-[hsl(var(--foreground))]">{c.label}</div>
                    <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">{c.desc}</div>
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

// ─── Empty state for AI tabs ──────────────────────────────────────────────────

function EmptyAI({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--surface-elevated))] flex items-center justify-center mb-4 text-[hsl(var(--muted-foreground))]">
        {icon}
      </div>
      <p className="text-sm font-semibold text-[hsl(var(--foreground))] mb-2">{title}</p>
      <p className="text-xs text-[hsl(var(--muted-foreground))] max-w-sm px-4">{desc}</p>
    </div>
  );
}
