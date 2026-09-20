'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Zap, Loader2, Copy, Check, Tag, FileText,
  Image, Search, RefreshCw, ChevronDown, ChevronUp,
  Sparkles, Hash, AlignLeft, Lightbulb,
} from 'lucide-react';
import type { OptimizeResult } from '@/app/api/optimize/generate/route';

/* ─── helpers ─────────────────────────────────────────────────────────────── */
function CopyBtn({ text, label = '' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const doCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={doCopy}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:border-[hsl(var(--primary))/40] transition-all">
      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied!' : (label || 'Copy')}
    </button>
  );
}

function Section({ title, icon, children, defaultOpen = true }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[hsl(var(--surface-hover))] transition-colors rounded-t-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[hsl(var(--primary))/10] flex items-center justify-center text-[hsl(var(--primary))]">
            {icon}
          </div>
          <span className="text-sm font-semibold">{title}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-[hsl(var(--muted-foreground))]" /> : <ChevronDown className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden">
            <div className="border-t border-[hsl(var(--border))]">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

/* ─── Inner component ─────────────────────────────────────────────────────── */
function OptimizeInner() {
  const sp      = useSearchParams();
  const initTopic = sp.get('topic') ?? '';
  const initNiche = sp.get('niche') ?? '';
  const initHook  = sp.get('hook')  ?? '';
  const initValue = sp.get('value') ?? '';
  const projectId = sp.get('projectId') ?? null;

  const [topic,       setTopic]       = useState(initTopic);
  const [niche,       setNiche]       = useState(initNiche);
  const [script,      setScript]      = useState('');
  const [generating,  setGenerating]  = useState(false);
  const [result,      setResult]      = useState<OptimizeResult | null>(null);
  const [error,       setError]       = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [savedToProject, setSavedToProject] = useState(false);

  /* If projectId in URL, fetch topic from project */
  useEffect(() => {
    if (!projectId || initTopic) return;
    fetch(`/api/projects?id=${projectId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data.topic) {
          setTopic(d.data.topic);
          setNiche(d.data.topic);
        }
      })
      .catch(() => {});
  }, [projectId, initTopic]);

  /* auto-generate if arriving from idea card with topic pre-filled */
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current) return;
    if (initTopic.trim()) {
      autoRan.current = true;
      handleGenerate(initTopic, initNiche, initHook, initValue, '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerate = useCallback(async (
    t = topic, n = niche, h = initHook, v = initValue, s = script,
  ) => {
    if (!t.trim()) return;
    setError('');
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch('/api/optimize/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: t, niche: n, hook: h, value: v, script: s }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error || 'Generation failed');
      setResult(d.data as OptimizeResult);
      // If linked to a project, save the optimize result (optional: no status change since already complete)
      if (projectId) {
        fetch('/api/projects', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update', projectId,
            updates: { optimizeResult: d.data },
          }),
        }).then(r => r.json()).then(pd => { if (pd.success) setSavedToProject(true); }).catch(() => {});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate');
    } finally {
      setGenerating(false);
    }
  }, [topic, niche, script, initHook, initValue, projectId]);

  return (
    <AppLayout>
      <div className="min-h-screen bg-[hsl(var(--background))]">
        <PageHeader
          title="Video Optimizer"
          description="AI-powered title, description, tags & thumbnail prompts"
        >
          <div className="flex flex-wrap gap-2">
            {projectId && (
              <Link href={`/projects/${projectId}`}>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <FileText className="w-3.5 h-3.5" /> Back to Project
                </Button>
              </Link>
            )}
            {projectId && savedToProject && (
              <Badge variant="success" className="gap-1 text-xs">
                <Check className="w-3 h-3" /> Saved to Project
              </Badge>
            )}
            {result && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs"
                onClick={() => handleGenerate()} disabled={generating}>
                <RefreshCw className="w-3.5 h-3.5" /> Regenerate
              </Button>
            )}
          </div>
        </PageHeader>

        <div className="px-4 sm:px-8 py-6 max-w-[900px] mx-auto space-y-4">

          {/* ── Input card ── */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1.5 block text-xs">Video Topic *</Label>
                  <input
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                    placeholder="e.g. Why IKEA makes you spend more money"
                    className="w-full h-9 px-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] outline-none focus:border-[hsl(var(--primary))/60] transition-colors"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs">Niche / Channel Topic</Label>
                  <input
                    value={niche}
                    onChange={e => setNiche(e.target.value)}
                    placeholder="e.g. consumer psychology, personal finance"
                    className="w-full h-9 px-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] outline-none focus:border-[hsl(var(--primary))/60] transition-colors"
                  />
                </div>
              </div>

              {/* Advanced — paste script */}
              <button onClick={() => setShowAdvanced(v => !v)}
                className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] flex items-center gap-1 transition-colors">
                {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showAdvanced ? 'Hide' : 'Paste script for better results (optional)'}
              </button>

              <AnimatePresence>
                {showAdvanced && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <Label className="mb-1.5 block text-xs">Script (optional — improves accuracy)</Label>
                    <Textarea
                      value={script}
                      onChange={e => setScript(e.target.value)}
                      placeholder="Paste your script here for more accurate keyword extraction and description…"
                      rows={5}
                      className="text-xs resize-none"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {error && (
                <p className="text-xs text-red-400 bg-red-500/8 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <Button onClick={() => handleGenerate()} disabled={generating || !topic.trim()}
                className="w-full sm:w-auto gap-2">
                {generating
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                  : <><Zap className="w-4 h-4" /> Generate Optimisation</>}
              </Button>
            </CardContent>
          </Card>

          {/* ── Generating state ── */}
          {generating && (
            <Card>
              <CardContent className="py-16 flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--primary))/10] flex items-center justify-center">
                    <Sparkles className="w-7 h-7 text-[hsl(var(--primary))] animate-pulse" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold">Optimising your video…</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                    Generating title, description, tags & thumbnail prompt
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Results ── */}
          <AnimatePresence>
            {result && !generating && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className="space-y-4">

                {/* Keywords strip */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Search className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
                      <span className="text-xs font-semibold">Target Keywords</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-[hsl(var(--primary))] text-white">
                        {result.primaryKeyword}
                      </span>
                      {result.secondaryKeywords.map((kw, i) => (
                        <span key={i} className="px-3 py-1 rounded-full text-xs border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] text-[hsl(var(--muted-foreground))]">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Title */}
                <Section title="Video Title" icon={<FileText className="w-3.5 h-3.5" />}>
                  <div className="p-5 space-y-4">
                    {/* Main title */}
                    <div className="rounded-xl border border-[hsl(var(--primary))/30] bg-[hsl(var(--primary))/5] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-bold text-[hsl(var(--foreground))] leading-snug flex-1">
                          {result.title}
                        </p>
                        <CopyBtn text={result.title} />
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-[10px] font-medium ${result.title.length > 60 ? 'text-amber-400' : 'text-green-400'}`}>
                          {result.title.length}/70 chars
                        </span>
                        <Badge variant="outline" className="text-[10px]">Recommended</Badge>
                      </div>
                    </div>

                    {/* Alternatives */}
                    <div>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] font-medium mb-2">Alternatives</p>
                      <div className="space-y-2">
                        {result.titleAlternatives.map((t, i) => (
                          <div key={i} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))]">
                            <p className="text-sm text-[hsl(var(--foreground))] flex-1">{t}</p>
                            <CopyBtn text={t} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Section>

                {/* Description */}
                <Section title="Video Description" icon={<AlignLeft className="w-3.5 h-3.5" />}>
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">
                        {result.description.length} characters · includes timestamps & hashtags
                      </span>
                      <CopyBtn text={result.description} label="Copy description" />
                    </div>
                    <div className="rounded-xl bg-[hsl(var(--background))] border border-[hsl(var(--border))] p-4 max-h-72 overflow-y-auto">
                      <pre className="text-xs text-[hsl(var(--foreground))] whitespace-pre-wrap leading-relaxed font-sans">
                        {result.description}
                      </pre>
                    </div>
                  </div>
                </Section>

                {/* Tags */}
                <Section title="Tags" icon={<Hash className="w-3.5 h-3.5" />}>
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">
                        {result.tags.length} tags · ordered by relevance
                      </span>
                      <CopyBtn text={result.tags.join(', ')} label="Copy all tags" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {result.tags.map((tag, i) => (
                        <span key={i}
                          className={`px-2.5 py-1 rounded-lg text-xs border cursor-pointer transition-all select-all ${
                            i < 3
                              ? 'border-[hsl(var(--primary))/40] bg-[hsl(var(--primary))/8] text-[hsl(var(--primary))]'
                              : 'border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                          }`}>
                          {tag}
                        </span>
                      ))}
                    </div>
                    {/* YouTube tags box — ready to paste */}
                    <div className="mt-4">
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1.5">
                        YouTube tags input (comma-separated, ready to paste):
                      </p>
                      <div className="rounded-lg bg-[hsl(var(--background))] border border-[hsl(var(--border))] px-3 py-2 text-xs text-[hsl(var(--muted-foreground))] select-all break-all leading-relaxed">
                        {result.tags.join(', ')}
                      </div>
                    </div>
                  </div>
                </Section>

                {/* Thumbnail */}
                <Section title="Thumbnail" icon={<Image className="w-3.5 h-3.5" />}>
                  <div className="p-5 space-y-4">
                    {/* Text overlays */}
                    <div>
                      <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-2">
                        Text overlay options (short &amp; punchy)
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {result.thumbnailText.map((txt, i) => (
                          <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))]">
                            <span className="text-sm font-bold text-[hsl(var(--foreground))]">{txt}</span>
                            <CopyBtn text={txt} />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Midjourney prompt */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                          AI image prompt (Midjourney / DALL-E / Firefly)
                        </p>
                        <CopyBtn text={result.thumbnailPrompt} label="Copy prompt" />
                      </div>
                      <div className="rounded-xl bg-gradient-to-br from-purple-500/5 to-blue-500/5 border border-purple-500/20 p-4">
                        <p className="text-xs text-[hsl(var(--foreground))] leading-relaxed select-all">
                          {result.thumbnailPrompt}
                        </p>
                      </div>
                    </div>
                  </div>
                </Section>

              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Empty state ── */}
          {!result && !generating && !error && (
            <Card>
              <CardContent className="py-16 flex flex-col items-center gap-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--primary))/8] flex items-center justify-center">
                  <Tag className="w-7 h-7 text-[hsl(var(--primary))]" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Optimise your video for YouTube</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 max-w-xs">
                    Enter a topic and click Generate to get a keyword-optimised title, description, tags and thumbnail prompt.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                  {['SEO Title', 'Description', 'Tags', 'Thumbnail Prompt'].map(f => (
                    <span key={f} className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))]">
                      <Lightbulb className="w-3 h-3" /> {f}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

export default function OptimizePage() {
  return (
    <Suspense>
      <OptimizeInner />
    </Suspense>
  );
}
