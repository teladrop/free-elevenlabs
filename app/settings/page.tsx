'use client';

import { AppLayout }                    from '@/components/layout/app-layout';
import { PageHeader }                   from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button }                       from '@/components/ui/button';
import { Input }                        from '@/components/ui/input';
import { Select }                       from '@/components/ui/select';
import { Label }                        from '@/components/ui/label';
import { Badge }                        from '@/components/ui/badge';
import { motion }                       from 'framer-motion';
import { useEffect, useState }          from 'react';
import {
  Check, Loader2, CheckCircle2, WifiOff, ExternalLink, RefreshCw, Info, Zap, AlertTriangle,
} from 'lucide-react';

/* ─── Types ───────────────────────────────────────────────────────────────── */
interface StoredSettings {
  defaultScriptStyle: string;
  defaultVisualStyle: string;
  defaultVideoLength: number;
  defaultPlatform:    string;
}
const DEFAULTS: StoredSettings = {
  defaultScriptStyle: 'Documentary',
  defaultVisualStyle: '3d-stylized',
  defaultVideoLength: 10,
  defaultPlatform:    'youtube',
};

interface ProviderStatus {
  configured: boolean;
  connected:  boolean;
  label:      string;
  limits?:    string;
  error?:     string;
}
interface AIStatus {
  connected:  boolean;
  active:     string;
  forced:     string | null;
  providers:  { groq: ProviderStatus; gemini: ProviderStatus; openrouter: ProviderStatus };
  models:     Record<string, string>;
}

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item    = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } };

