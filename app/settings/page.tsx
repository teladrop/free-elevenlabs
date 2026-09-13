'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import {
  Check, Loader2, CheckCircle2, WifiOff, AlertTriangle,
  ExternalLink, RefreshCw, Info,
} from 'lucide-react';

/* ─── Types ───────────────────────────────────────────────────────────────── */
interface StoredSettings {
  defaultScriptStyle: string;
  defaultVisualStyle: string;
  defaultVideoLength: number;
  defaultPlatform: string;
}

const DEFAULTS: StoredSettings = {
  defaultScriptStyle: 'Documentary',
  defaultVisualStyle: '3d-stylized',
  defaultVideoLength: 10,
  defaultPlatform: 'youtube',
};

interface AIStatus {
  connected: boolean;
  configured: Record<string, string>;
  models: { id: string; name: string; contextLength: number }[];
  error?: string;
}

/* ─── Free model defaults ─────────────────────────────────────────────────── */
const FREE_DEFAULTS = {
  script:   'qwen/qwen3-235b-a22b:free',
  analysis: 'deepseek/deepseek-r1-0528-qwen3-8b:free',
  titles:   'qwen/qwen3-30b-a3b:free',
  visual:   'qwen/qwen3-235b-a22b:free',
  ideas:    'qwen/qwen3-30b-a3b:free',
  fallback: 'qwen/qwen3-30b-a3b:free',
};

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item    = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } };

