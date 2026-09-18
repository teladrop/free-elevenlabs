'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2, Zap, AlertTriangle, Edit2, Check, X, ExternalLink,
  Layers, Copy, ClipboardCheck, History, Save, Palette, FileText,
} from 'lucide-react';
import { VisualStyle, ScriptLine } from '@/lib/types';

const STYLES: { id: VisualStyle; label: string; emoji: string }[] = [
  { id: '2d-stickman',       label: '2D Stickman',       emoji: '🕺' },
  { id: '2d-minimal',        label: '2D Minimal',         emoji: '✏️' },
  { id: '3d-stylized',       label: '3D Stylized',        emoji: '🎨' },
  { id: '3d-isometric',      label: '3D Isometric',       emoji: '📐' },
  { id: 'cinematic',         label: 'Cinematic',          emoji: '🎬' },
  { id: 'photorealistic',    label: 'Photorealistic',     emoji: '📸' },
  { id: 'infographic',       label: 'Infographic',        emoji: '📊' },
  { id: 'hand-drawn',        label: 'Hand-Drawn',         emoji: '🖊️' },
  { id: 'minimal-geometric', label: 'Minimal Geometric',  emoji: '🔷' },
];

const LS_KEY = 'visualPrompts_state';

interface SavedState {
  scriptText: string;
  style: VisualStyle;
  bible: string;
  lines: ScriptLine[];
}

