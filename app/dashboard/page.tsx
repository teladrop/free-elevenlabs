'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Search, FileText, Layers, Mic2, FolderOpen,
  ArrowRight, Plus, Clock, TrendingUp, Zap,
  BarChart2, Lightbulb, PlayCircle, ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Project } from '@/lib/types';

// ─── Quick action tiles ───────────────────────────────────────────────────────

const ACTIONS = [
  {
    label: 'YouTube Research',
    desc:  'Find gaps before competitors do',
    href:  '/research',
    icon:  Search,
    color: 'from-red-500 to-orange-500',
    bg:    'bg-red-500/10',
    iconColor: 'text-red-400',
  },
  {
    label: 'Write Script',
    desc:  'Retention-first AI narration',
    href:  '/scripts/generator',
    icon:  FileText,
    color: 'from-blue-500 to-indigo-500',
    bg:    'bg-blue-500/10',
    iconColor: 'text-blue-400',
  },
  {
    label: 'Visual Prompts',
    desc:  'Line-by-line scene descriptions',
    href:  '/visuals/prompts',
    icon:  Layers,
    color: 'from-purple-500 to-pink-500',
    bg:    'bg-purple-500/10',
    iconColor: 'text-purple-400',
  },
  {
    label: 'Voice Over',
    desc:  '23 free neural TTS voices',
    href:  '/voice',
    icon:  Mic2,
    color: 'from-teal-500 to-cyan-500',
    bg:    'bg-teal-500/10',
    iconColor: 'text-teal-400',
  },
  {
    label: 'My Channel',
    desc:  'Analytics & competitor gaps',
    href:  '/my-channel',
    icon:  BarChart2,
    color: 'from-amber-500 to-yellow-500',
    bg:    'bg-amber-500/10',
    iconColor: 'text-amber-400',
  },
  {
    label: 'Content Ideas',
    desc:  'AI ideas from real search data',
    href:  '/research',
    icon:  Lightbulb,
    color: 'from-emerald-500 to-green-500',
    bg:    'bg-emerald-500/10',
    iconColor: 'text-emerald-400',
  },
];