export default function SettingsPage() {
  const [settings,     setSettings]     = useState<StoredSettings>(DEFAULTS);
  const [saved,        setSaved]        = useState(false);
  const [aiStatus,     setAiStatus]     = useState<AIStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  /* Load stored UI settings */
  useEffect(() => {
    const raw = localStorage.getItem('cs_settings');
    if (raw) { try { setSettings({ ...DEFAULTS, ...JSON.parse(raw) }); } catch {} }
    fetchStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = <K extends keyof StoredSettings>(k: K, v: StoredSettings[K]) =>
    setSettings(s => ({ ...s, [k]: v }));

  const save = () => {
    localStorage.setItem('cs_settings', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const fetchStatus = async () => {
    setLoadingStatus(true);
    try {
      const r = await fetch('/api/ai/status');
      const d = await r.json();
      setAiStatus(d);
    } catch {
      setAiStatus({ connected: false, configured: FREE_DEFAULTS, models: [], error: 'Request failed' });
    } finally {
      setLoadingStatus(false);
    }
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-[hsl(var(--background))]">
        <PageHeader title="Settings" description="Configure AI providers, API keys and content defaults">
          <Button onClick={save} className="gap-2">
            {saved ? <><Check className="w-4 h-4" /> Saved!</> : 'Save Settings'}
          </Button>
        </PageHeader>

        <div className="px-8 py-8 max-w-[820px] mx-auto">
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">

            {/* ── OpenRouter AI ── */}
            <motion.div variants={item}>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>OpenRouter — Free AI Models</CardTitle>
                      <CardDescription className="mt-1">
                        All models below are on the <Badge variant="success" className="mx-1">:free</Badge> tier — no charges.
                      </CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" className="gap-2" onClick={fetchStatus} disabled={loadingStatus}>
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Status banner */}
                  {aiStatus && (
                    <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 text-sm ${
                      aiStatus.connected
                        ? 'bg-emerald-500/8 border-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/8 border-red-500/20 text-red-400'
                    }`}>
                      {aiStatus.connected
                        ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                        : <WifiOff className="w-4 h-4 mt-0.5 shrink-0" />
                      }
                      <div>
                        {aiStatus.connected
                          ? <span>Connected to OpenRouter · {aiStatus.models.length} free models available</span>
                          : <span>{aiStatus.error || 'Not connected'}</span>
                        }
                      </div>
                    </div>
                  )}

                  {/* API key instructions */}
                  <div className="rounded-xl bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border))] p-4 space-y-2 text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
                    <p className="font-semibold text-[hsl(var(--foreground))] text-sm">Setup (one-time)</p>
                    <ol className="space-y-1.5 list-decimal list-inside">
                      <li>Go to <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-[hsl(var(--primary))] hover:underline inline-flex items-center gap-1">openrouter.ai/keys <ExternalLink className="w-3 h-3" /></a> and create a free account</li>
                      <li>Create an API key — <strong className="text-[hsl(var(--foreground))]">no credit card required</strong> for <code className="bg-white/5 px-1 rounded">:free</code> models</li>
                      <li>Open <strong className="text-[hsl(var(--foreground))]">.env.local</strong> in the project root and paste your key next to <code className="bg-white/5 px-1 rounded">OPENROUTER_API_KEY=</code></li>
                      <li>Restart the dev server (<code className="bg-white/5 px-1 rounded">npm run dev</code>), then click Refresh above</li>
                    </ol>
                  </div>

                  <Separator />

                  {/* Configured models */}
                  <div>
                    <p className="text-sm font-semibold mb-3">Model Assignment</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mb-4">
                      These are set in <strong>.env.local</strong> and read at runtime. Change the value there and restart.
                    </p>
                    <div className="space-y-3">
                      {aiStatus && Object.entries(aiStatus.configured).map(([task, modelId]) => (
                        <div key={task} className="flex items-center justify-between gap-4 py-2 border-b border-[hsl(var(--border))] last:border-0">
                          <div className="flex items-center gap-3">
                            <div className="w-24 text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] capitalize">{task}</div>
                            <code className="text-xs bg-[hsl(var(--surface-elevated))] px-2 py-1 rounded border border-[hsl(var(--border))]">{modelId}</code>
                          </div>
                          <Badge
                            variant={modelId.endsWith(':free') ? 'success' : 'warning'}
                          >
                            {modelId.endsWith(':free') ? 'Free' : 'Paid'}
                          </Badge>
                        </div>
                      ))}
                      {!aiStatus && (
                        <div className="space-y-2">
                          {Object.entries(FREE_DEFAULTS).map(([task, modelId]) => (
                            <div key={task} className="flex items-center justify-between gap-4 py-2 border-b border-[hsl(var(--border))] last:border-0">
                              <div className="flex items-center gap-3">
                                <div className="w-24 text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] capitalize">{task}</div>
                                <code className="text-xs bg-[hsl(var(--surface-elevated))] px-2 py-1 rounded border border-[hsl(var(--border))]">{modelId}</code>
                              </div>
                              <Badge variant="success">Free</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* .env.local snippet */}
                    <div className="mt-4 rounded-xl bg-[hsl(var(--background))] border border-[hsl(var(--border))] p-4">
                      <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-2">To change models, edit .env.local:</p>
                      <pre className="text-[11px] text-[hsl(var(--foreground))] leading-6 overflow-x-auto">{
`SCRIPT_MODEL=qwen/qwen3-235b-a22b:free
ANALYSIS_MODEL=deepseek/deepseek-r1-0528-qwen3-8b:free
TITLES_MODEL=qwen/qwen3-30b-a3b:free
VISUAL_MODEL=qwen/qwen3-235b-a22b:free
FALLBACK_MODEL=qwen/qwen3-30b-a3b:free`
                      }</pre>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* ── YouTube API ── */}
            <motion.div variants={item}>
              <Card>
                <CardHeader>
                  <CardTitle>YouTube Data API</CardTitle>
                  <CardDescription>Required for Topic Research. Free — 10,000 units/day on Google Cloud.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border))] p-4 text-xs text-[hsl(var(--muted-foreground))] space-y-1.5 leading-relaxed">
                    <ol className="space-y-1.5 list-decimal list-inside">
                      <li>Go to <a href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noreferrer" className="text-[hsl(var(--primary))] hover:underline inline-flex items-center gap-1">Google Cloud Console <ExternalLink className="w-3 h-3" /></a></li>
                      <li>Enable <strong className="text-[hsl(var(--foreground))]">YouTube Data API v3</strong> and create an API key</li>
                      <li>Add <code className="bg-white/5 px-1.5 rounded">YOUTUBE_API_KEY=yourkey</code> to <strong className="text-[hsl(var(--foreground))]">.env.local</strong> and restart</li>
                    </ol>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* ── Content Defaults ── */}
            <motion.div variants={item}>
              <Card>
                <CardHeader>
                  <CardTitle>Content Defaults</CardTitle>
                  <CardDescription>Pre-fill Script Generator and other tools with these values.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <Row label="Default Script Style">
                      <Select value={settings.defaultScriptStyle} onChange={e => set('defaultScriptStyle', e.target.value)}>
                        {['Documentary','Business Documentary','Explainer','Educational','Science','Storytelling','Investigative'].map(v => <option key={v}>{v}</option>)}
                      </Select>
                    </Row>
                    <Row label="Default Platform">
                      <Select value={settings.defaultPlatform} onChange={e => set('defaultPlatform', e.target.value)}>
                        {['youtube','tiktok','instagram','podcast'].map(v => <option key={v}>{v}</option>)}
                      </Select>
                    </Row>
                    <Row label="Default Video Length (min)">
                      <Input type="number" min={1} max={60} value={settings.defaultVideoLength}
                        onChange={e => set('defaultVideoLength', parseInt(e.target.value))} />
                    </Row>
                    <Row label="Default Visual Style">
                      <Select value={settings.defaultVisualStyle} onChange={e => set('defaultVisualStyle', e.target.value)}>
                        {['3d-stylized','cinematic','2d-minimal','infographic','hand-drawn','photorealistic'].map(v => <option key={v}>{v}</option>)}
                      </Select>
                    </Row>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* ── Edge TTS (voice — read-only info) ── */}
            <motion.div variants={item}>
              <Card>
                <CardHeader>
                  <CardTitle>Voice Studio</CardTitle>
                  <CardDescription>Powered by Microsoft Edge TTS — always free, no API key required.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 py-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Edge TTS · 23 neural voices · online</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">No configuration needed — always ready</p>
                    </div>
                    <Badge variant="success" className="ml-auto">Active</Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* ── Warning ── */}
            <motion.div variants={item}>
              <div className="rounded-xl bg-amber-500/8 border border-amber-500/20 p-4 flex gap-3 text-xs text-amber-400">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  UI preferences are saved to <strong className="text-amber-300">localStorage</strong>.
                  AI model configuration and API keys live in <strong className="text-amber-300">.env.local</strong> and require a dev-server restart to take effect.
                </p>
              </div>
            </motion.div>

          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
    </div>
  );
}
