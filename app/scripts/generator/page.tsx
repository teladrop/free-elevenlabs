'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { motion, AnimatePresence } from 'framer-motion';
import { Suspense, useCallback, useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2, Copy, Check, Zap, AlertTriangle, ArrowRight,
  BarChart2, FileText, Info, History, Save, ChevronDown, ChevronUp,
  Settings2, Sparkles,
} from 'lucide-react';
import { ScriptGenerationParams, ScriptAnalysis } from '@/lib/types';

const CONTENT_TYPES = ['Documentary','Educational','Explainer','Storytelling','Business','Investigative','Science','History','Geopolitics'];
const STYLES        = ['Documentary','Business Documentary','Explainer','Educational','Science','Storytelling','Investigative','Video Essay','Listicle','Short-form'];
const TONES         = ['Curious','Cinematic','Authoritative','Conversational','Mysterious','Serious','Energetic','Calm','Analytical'];

const LS_KEY = 'scriptGen_state';

interface SavedState {
  topic: string; ctype: string; style: string; audience: string;
  length: number; tone: string; intensity: number; keyPts: string;
  research: string; platform: string; analyze: boolean;
  script: string; analysis: ScriptAnalysis | null;
}

function ScoreBar({ label, value, max = 10 }: { label: string; value: number; max?: number }) {
  const pct   = (value / max) * 100;
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
  const txt   = pct >= 70 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-red-400';
  return (
    <div className="mb-3">
      <div className="flex justify-between mb-1.5 text-xs">
        <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
        <span className={`font-bold ${txt}`}>{value}/{max}</span>
      </div>
      <div className="h-1.5 rounded-full bg-[hsl(var(--border))]">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }} className={`h-full rounded-full ${color}`} />
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs font-medium text-[hsl(var(--muted-foreground))]">{label}</Label>
      {children}
    </div>
  );
}