/* ─── Provider card ───────────────────────────────────────────────────────── */
function ProviderCard({
  name, icon, status, priority, signupUrl, envVar, description, models,
}: {
  name:        string;
  icon:        React.ReactNode;
  status:      ProviderStatus | undefined;
  priority:    number;
  signupUrl:   string;
  envVar:      string;
  description: string;
  models:      Record<string, string>;
}) {
  const configured = status?.configured ?? false;
  const connected  = status?.connected  ?? false;

  return (
    <div className={`rounded-xl border p-4 space-y-3 transition-colors ${
      connected
        ? 'border-emerald-500/30 bg-emerald-500/5'
        : configured
        ? 'border-red-500/20 bg-red-500/5'
        : 'border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))]'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 flex items-center justify-center">{icon}</div>
          <div>
            <p className="text-sm font-semibold flex items-center gap-2">
              {name}
              <Badge variant={priority === 1 ? 'default' : priority === 2 ? 'secondary' : 'outline'}
                className="text-[10px] px-1.5 py-0">
                Priority {priority}
              </Badge>
            </p>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {connected
            ? <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" /> Connected</span>
            : configured
            ? <span className="flex items-center gap-1 text-[11px] font-semibold text-red-400"><WifiOff className="w-3.5 h-3.5" /> Error</span>
            : <span className="text-[11px] text-[hsl(var(--muted-foreground))]">Not configured</span>
          }
        </div>
      </div>

      {/* Status detail */}
      {connected && status?.limits && (
        <p className="text-[11px] text-emerald-400/80">{status.limits}</p>
      )}
      {configured && !connected && status?.error && (
        <p className="text-[11px] text-red-400">{status.error}</p>
      )}

      {/* Models */}
      {connected && (
        <div className="grid grid-cols-3 gap-1.5">
          {Object.entries(models).map(([task, model]) => (
            <div key={task} className="rounded-lg bg-[hsl(var(--background))] border border-[hsl(var(--border))] px-2 py-1.5">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-0.5">{task}</p>
              <p className="text-[10px] text-[hsl(var(--foreground))] truncate">{model}</p>
            </div>
          ))}
        </div>
      )}

      {/* Setup instructions */}
      {!configured && (
        <div className="text-xs text-[hsl(var(--muted-foreground))] space-y-1">
          <p>Add to <code className="bg-white/5 px-1 rounded">.env.local</code>:</p>
          <code className="block bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded px-2 py-1.5 text-[11px] text-[hsl(var(--foreground))]">
            {envVar}=your_key_here
          </code>
          <a href={signupUrl} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 text-[hsl(var(--primary))] hover:underline">
            Get free API key <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────────── */
export default function SettingsPage() {
  const [settings,      setSettings]      = useState<StoredSettings>(DEFAULTS);
  const [saved,         setSaved]         = useState(false);
  const [aiStatus,      setAiStatus]      = useState<AIStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

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
      const d = await r.json() as AIStatus;
      setAiStatus(d);
    } catch {
      setAiStatus(null);
    } finally {
      setLoadingStatus(false);
    }
  };

  const groqModels   = { script: 'llama-3.3-70b-versatile', analysis: 'llama-3.3-70b-versatile', titles: 'llama3-70b-8192', visual: 'llama-3.3-70b-versatile', ideas: 'llama3-70b-8192' };
  const geminiModels = { script: 'gemini-2.0-flash', analysis: 'gemini-2.0-flash', titles: 'gemini-1.5-flash', visual: 'gemini-2.0-flash', ideas: 'gemini-1.5-flash' };
  const orModels     = { script: 'nemotron-120b:free', analysis: 'nemotron-120b:free', titles: 'nemotron-120b:free', visual: 'nemotron-120b:free', ideas: 'nemotron-120b:free' };

  return (
    <AppLayout>
      <div className="min-h-screen bg-[hsl(var(--background))]">
        <PageHeader title="Settings" description="Configure AI providers, API keys and content defaults">
          <Button onClick={save} className="gap-2">
            {saved ? <><Check className="w-4 h-4" /> Saved!</> : 'Save Settings'}
          </Button>
        </PageHeader>

        <div className="px-8 py-8 max-w-[860px] mx-auto">
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">

            {/* ── AI Providers ── */}
            <motion.div variants={item}>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-[hsl(var(--primary))]" />
                        AI Providers
                      </CardTitle>
                      <CardDescription className="mt-1">
                        All providers below are <strong>100% free</strong>. The system auto-falls back from Groq → Gemini → OpenRouter.
                        Configure at least one — Groq is recommended.
                      </CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" className="gap-2 shrink-0" onClick={fetchStatus} disabled={loadingStatus}>
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? 'animate-spin' : ''}`} />
                      {loadingStatus ? 'Checking…' : 'Refresh'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">

                  {/* Active provider banner */}
                  {aiStatus && (
                    <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 text-sm ${
                      aiStatus.connected
                        ? 'bg-emerald-500/8 border-emerald-500/20 text-emerald-400'
                        : 'bg-amber-500/8 border-amber-500/20 text-amber-400'
                    }`}>
                      {aiStatus.connected
                        ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                        : <AlertTriangle className="w-4 h-4 shrink-0" />
                      }
                      {aiStatus.connected
                        ? <>Active provider: <strong className="ml-1 capitalize">{aiStatus.active}</strong>
                            {aiStatus.forced && <span className="ml-2 text-xs opacity-70">(forced via AI_PROVIDER)</span>}
                          </>
                        : 'No AI provider connected — add at least one key below and restart the dev server'
                      }
                    </div>
                  )}

                  {loadingStatus && !aiStatus && (
                    <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                      <Loader2 className="w-4 h-4 animate-spin" /> Checking providers…
                    </div>
                  )}

                  {/* Provider cards */}
                  <ProviderCard
                    name="Groq"
                    icon={<span className="text-lg">⚡</span>}
                    status={aiStatus?.providers.groq}
                    priority={1}
                    signupUrl="https://console.groq.com/keys"
                    envVar="GROQ_API_KEY"
                    description="Ultra-fast inference · 30 req/min · 14,400 req/day"
                    models={groqModels}
                  />
                  <ProviderCard
                    name="Google Gemini"
                    icon={<span className="text-lg">✨</span>}
                    status={aiStatus?.providers.gemini}
                    priority={2}
                    signupUrl="https://aistudio.google.com/apikey"
                    envVar="GEMINI_API_KEY"
                    description="Google's own models · 15 req/min · 1,500 req/day"
                    models={geminiModels}
                  />
                  <ProviderCard
                    name="OpenRouter"
                    icon={<span className="text-lg">🔀</span>}
                    status={aiStatus?.providers.openrouter}
                    priority={3}
                    signupUrl="https://openrouter.ai/keys"
                    envVar="OPENROUTER_API_KEY"
                    description="Last-resort fallback · rate-limited free models"
                    models={orModels}
                  />

                  {/* Restart reminder */}
                  <div className="rounded-xl bg-amber-500/8 border border-amber-500/20 p-3 flex gap-2.5 text-xs text-amber-400">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    After adding keys to <code className="bg-white/5 px-1 rounded">.env.local</code>, restart the dev server
                    (<code className="bg-white/5 px-1 rounded">npm run dev</code>) then click Refresh above.
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
                <CardContent>
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

            {/* ── Edge TTS ── */}
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