const STATUS_LABELS: Record<string, { label: string; color: string; dot: string }> = {
  draft:     { label: 'Draft',     color: 'text-[hsl(var(--muted-foreground))]', dot: 'bg-zinc-500' },
  research:  { label: 'Research',  color: 'text-amber-400',   dot: 'bg-amber-400' },
  scripting: { label: 'Scripting', color: 'text-blue-400',    dot: 'bg-blue-400' },
  visual:    { label: 'Visuals',   color: 'text-purple-400',  dot: 'bg-purple-400' },
  voiceover: { label: 'Voice',     color: 'text-teal-400',    dot: 'bg-teal-400' },
  complete:  { label: 'Done',      color: 'text-emerald-400', dot: 'bg-emerald-400' },
};

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(d => { if (d.success) setProjects(d.data.slice(0, 6)); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const hour   = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' :
    hour < 17 ? 'Good afternoon' :
                'Good evening';

  return (
    <AppLayout>
      <div className="min-h-screen bg-[hsl(var(--background))]">

        {/* ── Hero / welcome bar ─────────────────────────────────────── */}
        <div className="relative overflow-hidden border-b border-[hsl(var(--border))] bg-gradient-to-br from-[hsl(var(--card))] via-[hsl(var(--background))] to-[hsl(var(--card))]">
          {/* Subtle glow */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_hsl(var(--primary))/6,_transparent_60%)] pointer-events-none" />
          <div className="relative max-w-[1280px] mx-auto px-6 sm:px-8 py-8 sm:py-10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-[hsl(var(--primary))]" />
                  <span className="text-xs font-semibold text-[hsl(var(--primary))] uppercase tracking-widest">
                    ContentStudio
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-[hsl(var(--foreground))]">
                  {greeting} 👋
                </h1>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                  What are you creating today?
                </p>
              </div>
              <Link href="/projects">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 h-10 px-5 rounded-xl bg-[hsl(var(--primary))] text-white text-sm font-semibold shadow-lg shadow-[hsl(var(--primary))/20] hover:opacity-90 transition-opacity"
                >
                  <Plus className="w-4 h-4" /> New Project
                </motion.button>
              </Link>
            </div>
          </div>
        </div>

        <div className="max-w-[1280px] mx-auto px-6 sm:px-8 py-8 space-y-10">

          {/* ── Quick actions ───────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                Tools
              </h2>
            </div>
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
            >
              {ACTIONS.map(a => (
                <motion.div key={a.label} variants={item}>
                  <Link href={a.href}>
                    <div className="group relative rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 hover:border-[hsl(var(--primary))/40] hover:shadow-lg hover:shadow-[hsl(var(--primary))/6] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden">
                      {/* Hover gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                      <div className="relative">
                        <div className={`w-10 h-10 rounded-xl ${a.bg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-200`}>
                          <a.icon className={`w-5 h-5 ${a.iconColor}`} />
                        </div>
                        <p className="text-sm font-semibold text-[hsl(var(--foreground))] mb-0.5 leading-tight">
                          {a.label}
                        </p>
                        <p className="text-[11px] text-[hsl(var(--muted-foreground))] leading-snug">
                          {a.desc}
                        </p>
                        <div className="flex items-center gap-1 mt-3 text-[11px] font-semibold text-[hsl(var(--primary))] opacity-0 group-hover:opacity-100 transition-opacity">
                          Open <ChevronRight className="w-3 h-3" />
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          </section>

          {/* ── Stats strip ─────────────────────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3"
          >
            {[
              { label: 'Projects',      value: String(projects.length || '—'), icon: FolderOpen,  color: 'text-blue-400',    bg: 'bg-blue-500/10'    },
              { label: 'Scripts',       value: String(projects.filter(p => p.status !== 'draft').length || '—'), icon: FileText, color: 'text-purple-400', bg: 'bg-purple-500/10' },
              { label: 'Free TTS',      value: '23 voices',                    icon: Mic2,        color: 'text-teal-400',    bg: 'bg-teal-500/10'    },
              { label: 'AI Models',     value: 'Groq + Gemini',                icon: Zap,         color: 'text-amber-400',   bg: 'bg-amber-500/10'   },
            ].map(s => (
              <div key={s.label} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-base font-bold text-[hsl(var(--foreground))] truncate">{s.value}</p>
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{s.label}</p>
                </div>
              </div>
            ))}
          </motion.section>

          {/* ── Recent projects ─────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                Recent Projects
              </h2>
              <Link href="/projects"
                className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
                View all <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[1,2,3].map(i => (
                  <div key={i} className="h-24 rounded-2xl bg-[hsl(var(--card))] animate-pulse border border-[hsl(var(--border))]" />
                ))}
              </div>
            ) : projects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] p-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-[hsl(var(--surface-elevated))] flex items-center justify-center mx-auto mb-4">
                  <FolderOpen className="w-6 h-6 text-[hsl(var(--muted-foreground))]" />
                </div>
                <p className="text-sm font-medium text-[hsl(var(--foreground))] mb-1">No projects yet</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mb-5">
                  Create your first project to start building content
                </p>
                <Link href="/projects">
                  <button className="inline-flex items-center gap-2 h-9 px-5 rounded-xl bg-[hsl(var(--primary))] text-white text-sm font-semibold hover:opacity-90 transition-opacity">
                    <Plus className="w-4 h-4" /> Create Project
                  </button>
                </Link>
              </div>
            ) : (
              <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
              >
                {projects.map(p => {
                  const st = STATUS_LABELS[p.status] ?? STATUS_LABELS.draft;
                  return (
                    <motion.div key={p.id} variants={item}>
                      <Link href={`/scripts/generator?projectId=${p.id}`}>
                        <div className="group rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 hover:border-[hsl(var(--primary))/40] hover:shadow-md hover:shadow-[hsl(var(--primary))/6] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="w-9 h-9 rounded-xl bg-[hsl(var(--primary))/10] flex items-center justify-center shrink-0">
                              <FileText className="w-4 h-4 text-[hsl(var(--primary))]" />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                              <span className={`text-[10px] font-semibold ${st.color}`}>{st.label}</span>
                            </div>
                          </div>
                          <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate group-hover:text-[hsl(var(--primary))] transition-colors mb-1">
                            {p.title}
                          </p>
                          <p className="text-[11px] text-[hsl(var(--muted-foreground))] truncate mb-3">
                            {p.topic} · {p.videoLength}m · {p.platform}
                          </p>
                          <div className="flex items-center gap-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">
                            <Clock className="w-3 h-3" />
                            {new Date(p.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </section>

          {/* ── Workflow guide ──────────────────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-4">
              Content Workflow
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { step: '01', label: 'Research',    desc: 'Find trending topics & gaps',        icon: Search,   color: 'text-red-400',    bg: 'bg-red-500/10',    href: '/research' },
                { step: '02', label: 'Script',      desc: 'Write retention-first narration',    icon: FileText, color: 'text-blue-400',   bg: 'bg-blue-500/10',   href: '/scripts/generator' },
                { step: '03', label: 'Visuals',     desc: 'Generate scene-by-scene prompts',    icon: Layers,   color: 'text-purple-400', bg: 'bg-purple-500/10', href: '/visuals/prompts' },
                { step: '04', label: 'Voice Over',  desc: 'Record with free neural TTS',        icon: Mic2,     color: 'text-teal-400',   bg: 'bg-teal-500/10',   href: '/voice' },
              ].map((w, i) => (
                <Link key={w.step} href={w.href}>
                  <div className="group relative rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 hover:border-[hsl(var(--primary))/40] transition-all duration-200 cursor-pointer overflow-hidden">
                    {/* Step connector line */}
                    {i < 3 && (
                      <div className="absolute top-1/2 -right-1.5 w-3 h-px bg-[hsl(var(--border))] hidden lg:block" />
                    )}
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-xl ${w.bg} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                        <w.icon className={`w-4 h-4 ${w.color}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] tabular-nums">{w.step}</span>
                          <span className="text-sm font-semibold text-[hsl(var(--foreground))] group-hover:text-[hsl(var(--primary))] transition-colors">{w.label}</span>
                        </div>
                        <p className="text-[11px] text-[hsl(var(--muted-foreground))] leading-snug">{w.desc}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-[hsl(var(--primary))] opacity-0 group-hover:opacity-100 transition-opacity">
                      Start <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </motion.section>

        </div>
      </div>
    </AppLayout>
  );
}