function GeneratorInner() {
  const sp = useSearchParams();
  const parseResearchContext = () => {
    try { const r = sp.get('research'); if (r) return JSON.parse(decodeURIComponent(r)); } catch {}
    return null;
  };
  const rc = parseResearchContext();
  const fromResearch = sp.get('research') !== null;
  const projectId    = sp.get('projectId') ?? null;

  const [hydrated,   setHydrated]   = useState(false);
  const [topic,      setTopic]      = useState(rc?.title || sp.get('topic') || '');
  const [ctype,      setCtype]      = useState('Educational');
  const [style,      setStyle]      = useState(sp.get('style') || 'Documentary');
  const [audience,   setAudience]   = useState('General audience');
  const [length,     setLength]     = useState(parseInt(sp.get('videoLength') || '10'));
  const [tone,       setTone]       = useState(sp.get('tone') || 'Conversational');
  const [intensity,  setIntensity]  = useState(7);
  const [keyPts,     setKeyPts]     = useState('');
  const [research,   setResearch]   = useState(() => {
    if (rc) return `YouTube Research Context:\nTopic: ${rc.topic}\nAngle: ${rc.angle}\nKeywords: ${rc.keywords?.join(', ')}\nDifficulty: ${rc.difficulty} competition\nOpportunity Score: ${rc.opportunityScore}/100`;
    return sp.get('research') || '';
  });
  const [platform,   setPlatform]   = useState('youtube');
  const [analyze,    setAnalyze]    = useState(true);
  const [script,     setScript]     = useState('');
  const [analysis,   setAnalysis]   = useState<ScriptAnalysis | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error,      setError]      = useState('');
  const [copied,     setCopied]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [savedToProject, setSavedToProject] = useState(false);
  const [tab,        setTab]        = useState('script');
  const [advOpen,    setAdvOpen]    = useState(false);
  // Mobile: show form or output
  const [mobileView, setMobileView] = useState<'form' | 'output'>('form');

  useEffect(() => {
    if (!fromResearch && !sp.get('topic')) {
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) {
          const s: SavedState = JSON.parse(raw);
          setTopic(s.topic || ''); setCtype(s.ctype || 'Educational');
          setStyle(s.style || 'Documentary'); setAudience(s.audience || 'General audience');
          setLength(s.length || 10); setTone(s.tone || 'Conversational');
          setIntensity(s.intensity ?? 7); setKeyPts(s.keyPts || '');
          setResearch(s.research || ''); setPlatform(s.platform || 'youtube');
          setAnalyze(s.analyze ?? true); setScript(s.script || '');
          setAnalysis(s.analysis || null);
        }
      } catch {}
    }
    setHydrated(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      localStorage.setItem(LS_KEY, JSON.stringify({ topic, ctype, style, audience, length, tone, intensity, keyPts, research, platform, analyze, script, analysis }));
    }, 600);
  }, [topic, ctype, style, audience, length, tone, intensity, keyPts, research, platform, analyze, script, analysis, hydrated]);

  const generate = useCallback(async () => {
    if (!topic.trim()) { setError('Enter a topic'); return; }
    setGenerating(true); setError(''); setScript(''); setAnalysis(null);
    setMobileView('output');
    try {
      const res = await fetch('/api/scripts/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          params: { topic, contentType: ctype, style, targetAudience: audience, videoLength: length,
            tone, retentionIntensity: intensity, keyPoints: keyPts ? keyPts.split('\n').filter(Boolean) : undefined,
            researchMaterial: research || undefined, platform } as ScriptGenerationParams,
          analyzeAndRewrite: analyze,
        }),
      });
      const d = await res.json();
      if (!d.success) { setError(d.error); return; }
      setScript(d.data.script);
      setAnalysis(d.data.analysis || null);
      setTab('script');
      fetch('/api/history/scripts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', params: { topic, contentType: ctype, style, targetAudience: audience, videoLength: length, tone, retentionIntensity: intensity, platform }, script: d.data.script, analysis: d.data.analysis || null }),
      }).catch(() => {});
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setGenerating(false); }
  }, [topic, ctype, style, audience, length, tone, intensity, keyPts, research, platform, analyze]);

  const copy = () => { navigator.clipboard.writeText(script); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const saveManually = async () => {
    if (!script) return;
    const r = await fetch('/api/history/scripts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', params: { topic, contentType: ctype, style, targetAudience: audience, videoLength: length, tone, retentionIntensity: intensity, platform }, script, analysis }) });
    if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
  };

  const saveScriptToProject = async () => {
    if (!script || !projectId) return;
    const r = await fetch('/api/projects', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', projectId, updates: { script, scriptAnalysis: analysis, status: 'scripting' } }),
    });
    if (r.ok) { setSavedToProject(true); setTimeout(() => setSavedToProject(false), 2500); }
  };
  if (!hydrated) return null;

  const formPanel = (
    <div className="flex flex-col h-full">
      {/* Form header */}
      <div className="flex items-center gap-2 mb-4 px-1">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-[hsl(var(--foreground))]">Script Settings</h2>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Configure your AI script</p>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto pr-1 pb-2">
        {/* Topic */}
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3">
          <Field label="Topic *">
            <Input value={topic} onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Why IKEA makes you walk in circles"
              className="mt-1" />
          </Field>
        </div>

        {/* Core settings */}
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Content Type">
              <Select value={ctype} onChange={e => setCtype(e.target.value)} className="mt-1">
                {CONTENT_TYPES.map(v => <option key={v}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Style">
              <Select value={style} onChange={e => setStyle(e.target.value)} className="mt-1">
                {STYLES.map(v => <option key={v}>{v}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Tone">
              <Select value={tone} onChange={e => setTone(e.target.value)} className="mt-1">
                {TONES.map(v => <option key={v}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Platform">
              <Select value={platform} onChange={e => setPlatform(e.target.value)} className="mt-1">
                {['youtube','tiktok','instagram','podcast'].map(v => <option key={v}>{v}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Target Audience">
            <Input value={audience} onChange={e => setAudience(e.target.value)}
              placeholder="e.g. Business professionals" className="mt-1" />
          </Field>
        </div>

        {/* Sliders */}
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 space-y-3">
          <Field label={`Length: ${length}m (~${length * 140} words)`}>
            <input type="range" min={1} max={30} value={length}
              onChange={e => setLength(parseInt(e.target.value))}
              className="w-full mt-2 accent-[hsl(var(--primary))]" />
            <div className="flex justify-between text-[10px] text-[hsl(var(--muted-foreground))] mt-1">
              <span>1m</span><span>30m</span>
            </div>
          </Field>
          <Field label={`Retention Intensity: ${intensity}/10`}>
            <input type="range" min={1} max={10} value={intensity}
              onChange={e => setIntensity(parseInt(e.target.value))}
              className="w-full mt-2 accent-[hsl(var(--primary))]" />
            <div className="flex justify-between text-[10px] text-[hsl(var(--muted-foreground))] mt-1">
              <span>Calm</span><span>Intense</span>
            </div>
          </Field>
        </div>

        {/* Advanced toggle */}
        <button onClick={() => setAdvOpen(o => !o)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
          <span className="flex items-center gap-1.5"><Settings2 className="w-3.5 h-3.5" /> Advanced Options</span>
          {advOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        <AnimatePresence>
          {advOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
              className="overflow-hidden">
              <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 space-y-3">
                <Field label="Key Points (one per line)">
                  <Textarea value={keyPts} onChange={e => setKeyPts(e.target.value)} rows={3}
                    placeholder="Facts or points to include…" className="mt-1 text-xs" />
                </Field>
                <Field label="Research Notes">
                  <Textarea value={research} onChange={e => setResearch(e.target.value)} rows={3}
                    placeholder="Paste research context…" className="mt-1 text-xs" />
                </Field>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Analyse checkbox */}
        <label className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] cursor-pointer hover:bg-[hsl(var(--surface-elevated))] transition-colors">
          <input type="checkbox" checked={analyze} onChange={e => setAnalyze(e.target.checked)}
            className="w-4 h-4 rounded accent-[hsl(var(--primary))]" />
          <div>
            <p className="text-xs font-medium text-[hsl(var(--foreground))]">Analyse & auto-rewrite</p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Scores script and improves retention (+60s)</p>
          </div>
        </label>
      </div>

      {/* Generate CTA */}
      <div className="pt-3 mt-2 border-t border-[hsl(var(--border))]">
        <Button onClick={generate} disabled={generating || !topic.trim()} className="w-full gap-2 h-11 text-sm font-semibold">
          {generating
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
            : <><Zap className="w-4 h-4" /> Generate Script</>}
        </Button>
      </div>
    </div>
  );

  const outputPanel = (
    <div className="space-y-4">
      {projectId && (
        <div className="rounded-xl bg-purple-500/8 border border-purple-500/25 px-4 py-3 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <Info className="w-4 h-4 text-purple-400 shrink-0" />
            <p className="text-sm font-medium text-purple-300">Linked to a project</p>
          </div>
          <Link href={`/projects/${projectId}`}>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7">
              <ArrowRight className="w-3 h-3" /> View Project
            </Button>
          </Link>
        </div>
      )}
      {fromResearch && (
        <div className="rounded-xl bg-[hsl(var(--primary))/8] border border-[hsl(var(--primary))/25] px-4 py-3 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-[hsl(var(--primary))] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-[hsl(var(--primary))] mb-0.5">
              {rc ? 'Loaded from YouTube Research' : 'Loaded from Research'}
            </p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {rc ? `"${rc.title}" · ${rc.difficulty} competition · ${rc.opportunityScore}/100 score` : 'Topic and research context pre-filled.'}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl bg-red-500/8 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{error}
        </div>
      )}

      {generating && (
        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-20 flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))/20] to-purple-500/10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--primary))]" />
            </div>
            <div className="absolute inset-0 rounded-2xl bg-[hsl(var(--primary))/10] animate-ping" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Writing your script…</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
              {analyze ? 'Generate → Analyse → Rewrite (60–120s)' : 'May take 30–60s'}
            </p>
          </div>
        </div>
      )}

      {script && !generating && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <Tabs value={tab} onValueChange={setTab}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
              <TabsList>
                <TabsTrigger value="script"><FileText className="w-3.5 h-3.5 mr-1" /> Script</TabsTrigger>
                {analysis && (
                  <TabsTrigger value="analysis">
                    <BarChart2 className="w-3.5 h-3.5 mr-1" /> Analysis
                    <Badge className="ml-1.5 text-[10px]">{analysis.overallScore}</Badge>
                  </TabsTrigger>
                )}
              </TabsList>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-[10px]">{script.split(/\s+/).length.toLocaleString()} words</Badge>
                <Badge variant="outline" className="text-[10px]">~{Math.round(script.split(/\s+/).length / 140)}m</Badge>
                <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={copy}>
                  {copied ? <><Check className="w-3 h-3 text-emerald-400" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                </Button>
              </div>
            </div>

            <TabsContent value="script" className="mt-3">
              <Card>
                <CardContent className="p-0">
                  <div className="rounded-xl bg-[hsl(var(--background))] border border-[hsl(var(--border))] m-1 p-4 sm:p-5 max-h-[60vh] overflow-y-auto">
                    <p className="text-sm leading-8 text-[hsl(var(--foreground))] whitespace-pre-wrap font-mono">{script}</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {analysis && (
              <TabsContent value="analysis" className="mt-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Score Breakdown</CardTitle></CardHeader>
                    <CardContent className="pt-0">
                      <ScoreBar label="Hook Strength"         value={analysis.hookStrength} />
                      <ScoreBar label="Curiosity"             value={analysis.curiosity} />
                      <ScoreBar label="Pacing"                value={analysis.pacing} />
                      <ScoreBar label="Narrative Progression" value={analysis.narrativeProgression} />
                      <ScoreBar label="Information Density"   value={analysis.informationDensity} />
                      <ScoreBar label="Ending Strength"       value={analysis.endingStrength} />
                      <ScoreBar label="TTS Readability"       value={analysis.ttsReadability} />
                      <div className="mt-4 rounded-xl bg-[hsl(var(--surface-elevated))] p-4 flex items-center justify-between">
                        <span className="font-bold text-sm">Overall</span>
                        <span className={`text-3xl font-extrabold ${analysis.overallScore >= 70 ? 'text-emerald-400' : analysis.overallScore >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                          {analysis.overallScore}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Suggestions</CardTitle></CardHeader>
                    <CardContent className="pt-0 space-y-2">
                      {(analysis.suggestions || []).map((s, i) => (
                        <div key={i} className="rounded-lg bg-[hsl(var(--background))] border border-[hsl(var(--border))] px-3 py-2.5 text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
                          <span className="text-[hsl(var(--primary))] mr-1.5">→</span>{s}
                        </div>
                      ))}
                      {(!analysis.suggestions || analysis.suggestions.length === 0) && (
                        <p className="text-sm text-emerald-400">✓ Script looks great!</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </motion.div>
      )}

      {!script && !generating && !error && (
        <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] py-20 flex flex-col items-center gap-3 text-center px-4">
          <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border))] flex items-center justify-center">
            <FileText className="w-7 h-7 text-[hsl(var(--muted-foreground))]" />
          </div>
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">Your script will appear here</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] max-w-xs">
            Fill in the settings and click <strong>Generate Script</strong>.
            Requires OpenRouter API key · <Link href="/settings" className="text-[hsl(var(--primary))] hover:underline">Check Settings</Link>
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <PageHeader title="Script Generator" description="Retention-first AI scripts — plain TTS-ready narration">
        <div className="flex flex-wrap gap-2">
          <Link href="/scripts/history">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <History className="w-3.5 h-3.5" /> History
            </Button>
          </Link>
          {projectId && (
            <Link href={`/projects/${projectId}`}>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <ArrowRight className="w-3.5 h-3.5" /> Back to Project
              </Button>
            </Link>
          )}
          {script && (
            <>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={saveManually}>
                {saved ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Saved</> : <><Save className="w-3.5 h-3.5" /> Save</>}
              </Button>
              {projectId && (
                <Button variant="outline" size="sm" className="gap-1.5 text-xs border-[hsl(var(--primary))/40] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))/10]" onClick={saveScriptToProject}>
                  {savedToProject ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Saved to Project</> : <><Save className="w-3.5 h-3.5" /> Save to Project</>}
                </Button>
              )}
              <Button variant="outline" size="sm" className="gap-1.5 text-xs"
                onClick={() => {
                  sessionStorage.setItem('voiceScript', script);
                  if (projectId) sessionStorage.setItem('currentProjectId', projectId);
                  window.open('/voice', '_blank');
                }}>
                <ArrowRight className="w-3.5 h-3.5" /> Voice
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs"
                onClick={() => {
                  sessionStorage.setItem('pendingScript', script);
                  if (projectId) sessionStorage.setItem('currentProjectId', projectId);
                  window.open('/visuals/prompts', '_blank');
                }}>
                <ArrowRight className="w-3.5 h-3.5" /> Visuals
              </Button>
            </>
          )}
        </div>
      </PageHeader>

      {/* ── Mobile tab switcher ── */}
      <div className="flex md:hidden border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] sticky top-0 z-10">
        <button onClick={() => setMobileView('form')}
          className={`flex-1 py-3 text-xs font-semibold transition-colors border-b-2 ${mobileView === 'form' ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]' : 'border-transparent text-[hsl(var(--muted-foreground))]'}`}>
          <Settings2 className="w-3.5 h-3.5 inline mr-1" /> Settings
        </button>
        <button onClick={() => setMobileView('output')}
          className={`flex-1 py-3 text-xs font-semibold transition-colors border-b-2 ${mobileView === 'output' ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]' : 'border-transparent text-[hsl(var(--muted-foreground))]'}`}>
          <FileText className="w-3.5 h-3.5 inline mr-1" /> Output {script && <span className="ml-1 w-2 h-2 rounded-full bg-emerald-500 inline-block" />}
        </button>
      </div>

      <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
        {/* Desktop: side-by-side */}
        <div className="hidden md:grid md:grid-cols-[320px_1fr] gap-6 items-start">
          <div className="sticky top-4 h-[calc(100vh-140px)] overflow-y-auto rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            {formPanel}
          </div>
          <div>{outputPanel}</div>
        </div>

        {/* Mobile: single pane */}
        <div className="md:hidden">
          <AnimatePresence mode="wait">
            {mobileView === 'form' ? (
              <motion.div key="form" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4" style={{ minHeight: '70vh' }}>
                {formPanel}
              </motion.div>
            ) : (
              <motion.div key="output" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                {outputPanel}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default function ScriptGeneratorPage() {
  return (
    <AppLayout>
      <Suspense>
        <GeneratorInner />
      </Suspense>
    </AppLayout>
  );
}
