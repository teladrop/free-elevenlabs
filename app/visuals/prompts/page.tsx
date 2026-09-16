'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Loader2, Zap, AlertTriangle, Edit2, Check, X, ExternalLink,
  Layers, Copy, ClipboardCheck, History, Save,
} from 'lucide-react';
import { VisualStyle, ScriptLine } from '@/lib/types';

const STYLES: { id: VisualStyle; label: string }[] = [
  { id: '2d-stickman',       label: '2D Stickman'      },
  { id: '2d-minimal',        label: '2D Minimal'        },
  { id: '3d-stylized',       label: '3D Stylized'       },
  { id: '3d-isometric',      label: '3D Isometric'      },
  { id: 'cinematic',         label: 'Cinematic'         },
  { id: 'photorealistic',    label: 'Photorealistic'    },
  { id: 'infographic',       label: 'Infographic'       },
  { id: 'hand-drawn',        label: 'Hand-Drawn'        },
  { id: 'minimal-geometric', label: 'Minimal Geometric' },
];

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const row     = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } };

const LS_KEY = 'visualPrompts_state';

interface SavedState {
  scriptText: string;
  style: VisualStyle;
  bible: string;
  lines: ScriptLine[];
}

export default function VisualPromptsPage() {
  const [hydrated,    setHydrated]    = useState(false);
  const [scriptText,  setScriptText]  = useState('');
  const [style,       setStyle]       = useState<VisualStyle>('3d-stylized');
  const [bible,       setBible]       = useState('');
  const [generating,  setGenerating]  = useState(false);
  const [lines,       setLines]       = useState<ScriptLine[]>([]);
  const [editId,      setEditId]      = useState<string | null>(null);
  const [editVal,     setEditVal]     = useState('');
  const [error,       setError]       = useState('');
  const [genCount,    setGenCount]    = useState(0);
  const [copied,      setCopied]      = useState(false);
  const [saved,       setSaved]       = useState(false);

  // ── Restore on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    try {
      // sessionStorage takes priority (from Script Generator handoff)
      const pending = sessionStorage.getItem('pendingScript');
      if (pending) {
        setScriptText(pending);
        sessionStorage.removeItem('pendingScript');
      }

      // Load visual bible from settings
      const b = localStorage.getItem('visualBible');
      if (b) {
        try {
          const j = JSON.parse(b);
          setStyle(j.style || '3d-stylized');
          setBible([j.colorDirection, j.lighting, j.environment].filter(Boolean).join('. '));
        } catch {}
      }

      // Restore last session state (only if no handoff script)
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

  // ── Persist state ─────────────────────────────────────────────────────────
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      const state: SavedState = { scriptText, style, bible, lines };
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    }, 600);
  }, [scriptText, style, bible, lines, hydrated]);

  const split = (t: string) => t.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(s => s.length > 5);

  const generate = useCallback(async () => {
    if (!scriptText.trim()) { setError('Paste a script first'); return; }
    setGenerating(true); setError(''); setGenCount(0);
    try {
      const r = await fetch('/api/visuals/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptLines: split(scriptText), visualStyle: style, visualBible: bible || 'Consistent style.' }),
      });
      let d: any;
      try {
        d = await r.json();
      } catch {
        throw new Error(`Server error (${r.status}): ${await r.text().catch(() => r.statusText)}`);
      }
      if (!d.success) { setError(d.error || 'Generation failed'); return; }
      setLines(d.data.lines);
      setGenCount(d.data.generatedCount);
      sessionStorage.setItem('visualLines', JSON.stringify(d.data.lines));

      // Auto-save to history (non-blocking)
      fetch('/api/history/visuals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          scriptText,
          visualStyle: style,
          visualBible: bible,
          lines: d.data.lines,
        }),
      }).catch(() => {});

    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setGenerating(false); }
  }, [scriptText, style, bible]);

  const regen = useCallback(async (index: number) => {
    const sl = split(scriptText);
    try {
      const r = await fetch('/api/visuals/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptLines: sl, visualStyle: style, visualBible: bible, generateIndices: [index] }),
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

  if (!hydrated) return null;

  return (
    <AppLayout>
      <div className="min-h-screen bg-[hsl(var(--background))]">
        <PageHeader title="Visual Prompts" description="Every sentence gets a visual prompt — no exemptions">
          <div className="flex gap-2">
            <Link href="/visuals/history">
              <Button variant="outline" size="sm" className="gap-1.5">
                <History className="w-3.5 h-3.5" /> History
              </Button>
            </Link>
            {lines.length > 0 && (
              <>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={saveManually}>
                  {saved ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Saved</> : <><Save className="w-3.5 h-3.5" /> Save</>}
                </Button>
                <a href="/visuals/breakdown">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5" /> Line Breakdown
                  </Button>
                </a>
              </>
            )}
          </div>
        </PageHeader>

        <div className="px-8 py-6 max-w-[1280px] mx-auto grid grid-cols-[260px_1fr] gap-6">

          {/* Controls */}
          <div className="space-y-4 sticky top-4">
            <Card>
              <CardContent className="p-5 space-y-4">
                <div>
                  <Label className="mb-2 block">Visual Style</Label>
                  <div className="flex flex-col gap-1.5">
                    {STYLES.map(s => (
                      <button key={s.id} onClick={() => setStyle(s.id)}
                        className={`text-left px-3 py-2 rounded-lg text-xs font-medium transition-all border ${style === s.id
                          ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))/10] text-[hsl(var(--primary))]'
                          : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--surface-hover))] hover:text-[hsl(var(--foreground))]'}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block">Visual Bible</Label>
                  <Textarea value={bible} onChange={e => setBible(e.target.value)}
                    placeholder="Color, lighting, mood… (auto-loaded from Visual Styles)" rows={5} className="text-xs" />
                </div>
                <Button onClick={generate} disabled={generating || !scriptText.trim()} className="w-full gap-2">
                  {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><Zap className="w-4 h-4" /> Generate Prompts</>}
                </Button>
                {genCount > 0 && <p className="text-xs text-emerald-400 text-center">✓ {genCount} prompts generated</p>}
              </CardContent>
            </Card>
          </div>

          {/* Main */}
          <div className="space-y-4">
            {error && (
              <div className="flex items-start gap-2.5 rounded-xl bg-red-500/8 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{error}
              </div>
            )}

            <Card>
              <CardContent className="p-5">
                <Label className="mb-2 block">Script</Label>
                <Textarea value={scriptText} onChange={e => setScriptText(e.target.value)}
                  placeholder="Paste your TTS-ready script. Each sentence will get its own visual prompt." rows={7} />
                {scriptText && (
                  <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">{split(scriptText).length} sentences detected</p>
                )}
              </CardContent>
            </Card>

            {generating && (
              <Card className="py-16 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-[hsl(var(--primary))] mb-3" />
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Generating visual prompts…</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]/60 mt-1">1–3 minutes</p>
              </Card>
            )}

            {!generating && lines.length > 0 && (
              <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3">
                {/* Header row */}
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {lines.filter(l => l.visualPrompt?.trim() && !l.visualPrompt.startsWith('❌')).length} prompts ready
                    {lines.filter(l => l.visualPrompt?.startsWith('❌')).length > 0 && (
                      <span className="ml-2 text-red-400">
                        · {lines.filter(l => l.visualPrompt?.startsWith('❌')).length} failed (click ⚡ to retry)
                      </span>
                    )}
                  </p>
                  <button
                    onClick={copyAll}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      copied
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))] hover:text-[hsl(var(--foreground))] hover:border-[hsl(var(--primary))/40]'
                    }`}
                  >
                    {copied
                      ? <><ClipboardCheck className="w-3.5 h-3.5" /> Copied all prompts</>
                      : <><Copy className="w-3.5 h-3.5" /> Copy all prompts</>
                    }
                  </button>
                </div>

                {lines.map(line => (
                  <motion.div key={line.id} variants={row}>
                    <Card className="hover:border-[hsl(var(--primary))/30] transition-colors">
                      <CardContent className="p-4 grid grid-cols-[28px_1fr_1fr] gap-4 items-start">
                        <div className="pt-0.5">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">#{line.index + 1}</Badge>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-1.5">Narration</p>
                          <p className="text-sm leading-relaxed">{line.text}</p>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Visual Prompt</p>
                            <div className="flex gap-1">
                              {editId !== line.id
                                ? <>
                                    <button onClick={() => { setEditId(line.id); setEditVal(line.visualPrompt || ''); }}
                                      className="p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => regen(line.index)}
                                      className="p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] transition-colors">
                                      <Zap className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                : <>
                                    <button onClick={() => {
                                      setLines(prev => prev.map(l => l.id === line.id ? { ...l, visualPrompt: editVal } : l));
                                      setEditId(null);
                                    }} className="p-1 text-emerald-400"><Check className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => setEditId(null)} className="p-1 text-red-400"><X className="w-3.5 h-3.5" /></button>
                                  </>
                              }
                            </div>
                          </div>
                          {editId === line.id
                            ? <Textarea value={editVal} onChange={e => setEditVal(e.target.value)} rows={4} className="text-xs" autoFocus />
                            : line.visualPrompt
                              ? line.visualPrompt.startsWith('❌')
                                ? <p className="text-xs leading-relaxed text-red-400">{line.visualPrompt}</p>
                                : <p className="text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{line.visualPrompt}</p>
                              : <p className="text-xs text-amber-400/80 italic">Pending — click ⚡ to regenerate</p>
                          }
                          {line.duration && !editId && <p className="mt-1.5 text-[10px] text-[hsl(var(--muted-foreground))]/60">{line.duration}s</p>}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {!generating && lines.length === 0 && !error && (
              <Card className="py-16 text-center">
                <Layers className="w-10 h-10 mx-auto text-[hsl(var(--muted-foreground))] mb-3" />
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Paste your script, pick a style, then Generate Prompts</p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
