'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2, ArrowLeft, Search, FileText, Layers, Mic2,
  CheckCircle2, Clock, ExternalLink, Save,
  ChevronRight, Pencil, Check, X, Trash2, ArrowRight, Tag, RefreshCw, History,
} from 'lucide-react';
import { Project } from '@/lib/types';

/* ─── Status convention ──────────────────────────────────────────────────────
   status = the NEXT stage to work on (the active one).
   A stage is "done" when its order < currentOrder.
   Example: status='scripting' means research is done, script is active.
────────────────────────────────────────────────────────────────────────────── */
const STATUS_ORDER: Record<Project['status'], number> = {
  draft: 0, research: 1, scripting: 2, visual: 3, voiceover: 4, complete: 5,
};

/* ─── Pipeline stages ────────────────────────────────────────────────────── */
const STAGES: {
  key: Project['status'];
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  desc: string;
  /** URL to open this stage's tool */
  toolHref: (p: Project) => string;
  /** URL for the NEXT stage's tool (shown as "→ Next" on done cards) */
  nextHref?: (p: Project) => string;
  nextLabel?: string;
  cta: string;
  hasContent: (p: Project) => boolean;
}[] = [
  {
    key: 'research',
    label: 'Research',
    icon: Search,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    desc: 'Find content gaps, validate your topic, and build research notes.',
    toolHref: p => `/research?topic=${encodeURIComponent(p.topic)}`,
    nextHref: p => `/scripts/generator?projectId=${p.id}&topic=${encodeURIComponent(p.topic)}`,
    nextLabel: 'Write Script →',
    cta: 'Open Research',
    hasContent: p => Boolean(p.researchNotes),
  },
  {
    key: 'scripting',
    label: 'Script',
    icon: FileText,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    desc: 'Write a retention-first script with AI analysis and auto-rewrite.',
    toolHref: p => `/scripts/generator?projectId=${p.id}&topic=${encodeURIComponent(p.topic)}`,
    nextHref: p => `/voice?projectId=${p.id}`,
    nextLabel: 'Record Voiceover →',
    cta: 'Open Script Generator',
    hasContent: p => Boolean(p.script),
  },
  {
    key: 'voiceover',
    label: 'Voiceover',
    icon: Mic2,
    color: 'text-teal-400',
    bg: 'bg-teal-500/10',
    desc: 'Generate a full voiceover using Microsoft neural voices.',
    toolHref: p => `/voice?projectId=${p.id}`,
    nextHref: p => `/visuals/prompts?projectId=${p.id}`,
    nextLabel: 'Generate Visuals →',
    cta: 'Open Voice Studio',
    hasContent: p => Boolean(p.voiceSettings),
  },
  {
    key: 'visual',
    label: 'Visuals',
    icon: Layers,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    desc: 'Generate AI image prompts for every narration line.',
    toolHref: p => `/visuals/prompts?projectId=${p.id}`,
    nextHref: p => `/optimize?projectId=${p.id}&topic=${encodeURIComponent(p.topic)}&niche=${encodeURIComponent(p.topic)}`,
    nextLabel: 'Optimize Video →',
    cta: 'Open Visual Prompts',
    hasContent: p => Boolean(p.lines?.length),
  },
];

function saveToProject(projectId: string, updates: Partial<Project>) {
  return fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'update', projectId, updates }),
  }).then(r => r.json());
}

