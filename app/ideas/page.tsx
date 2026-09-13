'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { motion } from 'framer-motion';
import { useState, useCallback } from 'react';
import {
  Search, Loader2, ExternalLink, TrendingUp, Lightbulb,
  Copy, Check, Zap, AlertTriangle, PlayCircle, BarChart2,
} from 'lucide-react';
import { ResearchResult, YouTubeVideoData } from '@/lib/types';

/* ─── helpers ─────────────────────────────────────────────────────────────── */
function fmtViews(n?: number) {
  if (!n) return '—';
  if (n >= 1_000_000) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1e3).toFixed(0)}K`;
  return String(n);
}
function fmtDuration(d?: string) {
  if (!d) return '';
  const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '';
  const h = parseInt(m[1] || '0'), min = parseInt(m[2] || '0'), s = parseInt(m[3] || '0');
  return h ? `${h}:${String(min).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${min}:${String(s).padStart(2,'0')}`;
}

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const row     = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } };

/* ─── Sub-components ──────────────────────────────────────────────────────── */
function VideoRow({ v }: { v: YouTubeVideoData }) {
  return (
    <motion.div variants={row}>
      <Card className="hover:border-[hsl(var(--primary))/40] transition-colors duration-150">
        <CardContent className="p-3 flex gap-3 items-center">
          {v.thumbnail && (
            <img src={v.thumbnail} alt="" className="w-24 h-14 rounded-lg object-cover shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight truncate">{v.title}</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
              {v.channelTitle} · {new Date(v.publishedAt).toLocaleDateString()}
              {v.duration && ` · ${fmtDuration(v.duration)}`}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-base font-bold text-[hsl(var(--foreground))]">{fmtViews(v.viewCount)}</p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">views</p>
          </div>
          <a href={`https://youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noreferrer"
            className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] transition-colors">
            <ExternalLink className="w-4 h-4" />
          </a>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ─── Main page ───────────────────────────────────────────────────────────── */