function VisualPromptsInner() {
  const sp           = useSearchParams();
  const urlProjectId = sp.get('projectId') ?? null;

  const [hydrated,        setHydrated]        = useState(false);
  const [projectId,       setProjectId]       = useState<string | null>(urlProjectId);
  const [savedToProject,  setSavedToProject]  = useState(false);
  const [scriptText, setScriptText] = useState('');
  const [style,      setStyle]      = useState<VisualStyle>('3d-stylized');
  const [bible,      setBible]      = useState('');
  const [generating, setGenerating] = useState(false);
  const [lines,      setLines]      = useState<ScriptLine[]>([]);
  const [editId,     setEditId]     = useState<string | null>(null);
  const [editVal,    setEditVal]    = useState('');
  const [error,      setError]      = useState('');
  const [genCount,   setGenCount]   = useState(0);
  const [copied,     setCopied]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  // Mobile: show settings or results
  const [mobileView, setMobileView] = useState<'settings' | 'results'>('settings');

  useEffect(() => {
    try {
      const pending = sessionStorage.getItem('pendingScript');
      if (pending) {
        setScriptText(pending);
        sessionStorage.removeItem('pendingScript');
      }
      // Pick up projectId from sessionStorage if not in URL
      if (!urlProjectId) {
        const pid = sessionStorage.getItem('currentProjectId');
        if (pid) setProjectId(pid);
      }
      const b = localStorage.getItem('visualBible');
      if (b) {
        try {
          const j = JSON.parse(b);
          setStyle(j.style || '3d-stylized');
          setBible([j.colorDirection, j.lighting, j.environment].filter(Boolean).join('. '));
        } catch {}
      }
      if (!pending) {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) {
          const s: SavedState = JSON.parse(raw);
          setScriptText(s.scriptText || '');
          if (s.style) setStyle(s.style);
          setBible(s.bible || '');
          setLines(s.lines || []);
        }
      }
    } catch {}
    setHydrated(true);
  }, []);

  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      localStorage.setItem(LS_KEY, JSON.stringify({ scriptText, style, bible, lines }));
    }, 600);
  }, [scriptText, style, bible, lines, hydrated]);

  const split = (t: string) =>
    t.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(s => s.length > 5);

  const generate = useCallback(async () => {
    if (!scriptText.trim()) { setError('Paste a script first'); return; }
    setGenerating(true); setError(''); setGenCount(0);
    setMobileView('results');
    try {
      const r = await fetch('/api/visuals/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptLines: split(scriptText),
          visualStyle: style,
          visualBible: bible || 'Consistent style.',
        }),
      });
      let d: any;
      try { d = await r.json(); } catch {
        throw new Error(`Server error (${r.status}): ${await r.text().catch(() => r.statusText)}`);
      }
      if (!d.success) { setError(d.error || 'Generation failed'); return; }
      setLines(d.data.lines);
      setGenCount(d.data.generatedCount);
      sessionStorage.setItem('visualLines', JSON.stringify(d.data.lines));
      fetch('/api/history/visuals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', scriptText, visualStyle: style, visualBible: bible, lines: d.data.lines }),
      }).catch(() => {});
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setGenerating(false); }
  }, [scriptText, style, bible]);

  const regen = useCallback(async (index: number) => {
    try {
      const r = await fetch('/api/visuals/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptLines: split(scriptText), visualStyle: style, visualBible: bible, generateIndices: [index] }),
      });
      let d: any;
      try { d = await r.json(); } catch { return; }
      if (d.success) {
        const u = d.data.lines[index];
        if (u) setLines(prev => prev.map(l => l.index === index ? u : l));
      }
    } catch {}
  }, [scriptText, style, bible]);

  const copyAll = useCallback(() => {
    const text = lines
      .filter(l => l.visualPrompt?.trim() && !l.visualPrompt.startsWith('❌'))
      .map(l => l.visualPrompt!.trim())
      .join('\n\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }, [lines]);

  const saveManually = async () => {
    if (!lines.length) return;
    const r = await fetch('/api/history/visuals', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', scriptText, visualStyle: style, visualBible: bible, lines }),
    });
    if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
  };

  const saveVisualsToProject = async () => {
    if (!lines.length || !projectId) return;
    const r = await fetch('/api/projects', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update', projectId,
        updates: { lines, visualStyle: style, status: 'visual' },
      }),
    });
    if (r.ok) { setSavedToProject(true); setTimeout(() => setSavedToProject(false), 2500); }
  };

  if (!hydrated) return null;

  const readyCount  = lines.filter(l => l.visualPrompt?.trim() && !l.visualPrompt.startsWith('❌')).length;
  const failedCount = lines.filter(l => l.visualPrompt?.startsWith('❌')).length;

  /* ── Settings panel ─────────────────────────────────────────────────── */
  const settingsPanel = (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-center gap-2 mb-4 px-1">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg">
          <Palette className="w-4 h-4 text-white" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-[hsl(var(--foreground))]">Visual Settings</h2>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Style & script input</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-0.5 pb-2">
        {/* Script input */}
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3">
          <Label className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-2 block">Script</Label>
          <Textarea
            value={scriptText}
            onChange={e => setScriptText(e.target.value)}
            placeholder="Paste your TTS-ready script. Each sentence gets its own visual prompt."
            rows={6}
            className="text-xs resize-none"
          />
          {scriptText && (
            <p className="mt-2 text-[10px] text-[hsl(var(--muted-foreground))]">
              {split(scriptText).length} sentences detected
            </p>
          )}
        </div>

        {/* Style picker */}
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3">
          <Label className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-2 block">Visual Style</Label>
          <div className="grid grid-cols-1 gap-1.5">
            {STYLES.map(s => (
              <button
                key={s.id}
                onClick={() => setStyle(s.id)}
                className={`flex items-center gap-2.5 text-left px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                  style === s.id
                    ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))/10] text-[hsl(var(--primary))]'
                    : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--surface-hover))] hover:text-[hsl(var(--foreground))]'
                }`}
              >
                <span className="text-base leading-none">{s.emoji}</span>
                {s.label}
                {style === s.id && <Check className="w-3 h-3 ml-auto" />}
              </button>
            ))}
          </div>
        </div>

        {/* Visual bible */}
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3">
          <Label className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-2 block">
            Visual Bible
            <span className="ml-1 text-[10px] opacity-60">(auto-loaded from settings)</span>
          </Label>
          <Textarea
            value={bible}
            onChange={e => setBible(e.target.value)}
            placeholder="Color palette, lighting style, environment mood…"
            rows={4}
            className="text-xs resize-none"
          />
        </div>
      </div>

      {/* Generate CTA */}
      <div className="pt-3 mt-2 border-t border-[hsl(var(--border))]">
        <Button
          onClick={generate}
          disabled={generating || !scriptText.trim()}
          className="w-full gap-2 h-11 text-sm font-semibold"
        >
          {generating
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
            : <><Zap className="w-4 h-4" /> Generate Prompts</>}
        </Button>
        {genCount > 0 && (
          <p className="text-xs text-emerald-400 text-center mt-2">✓ {genCount} prompts generated</p>
        )}
      </div>
    </div>
  );

  /* ── Results panel ──────────────────────────────────────────────────── */
  const resultsPanel = (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl bg-red-500/8 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{error}
        </div>
      )}

      {generating && (
        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-20 flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
            </div>
            <div className="absolute inset-0 rounded-2xl bg-purple-500/10 animate-ping" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Generating visual prompts…</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">1–3 minutes depending on script length</p>
          </div>
        </div>
      )}

      {!generating && lines.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {/* Results toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-3 text-xs">
              <span className="text-[hsl(var(--muted-foreground))]">
                <span className="text-emerald-400 font-semibold">{readyCount}</span> ready
              </span>
              {failedCount > 0 && (
                <span className="text-red-400">
                  <span className="font-semibold">{failedCount}</span> failed
                  <span className="opacity-70 ml-1">(click ⚡ to retry)</span>
                </span>
              )}
            </div>
            <button
              onClick={copyAll}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                copied
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))] hover:text-[hsl(var(--foreground))] hover:border-[hsl(var(--primary))/40]'
              }`}
            >
              {copied
                ? <><ClipboardCheck className="w-3.5 h-3.5" /> Copied all</>
                : <><Copy className="w-3.5 h-3.5" /> Copy all</>}
            </button>
          </div>

          {lines.map(line => (
            <motion.div
              key={line.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="hover:border-[hsl(var(--primary))/30] transition-colors overflow-hidden">
                <CardContent className="p-0">
                  {/* Line number header */}
                  <div className="flex items-center justify-between px-4 py-2 bg-[hsl(var(--surface-elevated))] border-b border-[hsl(var(--border))]">
                    <Badge variant="outline" className="text-[10px] px-2 py-0.5">Scene #{line.index + 1}</Badge>
                    {line.duration && (
                      <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{line.duration}s</span>
                    )}
                  </div>

                  {/* Two-column on md+, stacked on mobile */}
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[hsl(var(--border))]">
                    {/* Narration */}
                    <div className="p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">
                        Narration
                      </p>
                      <p className="text-sm leading-relaxed text-[hsl(var(--foreground))]">{line.text}</p>
                    </div>

                    {/* Visual Prompt */}
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                          Visual Prompt
                        </p>
                        <div className="flex gap-1">
                          {editId !== line.id ? (
                            <>
                              <button
                                onClick={() => { setEditId(line.id); setEditVal(line.visualPrompt || ''); }}
                                className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-elevated))] transition-colors"
                                title="Edit"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => regen(line.index)}
                                className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))/8] transition-colors"
                                title="Regenerate"
                              >
                                <Zap className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setLines(prev => prev.map(l => l.id === line.id ? { ...l, visualPrompt: editVal } : l));
                                  setEditId(null);
                                }}
                                className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditId(null)}
                                className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {editId === line.id ? (
                        <Textarea
                          value={editVal}
                          onChange={e => setEditVal(e.target.value)}
                          rows={4}
                          className="text-xs resize-none"
                          autoFocus
                        />
                      ) : line.visualPrompt ? (
                        line.visualPrompt.startsWith('❌') ? (
                          <p className="text-xs leading-relaxed text-red-400">{line.visualPrompt}</p>
                        ) : (
                          <p className="text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{line.visualPrompt}</p>
                        )
                      ) : (
                        <p className="text-xs text-amber-400/80 italic">Pending — click ⚡ to regenerate</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {!generating && lines.length === 0 && !error && (
        <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] py-20 flex flex-col items-center gap-3 text-center px-4">
          <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border))] flex items-center justify-center">
            <Layers className="w-7 h-7 text-[hsl(var(--muted-foreground))]" />
          </div>
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">Visual prompts will appear here</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] max-w-xs">
            Paste your script, pick a visual style, then click <strong>Generate Prompts</strong>.
          </p>
        </div>
      )}
    </div>
  );

  return (
    <AppLayout>
      <div className="min-h-screen bg-[hsl(var(--background))]">
        <PageHeader title="Visual Prompts" description="Every sentence gets a visual prompt — no exemptions">
          <div className="flex flex-wrap gap-2">
            <Link href="/visuals/history">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <History className="w-3.5 h-3.5" /> History
              </Button>
            </Link>
            {projectId && (
              <Link href={`/projects/${projectId}`}>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <FileText className="w-3.5 h-3.5" /> Back to Project
                </Button>
              </Link>
            )}
            {lines.length > 0 && (
              <>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={saveManually}>
                  {saved
                    ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Saved</>
                    : <><Save className="w-3.5 h-3.5" /> Save</>}
                </Button>
                {projectId && (
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs border-[hsl(var(--primary))/40] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))/10]" onClick={saveVisualsToProject}>
                    {savedToProject
                      ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Saved to Project</>
                      : <><Save className="w-3.5 h-3.5" /> Save to Project</>}
                  </Button>
                )}
                <a href="/visuals/breakdown">
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                    <ExternalLink className="w-3.5 h-3.5" /> Breakdown
                  </Button>
                </a>
              </>
            )}
          </div>
        </PageHeader>

        {/* ── Mobile tab switcher ── */}
        <div className="flex md:hidden border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] sticky top-0 z-10">
          <button
            onClick={() => setMobileView('settings')}
            className={`flex-1 py-3 text-xs font-semibold transition-colors border-b-2 ${
              mobileView === 'settings'
                ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]'
                : 'border-transparent text-[hsl(var(--muted-foreground))]'
            }`}
          >
            <Palette className="w-3.5 h-3.5 inline mr-1" /> Settings
          </button>
          <button
            onClick={() => setMobileView('results')}
            className={`flex-1 py-3 text-xs font-semibold transition-colors border-b-2 ${
              mobileView === 'results'
                ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]'
                : 'border-transparent text-[hsl(var(--muted-foreground))]'
            }`}
          >
            <Layers className="w-3.5 h-3.5 inline mr-1" /> Results
            {lines.length > 0 && (
              <span className="ml-1 w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            )}
          </button>
        </div>

        <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
          {/* Desktop: side-by-side */}
          <div className="hidden md:grid md:grid-cols-[300px_1fr] gap-6 items-start">
            <div className="sticky top-4 h-[calc(100vh-140px)] overflow-y-auto rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
              {settingsPanel}
            </div>
            <div>{resultsPanel}</div>
          </div>

          {/* Mobile: single pane */}
          <div className="md:hidden">
            <AnimatePresence mode="wait">
              {mobileView === 'settings' ? (
                <motion.div
                  key="settings"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4"
                  style={{ minHeight: '70vh' }}
                >
                  {settingsPanel}
                </motion.div>
              ) : (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                >
                  {resultsPanel}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function VisualPromptsPage() {
  return (
    <Suspense>
      <VisualPromptsInner />
    </Suspense>
  );
}