/* ─── Page ────────────────────────────────────────────────────────────────── */
export default function ProjectDetailPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();

  const [project,     setProject]     = useState<Project | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [notes,       setNotes]       = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved,  setNotesSaved]  = useState(false);
  const [editTitle,   setEditTitle]   = useState(false);
  const [titleVal,    setTitleVal]    = useState('');
  const [savingTitle, setSavingTitle] = useState(false);
  const [markingDone, setMarkingDone] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchProject = () => {
      fetch(`/api/projects?id=${id}`)
        .then(r => r.json())
        .then(d => {
          if (d.success) {
            setProject(d.data);
            setNotes(d.data.researchNotes || '');
            setTitleVal(d.data.title);
          } else {
            router.push('/projects');
          }
        })
        .finally(() => setLoading(false));
    };

    fetchProject();

    // Auto-refresh when window gains focus (user returns from script/voice/visuals)
    const handleFocus = () => {
      if (!loading) fetchProject();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [id, router, loading]);

  /* Save research notes + advance to scripting stage */
  const saveNotes = useCallback(async () => {
    if (!project) return;
    setSavingNotes(true);
    // Saving notes marks research done → advance to scripting
    const newStatus: Project['status'] =
      STATUS_ORDER[project.status] <= STATUS_ORDER['research'] ? 'scripting' : project.status;
    const d = await saveToProject(project.id, { researchNotes: notes, status: newStatus });
    if (d.success) { setProject(d.data); setNotesSaved(true); setTimeout(() => setNotesSaved(false), 2500); }
    setSavingNotes(false);
  }, [project, notes]);

  const saveTitle = useCallback(async () => {
    if (!project || !titleVal.trim()) return;
    setSavingTitle(true);
    const d = await saveToProject(project.id, { title: titleVal.trim() });
    if (d.success) { setProject(d.data); setEditTitle(false); }
    setSavingTitle(false);
  }, [project, titleVal]);

  const markComplete = useCallback(async () => {
    if (!project) return;
    setMarkingDone(true);
    const d = await saveToProject(project.id, { status: 'complete' });
    if (d.success) setProject(d.data);
    setMarkingDone(false);
  }, [project]);

  const deleteProject = useCallback(async () => {
    if (!project || !confirm('Delete this project? This cannot be undone.')) return;
    await fetch('/api/projects', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', projectId: project.id }),
    });
    router.push('/projects');
  }, [project, router]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      </AppLayout>
    );
  }

  if (!project) return null;

  const currentOrder = STATUS_ORDER[project.status];
  const isComplete   = project.status === 'complete';

  return (
    <AppLayout>
      <div className="min-h-screen bg-[hsl(var(--background))]">

        {/* ── Header ── */}
        <div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <div className="max-w-[900px] mx-auto px-4 sm:px-8 py-5">
            <Link href="/projects" className="inline-flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors mb-4">
              <ArrowLeft className="w-3.5 h-3.5" /> All Projects
            </Link>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {editTitle ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={titleVal}
                      onChange={e => setTitleVal(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditTitle(false); }}
                      className="text-xl font-bold bg-transparent border-b border-[hsl(var(--primary))] outline-none flex-1 min-w-0 pb-0.5"
                      autoFocus
                    />
                    <button onClick={saveTitle} disabled={savingTitle} className="text-green-400 hover:text-green-300 p-1">
                      {savingTitle ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </button>
                    <button onClick={() => { setEditTitle(false); setTitleVal(project.title); }} className="text-[hsl(var(--muted-foreground))] p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group/title">
                    <h1 className="text-xl font-bold truncate">{project.title}</h1>
                    <button onClick={() => setEditTitle(true)}
                      className="opacity-0 group-hover/title:opacity-100 transition-opacity text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] p-1">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-3 mt-1.5 text-xs text-[hsl(var(--muted-foreground))] flex-wrap">
                  <span>{project.topic}</span>
                  <span>·</span>
                  <span>{project.videoLength}m · {project.platform}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Updated {new Date(project.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <Link href="/scripts/history">
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                    <History className="w-3.5 h-3.5" /> Script History
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs"
                  onClick={() => window.location.reload()}>
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </Button>
                {!isComplete && (
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={markComplete} disabled={markingDone}>
                    {markingDone ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Mark Done
                  </Button>
                )}
                {isComplete && (
                  <Badge variant="success" className="gap-1.5">
                    <CheckCircle2 className="w-3 h-3" /> Complete
                  </Badge>
                )}
                <button onClick={deleteProject}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-red-400 hover:bg-red-500/10 transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Pipeline bar */}
            <div className="mt-5 flex items-center gap-2 overflow-x-auto pb-1">
              {STAGES.map((s, i) => {
                const stageOrder = STATUS_ORDER[s.key];
                const done       = stageOrder < currentOrder || isComplete;
                const active     = s.key === project.status;
                const Icon       = s.icon;
                return (
                  <div key={s.key} className="flex items-center gap-2 shrink-0">
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      done   ? 'bg-[hsl(var(--primary))] text-white' :
                      active ? 'bg-[hsl(var(--primary))/15] text-[hsl(var(--primary))] border border-[hsl(var(--primary))/30]' :
                               'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--muted-foreground))]'
                    }`}>
                      {done ? <CheckCircle2 className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
                      {s.label}
                    </div>
                    {i < STAGES.length - 1 && (
                      <div className={`w-4 h-px ${done ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--border))]'}`} />
                    )}
                  </div>
                );
              })}
              {/* Optimize as final step */}
              <div className="flex items-center gap-2 shrink-0">
                <div className={`w-4 h-px ${isComplete ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--border))]'}`} />
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                  isComplete ? 'bg-[hsl(var(--primary))] text-white' : 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--muted-foreground))]'
                }`}>
                  {isComplete ? <CheckCircle2 className="w-3 h-3" /> : <Tag className="w-3 h-3" />}
                  Optimize
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="max-w-[900px] mx-auto px-4 sm:px-8 py-6 space-y-4">

          {/* Stage cards */}
          {STAGES.map((s, i) => {
            const stageOrder = STATUS_ORDER[s.key];
            const done       = stageOrder < currentOrder || isComplete;
            const active     = s.key === project.status && !isComplete;
            const future     = stageOrder > currentOrder && !isComplete;
            const Icon       = s.icon;
            const hasContent = s.hasContent(project);

            return (
              <motion.div key={s.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07, duration: 0.35 }}>
                <Card className={`transition-all duration-200 ${
                  active  ? 'border-[hsl(var(--primary))/40] shadow-sm shadow-[hsl(var(--primary))/10]' :
                  done    ? 'opacity-90' :
                  future  ? 'opacity-40' : ''
                }`}>
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        done   ? 'bg-[hsl(var(--primary))] text-white' :
                        active ? `${s.bg} ${s.color}` :
                                 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--muted-foreground))]'
                      }`}>
                        {done ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <p className="font-semibold text-sm">{s.label}</p>
                            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{s.desc}</p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 flex-wrap">
                            {/* Edit/Open tool button */}
                            {!future && (
                              <Link href={s.toolHref(project)}>
                                <Button variant={active ? 'default' : 'outline'} size="sm" className="gap-1.5 text-xs">
                                  {done ? 'Edit' : s.cta}
                                  <ExternalLink className="w-3 h-3" />
                                </Button>
                              </Link>
                            )}
                            {/* Next step button — shown on active stage */}
                            {active && s.nextHref && (
                              <Link href={s.nextHref(project)}>
                                <Button size="sm" variant="outline"
                                  className="gap-1.5 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10">
                                  {s.nextLabel} <ArrowRight className="w-3 h-3" />
                                </Button>
                              </Link>
                            )}
                          </div>
                        </div>

                        {/* Content preview OR in-progress state */}
                        {hasContent && (
                          <div className="mt-3 rounded-lg bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border))] p-3">
                            {s.key === 'scripting' && project.script && (
                              <>
                                <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-3 leading-relaxed">
                                  {project.script.slice(0, 300)}{project.script.length > 300 ? '…' : ''}
                                </p>
                                {/* Quick-send buttons */}
                                <div className="mt-2 flex gap-2">
                                  <Link href={`/voice?projectId=${project.id}`}>
                                    <Button variant="ghost" size="sm" className="gap-1 text-xs h-6 px-2">
                                      <Mic2 className="w-3 h-3" /> Send to Voice
                                    </Button>
                                  </Link>
                                  <Link href={`/visuals/prompts?projectId=${project.id}`}>
                                    <Button variant="ghost" size="sm" className="gap-1 text-xs h-6 px-2">
                                      <Layers className="w-3 h-3" /> Send to Visuals
                                    </Button>
                                  </Link>
                                </div>
                              </>
                            )}
                            {s.key === 'visual' && project.lines && (
                              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                {project.lines.length} visual prompts generated
                                {project.visualStyle && ` · ${project.visualStyle} style`}
                              </p>
                            )}
                            {s.key === 'voiceover' && project.voiceSettings && (
                              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                Voice settings saved · {(project.voiceSettings as { voice?: string }).voice ?? 'Custom voice'}
                              </p>
                            )}
                            {s.key === 'research' && project.researchNotes && (
                              <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2 leading-relaxed">
                                {project.researchNotes.slice(0, 200)}{project.researchNotes.length > 200 ? '…' : ''}
                              </p>
                            )}
                          </div>
                        )}
                        {/* "In progress" state for active stage with no content */}
                        {active && !hasContent && (
                          <div className="mt-3 rounded-lg bg-[hsl(var(--primary))/5] border border-[hsl(var(--primary))/20] px-3 py-2.5 flex items-center gap-2">
                            <Loader2 className="w-3.5 h-3.5 text-[hsl(var(--primary))] animate-spin" />
                            <p className="text-xs text-[hsl(var(--primary))] font-medium">
                              {s.key === 'research' && 'Awaiting research notes…'}
                              {s.key === 'scripting' && 'Script in progress…'}
                              {s.key === 'voiceover' && 'Voiceover in progress…'}
                              {s.key === 'visual' && 'Visuals in progress…'}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}

          {/* Optimize card — always shown, activates after visual done */}
          {(() => {
            const visualDone = STATUS_ORDER[project.status] > STATUS_ORDER['visual'] || isComplete;
            return (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.32 }}
                className={visualDone ? '' : 'opacity-40 pointer-events-none'}>
                <Card className={visualDone ? 'border-purple-500/30 shadow-sm shadow-purple-500/10' : ''}>
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isComplete ? 'bg-[hsl(var(--primary))] text-white' :
                        visualDone ? 'bg-purple-500/10 text-purple-400' :
                                     'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--muted-foreground))]'
                      }`}>
                        {isComplete ? <CheckCircle2 className="w-5 h-5" /> : <Tag className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-sm">Video Optimizer</p>
                            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                              AI-powered title, description, tags &amp; thumbnail prompts.
                            </p>
                          </div>
                          {visualDone && (
                            <Link href={`/optimize?projectId=${project.id}&topic=${encodeURIComponent(project.topic)}&niche=${encodeURIComponent(project.topic)}`}>
                              <Button size="sm" className="gap-1.5 text-xs">
                                Optimize <ExternalLink className="w-3 h-3" />
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })()}

          {/* Notes */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold text-sm">Research Notes</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                      Saving notes marks Research as done and unlocks the Script stage.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={saveNotes} disabled={savingNotes}
                    className="gap-1.5 text-xs shrink-0">
                    {savingNotes
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : notesSaved
                        ? <Check className="w-3.5 h-3.5 text-green-400" />
                        : <Save className="w-3.5 h-3.5" />}
                    {notesSaved ? 'Research Done ✓' : 'Save & Mark Research Done'}
                  </Button>
                </div>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Paste research findings, YouTube gap analysis, keywords, competitor notes…"
                  rows={5} className="text-sm resize-none" />
                {notesSaved && (
                  <p className="mt-2 text-xs text-green-400 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Research marked done — Script stage is now active.
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
