'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Lightbulb, FileText, Layers, Mic2, FolderOpen,
  ArrowRight, Plus, CheckCircle2, AlertTriangle, WifiOff,
  TrendingUp, Zap, Clock, Search,
} from 'lucide-react';
import { Project } from '@/lib/types';

const ACTIONS = [
  { label: 'YouTube Research', desc: 'AI niche intelligence system', href: '/research',           icon: Search,    color: 'from-indigo-500 to-purple-500',  bg: 'bg-indigo-500/10'  },
  { label: 'My Channel',      desc: 'Connect & analyse your channel', href: '/my-channel',        icon: Lightbulb, color: 'from-amber-500 to-orange-500',  bg: 'bg-amber-500/10'  },
  { label: 'Write Script',    desc: 'Retention-first AI script',  href: '/scripts/generator', icon: FileText,  color: 'from-blue-500 to-indigo-500',    bg: 'bg-blue-500/10'   },
  { label: 'Visual Prompts',  desc: 'Line-by-line scene prompts', href: '/visuals/prompts',   icon: Layers,    color: 'from-purple-500 to-pink-500',    bg: 'bg-purple-500/10' },
  { label: 'Voice Over',      desc: 'Free premium neural TTS',    href: '/voice',             icon: Mic2,      color: 'from-teal-500 to-cyan-500',      bg: 'bg-teal-500/10'   },
];

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'outline' }> = {
  draft:     { label: 'Draft',     variant: 'outline' },
  research:  { label: 'Research',  variant: 'warning' },
  scripting: { label: 'Scripting', variant: 'default' },
  visual:    { label: 'Visuals',   variant: 'secondary' },
  voiceover: { label: 'Voice',     variant: 'success' },
  complete:  { label: 'Done',      variant: 'success' },
};

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } } };

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading]   = useState(true);
  const [ollamaOk, setOllamaOk] = useState<boolean | null>(null);
  const [ytKey, setYtKey]       = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/projects').then(r => r.json())
      .then(d => { if (d.success) setProjects(d.data.slice(0, 5)); })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Check OpenRouter instead of Ollama
    fetch('/api/ai/status')
      .then(r => r.json())
      .then(d => setOllamaOk(d.connected))
      .catch(() => setOllamaOk(false));

    fetch('/api/research/youtube?topic=test')
      .then(r => r.json())
      .then(d => setYtKey(!String(d.error ?? '').toLowerCase().includes('not configured')))
      .catch(() => setYtKey(false));
  }, []);

  return (
    <AppLayout>
      <div className="min-h-screen bg-[hsl(var(--background))]">
        <PageHeader title="Dashboard" description="Your AI content creation workspace" />

        <div className="px-8 py-8 max-w-[1280px] mx-auto space-y-10">

          {/* Quick actions */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-4">Quick Start</p>
            <motion.div variants={container} initial="hidden" animate="show"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {ACTIONS.map(a => (
                <motion.div key={a.label} variants={item}>
                  <Link href={a.href}>
                    <Card className="group cursor-pointer hover:border-[hsl(var(--primary))/50] transition-all duration-200 hover:shadow-lg hover:shadow-[hsl(var(--primary))/8]">
                      <CardContent className="p-5">
                        <div className={`w-10 h-10 rounded-xl ${a.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200`}>
                          <a.icon className={`w-5 h-5 bg-gradient-to-br ${a.color} bg-clip-text`} style={{ color: 'transparent', backgroundImage: `linear-gradient(to bottom right, var(--tw-gradient-stops))` }} />
                          <a.icon className="w-5 h-5 text-white absolute opacity-0" />
                        </div>
                        {/* simpler icon */}
                        <div className="mb-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center -mt-14 ${a.bg}`}>
                            <a.icon className="w-5 h-5" style={{ color: a.color.includes('amber') ? '#f59e0b' : a.color.includes('blue') ? '#3b82f6' : a.color.includes('purple') ? '#a855f7' : '#14b8a6' }} />
                          </div>
                        </div>
                        <p className="font-semibold text-sm text-[hsl(var(--foreground))] mb-1">{a.label}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">{a.desc}</p>
                        <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--primary))]">
                          Open <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent projects */}
            <section className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Recent Projects</p>
                <Link href="/projects">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">
                    View all <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>

              {loading ? (
                <div className="space-y-2">
                  {[1,2,3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
                </div>
              ) : projects.length === 0 ? (
                <Card className="py-14 text-center">
                  <FolderOpen className="w-10 h-10 mx-auto text-[hsl(var(--muted-foreground))] mb-3" />
                  <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">No projects yet</p>
                  <Link href="/projects"><Button size="sm" className="gap-1.5"><Plus className="w-3.5 h-3.5" /> New Project</Button></Link>
                </Card>
              ) : (
                <motion.div variants={container} initial="hidden" animate="show" className="space-y-2">
                  {projects.map(p => {
                    const st = STATUS_LABELS[p.status] ?? STATUS_LABELS.draft;
                    return (
                      <motion.div key={p.id} variants={item}>
                        <Link href={`/scripts/generator?projectId=${p.id}`}>
                          <Card className="group hover:border-[hsl(var(--primary))/40] transition-all duration-150 cursor-pointer">
                            <CardContent className="p-4 flex items-center gap-4">
                              <div className="w-8 h-8 rounded-lg bg-[hsl(var(--primary))/12] flex items-center justify-center shrink-0">
                                <FileText className="w-4 h-4 text-[hsl(var(--primary))]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm truncate group-hover:text-[hsl(var(--primary))] transition-colors">{p.title}</p>
                                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 truncate">{p.topic} · {p.videoLength}m · {p.platform}</p>
                              </div>
                              <Badge variant={st.variant}>{st.label}</Badge>
                              <div className="flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))] shrink-0">
                                <Clock className="w-3 h-3" />
                                {new Date(p.updatedAt).toLocaleDateString()}
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </section>

            {/* Status panel */}
            <section>
              <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-4">System</p>
              <Card>
                <CardContent className="p-5 space-y-4">
                  <StatusRow label="OpenRouter AI" sub={ollamaOk ? 'Connected · free models ready' : 'Add OPENROUTER_API_KEY to .env.local'} ok={ollamaOk} />
                  <div className="h-px bg-[hsl(var(--border))]" />
                  <StatusRow label="Edge TTS" sub="24 neural voices · always on" ok={true} />
                  <div className="h-px bg-[hsl(var(--border))]" />
                  <StatusRow label="YouTube API" sub={ytKey ? 'Key configured' : 'Add key in Settings'} ok={ytKey} warn={!ytKey} />

                  {(!ollamaOk || !ytKey) && (
                    <div className="rounded-lg bg-amber-500/8 border border-amber-500/20 p-3 text-xs text-amber-400">
                      {!ollamaOk && <p>· Add <code className="bg-white/5 px-1 rounded">OPENROUTER_API_KEY</code> to .env.local and restart</p>}
                      {!ytKey && <p className="mt-1">· Add YouTube API key in <Link href="/settings" className="underline">Settings</Link></p>}
                    </div>
                  )}

                  <Link href="/settings">
                    <Button variant="outline" size="sm" className="w-full mt-1 gap-1.5">
                      <Zap className="w-3.5 h-3.5" /> Configure
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </section>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function StatusRow({ label, sub, ok, warn }: { label: string; sub: string; ok: boolean | null; warn?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="shrink-0 w-5 h-5 flex items-center justify-center">
        {ok === null
          ? <div className="skeleton w-4 h-4 rounded-full" />
          : ok
            ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            : warn
              ? <AlertTriangle className="w-4 h-4 text-amber-400" />
              : <WifiOff className="w-4 h-4 text-red-400" />
        }
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-[hsl(var(--foreground))]">{label}</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{sub}</p>
      </div>
    </div>
  );
}