export default function IdeasPage() {
  const [tab, setTab] = useState('research');
  const [topic, setTopic] = useState('');
  const [context, setContext] = useState('');

  /* Research state */
  const [researching, setResearching] = useState(false);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [researchErr, setResearchErr] = useState('');

  /* Ideas state */
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  interface Idea { category: string; angle: string; hook: string; value: string; visualPotential: number; searchability: number; storytellingPotential: number }
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [ideasErr, setIdeasErr] = useState('');

  /* Titles state */
  const [loadingTitles, setLoadingTitles] = useState(false);
  interface TitleCat { category: string; titles: string[] }
  const [titleCats, setTitleCats] = useState<TitleCat[]>([]);
  const [titlesErr, setTitlesErr] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  /* ── actions ── */
  const research = useCallback(async () => {
    if (!topic.trim()) return;
    setResearching(true); setResearchErr(''); setResult(null);
    try {
      const r = await fetch(`/api/research/youtube?topic=${encodeURIComponent(topic)}&maxResults=20`);
      const d = await r.json();
      if (!d.success) { setResearchErr(d.error); return; }
      setResult(d.data);
    } catch (e) { setResearchErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setResearching(false); }
  }, [topic]);

  const generateIdeas = useCallback(async () => {
    if (!topic.trim()) return;
    setLoadingIdeas(true); setIdeasErr(''); setIdeas([]);
    try {
      const r = await fetch('/api/ideas/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, researchPatterns: context }),
      });
      const d = await r.json();
      if (!d.success) { setIdeasErr(d.error); return; }
      setIdeas(d.data.ideas || []);
    } catch (e) { setIdeasErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoadingIdeas(false); }
  }, [topic, context]);

  const generateTitles = useCallback(async () => {
    if (!topic.trim()) return;
    setLoadingTitles(true); setTitlesErr(''); setTitleCats([]);
    try {
      const r = await fetch('/api/titles/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, researchData: context }),
      });
      const d = await r.json();
      if (!d.success) { setTitlesErr(d.error); return; }
      setTitleCats(d.data.byCategory || []);
    } catch (e) { setTitlesErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoadingTitles(false); }
  }, [topic, context]);

  const copy = (t: string) => { navigator.clipboard.writeText(t); setCopied(t); setTimeout(() => setCopied(null), 1800); };

  const scoreColor = (v: number) => v >= 8 ? 'text-emerald-400' : v >= 6 ? 'text-amber-400' : 'text-red-400';

  /* shared loading / error helpers */
  const loading = tab === 'research' ? researching : tab === 'ideas' ? loadingIdeas : loadingTitles;
  const err     = tab === 'research' ? researchErr : tab === 'ideas' ? ideasErr : titlesErr;

  return (
    <AppLayout>
      <div className="min-h-screen bg-[hsl(var(--background))]">
        <PageHeader title="Ideas & Research" description="YouTube research, content angles and title generation — all in one place" />

        <div className="px-8 py-6 max-w-[1280px] mx-auto space-y-6">

          {/* ── Topic input ── */}
          <Card>
            <CardContent className="p-5">
              <div className="flex gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">Topic</p>
                  <Input value={topic} onChange={e => setTopic(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (tab === 'research' ? research() : tab === 'ideas' ? generateIdeas() : generateTitles())}
                    placeholder="e.g. IKEA's hidden business empire…" className="h-10 text-sm" />
                </div>
                <div className="flex-[2] min-w-[200px]">
                  <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">Research Context (optional)</p>
                  <Input value={context} onChange={e => setContext(e.target.value)}
                    placeholder="Paste notes, stats or YouTube data to inform generation…" className="h-10 text-sm" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Tabs ── */}
          <Tabs value={tab} onValueChange={setTab}>
            <div className="flex items-center justify-between">
              <TabsList className="bg-[hsl(var(--card))] border border-[hsl(var(--border))]">
                <TabsTrigger value="research"><Search className="w-3.5 h-3.5" />YouTube Research</TabsTrigger>
                <TabsTrigger value="ideas"><Lightbulb className="w-3.5 h-3.5" />Content Ideas</TabsTrigger>
                <TabsTrigger value="titles"><Zap className="w-3.5 h-3.5" />Title Generator</TabsTrigger>
              </TabsList>

              <Button
                onClick={tab === 'research' ? research : tab === 'ideas' ? generateIdeas : generateTitles}
                disabled={loading || !topic.trim()}
                size="sm" className="gap-2"
              >
                {loading
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
                  : tab === 'research'
                    ? <><Search className="w-3.5 h-3.5" /> Search YouTube</>
                    : tab === 'ideas'
                      ? <><Lightbulb className="w-3.5 h-3.5" /> Generate Ideas</>
                      : <><Zap className="w-3.5 h-3.5" /> Generate Titles</>
                }
              </Button>
            </div>

            {err && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-red-500/8 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{err}
              </div>
            )}

            {/* ── Research tab ── */}
            <TabsContent value="research">
              {loading && <LoadingCard text="Searching YouTube…" />}
              {!loading && result && (
                <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: 'Videos Found', value: result.videoCount, icon: PlayCircle },
                      { label: 'Common Themes', value: result.commonThemes.length, icon: BarChart2 },
                      { label: 'Title Patterns', value: result.titlePatterns.length, icon: TrendingUp },
                    ].map(s => (
                      <motion.div key={s.label} variants={row}>
                        <Card>
                          <CardContent className="p-4 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-[hsl(var(--primary))/12] flex items-center justify-center shrink-0">
                              <s.icon className="w-4 h-4 text-[hsl(var(--primary))]" />
                            </div>
                            <div>
                              <p className="text-2xl font-bold text-[hsl(var(--primary))]">{s.value}</p>
                              <p className="text-xs text-[hsl(var(--muted-foreground))]">{s.label}</p>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>

                  {/* Patterns + themes */}
                  {(result.titlePatterns.length > 0 || result.commonThemes.length > 0) && (
                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-3">Title Patterns</p>
                          <div className="space-y-2">
                            {result.titlePatterns.map((p, i) => (
                              <div key={i} className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                                <TrendingUp className="w-3.5 h-3.5 text-[hsl(var(--primary))] shrink-0" />{p}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-3">Common Themes</p>
                          <div className="flex flex-wrap gap-2">
                            {result.commonThemes.map((t, i) => <Badge key={i}>{t}</Badge>)}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Videos */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-3">Results</p>
                    <div className="space-y-2">
                      {result.videos.map(v => <VideoRow key={v.videoId} v={v} />)}
                    </div>
                  </div>
                </motion.div>
              )}
              {!loading && !result && !err && <EmptyCard text="Enter a topic and click Search YouTube" sub="Requires YOUTUBE_API_KEY in .env.local" />}
            </TabsContent>

            {/* ── Ideas tab ── */}
            <TabsContent value="ideas">
              {loading && <LoadingCard text="Generating content ideas via OpenRouter…" />}
              {!loading && ideas.length > 0 && (
                <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">{ideas.length} ideas</p>
                  {ideas.map((idea, i) => (
                    <motion.div key={i} variants={row}>
                      <Card className="hover:border-[hsl(var(--primary))/40] transition-colors">
                        <CardContent className="p-4 flex gap-4 items-start">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <Badge variant="secondary">{idea.category || 'Idea'}</Badge>
                            </div>
                            <p className="font-semibold text-sm mb-1">{idea.angle}</p>
                            <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">{idea.hook}</p>
                          </div>
                          <div className="flex gap-4 shrink-0">
                            {[
                              { l: 'Visual', v: idea.visualPotential },
                              { l: 'Search', v: idea.searchability },
                              { l: 'Story',  v: idea.storytellingPotential },
                            ].map(s => (
                              <div key={s.l} className="text-center w-10">
                                <p className={`text-lg font-bold ${scoreColor(s.v)}`}>{s.v}</p>
                                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{s.l}</p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </motion.div>
              )}
              {!loading && ideas.length === 0 && !err && <EmptyCard text="Enter a topic and generate original content ideas" />}
            </TabsContent>

            {/* ── Titles tab ── */}
            <TabsContent value="titles">
              {loading && <LoadingCard text="Generating titles via OpenRouter…" />}
              {!loading && titleCats.length > 0 && (
                <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
                  {titleCats.map(cat => (
                    <motion.div key={cat.category} variants={row}>
                      <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">{cat.category}</p>
                      <div className="space-y-2">
                        {cat.titles.map((t, i) => (
                          <Card key={i} className="group hover:border-[hsl(var(--primary))/40] transition-colors">
                            <CardContent className="px-4 py-3 flex items-center gap-3">
                              <p className="flex-1 text-sm">{t}</p>
                              <button onClick={() => copy(t)}
                                className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] transition-colors p-1">
                                {copied === t ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                              </button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
              {!loading && titleCats.length === 0 && !err && <EmptyCard text="Enter a topic and generate titles across 10 creative angles" />}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}

function LoadingCard({ text }: { text: string }) {
  return (
    <Card className="py-16 text-center">
      <Loader2 className="w-8 h-8 animate-spin mx-auto text-[hsl(var(--primary))] mb-3" />
      <p className="text-sm text-[hsl(var(--muted-foreground))]">{text}</p>
    </Card>
  );
}
function EmptyCard({ text, sub }: { text: string; sub?: string }) {
  return (
    <Card className="py-16 text-center">
      <p className="text-sm text-[hsl(var(--muted-foreground))]">{text}</p>
      {sub && <p className="text-xs text-[hsl(var(--muted-foreground))]/60 mt-2">{sub}</p>}
    </Card>
  );
}
