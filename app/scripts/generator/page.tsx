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
import { motion } from 'framer-motion';
import { Suspense, useCallback, useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2, Copy, Check, Zap, AlertTriangle, ArrowRight,
  BarChart2, FileText, Info, History, Save,
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

function GeneratorInner() {
  const sp = useSearchParams();

  const parseResearchContext = () => {
    try {
      const r = sp.get('research');
      if (r) return JSON.parse(decodeURIComponent(r));
    } catch {}
    return null;
  };
  const rc = parseResearchContext();
  const fromResearch = sp.get('research') !== null;

  // ── Restore from localStorage on mount ──────────────────────────────────
  const [hydrated, setHydrated] = useState(false);
  const [topic,     setTopic]     = useState(rc?.title || sp.get('topic') || '');
  const [ctype,     setCtype]     = useState('Educational');
  const [style,     setStyle]     = useState(sp.get('style') || 'Documentary');
  const [audience,  setAudience]  = useState('General audience');
  const [length,    setLength]    = useState(parseInt(sp.get('videoLength') || '10'));
  const [tone,      setTone]      = useState(sp.get('tone') || 'Conversational');
  const [intensity, setIntensity] = useState(7);
  const [keyPts,    setKeyPts]    = useState('');
  const [research,  setResearch]  = useState(() => {
    if (rc) return `YouTube Research Context:\nTopic: ${rc.topic}\nAngle: ${rc.angle}\nKeywords: ${rc.keywords?.join(', ')}\nDifficulty: ${rc.difficulty} competition\nOpportunity Score: ${rc.opportunityScore}/100`;
    return sp.get('research') || '';
  });
  const [platform,  setPlatform]  = useState('youtube');
  const [analyze,   setAnalyze]   = useState(true);
  const [script,    setScript]    = useState('');
  const [analysis,  setAnalysis]  = useState<ScriptAnalysis | null>(null);

  useEffect(() => {
    // Only restore from localStorage if NOT arriving from research (to respect URL params)
    if (!fromResearch && !sp.get('topic')) {
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) {
          const s: SavedState = JSON.parse(raw);
          setTopic(s.topic || '');
          setCtype(s.ctype || 'Educational');
          setStyle(s.style || 'Documentary');
          setAudience(s.audience || 'General audience');
          setLength(s.length || 10);
          setTone(s.tone || 'Conversational');
          setIntensity(s.intensity ?? 7);
          setKeyPts(s.keyPts || '');
          setResearch(s.research || '');
          setPlatform(s.platform || 'youtube');
          setAnalyze(s.analyze ?? true);
          setScript(s.script || '');
          setAnalysis(s.analysis || null);
        }
      } catch {}
    }
    setHydrated(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist state to localStorage whenever key fields change
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      const state: SavedState = { topic, ctype, style, audience, length, tone, intensity, keyPts, research, platform, analyze, script, analysis };
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    }, 600);
  }, [topic, ctype, style, audience, length, tone, intensity, keyPts, research, platform, analyze, script, analysis, hydrated]);

  const [generating, setGenerating] = useState(false);
  const [error,      setError]      = useState('');
  const [copied,     setCopied]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [tab,        setTab]        = useState('script');

  const generate = useCallback(async () => {
    if (!topic.trim()) { setError('Enter a topic'); return; }
    setGenerating(true); setError(''); setScript(''); setAnalysis(null);
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

      // Auto-save to history
      fetch('/api/history/scripts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          params: { topic, contentType: ctype, style, targetAudience: audience, videoLength: length,
            tone, retentionIntensity: intensity, platform },
          script: d.data.script,
          analysis: d.data.analysis || null,
        }),
      }).catch(() => {}); // non-blocking, silent fail if Supabase not configured

    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setGenerating(false); }
  }, [topic, ctype, style, audience, length, tone, intensity, keyPts, research, platform, analyze]);

  const copy = () => { navigator.clipboard.writeText(script); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const saveManually = async () => {
    if (!script) return;
    const r = await fetch('/api/history/scripts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save',
        params: { topic, contentType: ctype, style, targetAudience: audience, videoLength: length, tone, retentionIntensity: intensity, platform },
        script, analysis,
      }),
    });
    if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
  };

  if (!hydrated) return null; // avoid hydration mismatch

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <PageHeader title="Script Generator" description="Retention-first AI scripts — plain TTS-ready narration output">
        <div className="flex gap-2">
          <Link href="/scripts/history">
            <Button variant="outline" size="sm" className="gap-1.5">
              <History className="w-3.5 h-3.5" /> History
            </Button>
          </Link>
          {script && (
            <>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={saveManually}>
                {saved ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Saved</> : <><Save className="w-3.5 h-3.5" /> Save</>}
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { sessionStorage.setItem('voiceScript', script); window.open('/voice','_blank'); }}>
                <ArrowRight className="w-3.5 h-3.5" /> Voice Over
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { sessionStorage.setItem('pendingScript', script); window.open('/visuals/prompts','_blank'); }}>
                <ArrowRight className="w-3.5 h-3.5" /> Visuals
              </Button>
            </>
          )}
        </div>
      </PageHeader>

      <div className="px-8 py-6 max-w-[1280px] mx-auto grid grid-cols-[280px_1fr] gap-6">

        {/* Form */}
        <Card className="h-fit sticky top-4">
          <CardContent className="p-5 space-y-4">
            <Field label="Topic">
              <Input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Why IKEA makes you walk in circles" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Content Type">
                <Select value={ctype} onChange={e => setCtype(e.target.value)}>
                  {CONTENT_TYPES.map(v => <option key={v}>{v}</option>)}
                </Select>
              </Field>
              <Field label="Style">
                <Select value={style} onChange={e => setStyle(e.target.value)}>
                  {STYLES.map(v => <option key={v}>{v}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Tone">
              <Select value={tone} onChange={e => setTone(e.target.value)}>
                {TONES.map(v => <option key={v}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Target Audience">
              <Input value={audience} onChange={e => setAudience(e.target.value)} placeholder="e.g. Business professionals" />
            </Field>
            <Field label={`Length: ${length}m (~${length * 140} words)`}>
              <input type="range" min={1} max={30} value={length} onChange={e => setLength(parseInt(e.target.value))} className="w-full" />
            </Field>
            <Field label={`Retention Intensity: ${intensity}/10`}>
              <input type="range" min={1} max={10} value={intensity} onChange={e => setIntensity(parseInt(e.target.value))} className="w-full" />
            </Field>
            <Field label="Platform">
              <Select value={platform} onChange={e => setPlatform(e.target.value)}>
                {['youtube','tiktok','instagram','podcast'].map(v => <option key={v}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Key Points (one per line)">
              <Textarea value={keyPts} onChange={e => setKeyPts(e.target.value)} rows={3} placeholder="Facts to include…" />
            </Field>
            <Field label="Research Notes">
              <Textarea value={research} onChange={e => setResearch(e.target.value)} rows={3} placeholder="Paste research…" />
            </Field>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={analyze} onChange={e => setAnalyze(e.target.checked)} className="w-4 h-4 rounded accent-blue-500" />
              <span className="text-xs text-[hsl(var(--muted-foreground))]">Analyse &amp; auto-rewrite</span>
            </label>
            <Button onClick={generate} disabled={generating || !topic.trim()} className="w-full gap-2 mt-1">
              {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><Zap className="w-4 h-4" /> Generate Script</>}
            </Button>
          </CardContent>
        </Card>

        {/* Output */}
        <div className="space-y-4">
          {fromResearch && (
            <div className="rounded-xl bg-[hsl(var(--primary))/8] border border-[hsl(var(--primary))/25] px-4 py-3 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-[hsl(var(--primary))] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-[hsl(var(--primary))] mb-0.5">
                  {rc ? 'Loaded from YouTube Research' : 'Loaded from Research'}
                </p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {rc
                    ? `"${rc.title}" · ${rc.difficulty} competition · ${rc.opportunityScore}/100 score`
                    : 'Topic and research context pre-filled.'}
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
            <Card className="py-20 text-center">
              <Loader2 className="w-9 h-9 animate-spin mx-auto text-[hsl(var(--primary))] mb-4" />
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Writing retention-optimised script…</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]/60 mt-2">
                {analyze ? 'Generating → Analysing → Rewriting (60–120s)' : 'May take 30–60s'}
              </p>
            </Card>
          )}

          {script && !generating && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <Tabs value={tab} onValueChange={setTab}>
                <div className="flex items-center justify-between">
                  <TabsList>
                    <TabsTrigger value="script"><FileText className="w-3.5 h-3.5" /> Script</TabsTrigger>
                    {analysis && <TabsTrigger value="analysis"><BarChart2 className="w-3.5 h-3.5" /> Analysis <Badge className="ml-1">{analysis.overallScore}</Badge></TabsTrigger>}
                  </TabsList>
                  <div className="flex gap-2">
                    <Badge variant="outline">{script.split(/\s+/).length.toLocaleString()} words</Badge>
                    <Badge variant="outline">~{Math.round(script.split(/\s+/).length / 140)}m</Badge>
                    <Button variant="outline" size="sm" className="gap-1.5 h-7" onClick={copy}>
                      {copied ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                    </Button>
                  </div>
                </div>

                <TabsContent value="script">
                  <Card>
                    <CardContent className="p-5">
                      <div className="bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg p-5 max-h-[560px] overflow-y-auto">
                        <p className="text-sm leading-8 text-[hsl(var(--foreground))] whitespace-pre-wrap font-mono">{script}</p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {analysis && (
                  <TabsContent value="analysis">
                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardHeader><CardTitle>Score Breakdown</CardTitle></CardHeader>
                        <CardContent>
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
                        <CardHeader><CardTitle>Suggestions</CardTitle></CardHeader>
                        <CardContent className="space-y-2">
                          {(analysis.suggestions || []).map((s, i) => (
                            <div key={i} className="rounded-lg bg-[hsl(var(--background))] border border-[hsl(var(--border))] px-3 py-2.5 text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
                              <span className="text-[hsl(var(--primary))] mr-1.5">→</span>{s}
                            </div>
                          ))}
                          {(!analysis.suggestions || analysis.suggestions.length === 0) && (
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">Script looks great!</p>
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
            <Card className="py-20 text-center">
              <FileText className="w-10 h-10 mx-auto text-[hsl(var(--muted-foreground))] mb-4" />
              <p className="text-sm text-[hsl(var(--muted-foreground))] mb-2">Fill the form and click Generate Script</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]/60">
                Requires OpenRouter API key · <Link href="/settings" className="text-[hsl(var(--primary))] hover:underline">Check Settings</Link>
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
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
