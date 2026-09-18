'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Loader2, Plus, Trash2, FolderOpen, Clock,
  Search, FileText, Layers, Mic2, CheckCircle2,
  ChevronRight, MoreHorizontal,
} from 'lucide-react';
import { Project } from '@/lib/types';

/* ─── Pipeline stages ─────────────────────────────────────────────────────── */
const STAGES: { key: Project['status']; label: string; icon: React.ElementType; color: string }[] = [
  { key: 'draft',     label: 'Draft',     icon: FolderOpen, color: 'text-gray-400'   },
  { key: 'research',  label: 'Research',  icon: Search,     color: 'text-red-400'    },
  { key: 'scripting', label: 'Script',    icon: FileText,   color: 'text-blue-400'   },
  { key: 'visual',    label: 'Visuals',   icon: Layers,     color: 'text-purple-400' },
  { key: 'voiceover', label: 'Voice',     icon: Mic2,       color: 'text-teal-400'   },
  { key: 'complete',  label: 'Done',      icon: CheckCircle2, color: 'text-green-400' },
];

const STATUS_ORDER: Record<Project['status'], number> = {
  draft: 0, research: 1, scripting: 2, visual: 3, voiceover: 4, complete: 5,
};

function PipelineBar({ status }: { status: Project['status'] }) {
  const current = STATUS_ORDER[status];
  return (
    <div className="flex items-center gap-1 mt-3">
      {STAGES.map((s, i) => {
        const done   = i < current;
        const active = i === current;
        return (
          <div key={s.key} className="flex items-center gap-1 flex-1">
            <div className={`flex-1 h-1 rounded-full transition-colors ${
              done   ? 'bg-[hsl(var(--primary))]' :
              active ? 'bg-[hsl(var(--primary))/40]' :
                       'bg-[hsl(var(--border))]'
            }`} />
            {i === STAGES.length - 1 && null}
          </div>
        );
      })}
    </div>
  );
}

function PipelineDots({ status }: { status: Project['status'] }) {
  const current = STATUS_ORDER[status];
  return (
    <div className="flex items-center gap-1.5">
      {STAGES.map((s, i) => {
        const done   = i < current;
        const active = i === current;
        const Icon   = s.icon;
        return (
          <div key={s.key} title={s.label}
            className={`relative flex items-center justify-center w-6 h-6 rounded-full border transition-all ${
              done   ? 'bg-[hsl(var(--primary))] border-[hsl(var(--primary))] text-white' :
              active ? 'bg-[hsl(var(--primary))/10] border-[hsl(var(--primary))/50] ' + s.color :
                       'bg-[hsl(var(--surface-elevated))] border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]'
            }`}>
            {done
              ? <CheckCircle2 className="w-3 h-3" />
              : <Icon className="w-3 h-3" />}
          </div>
        );
      })}
    </div>
  );
}

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const row     = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

export default function ProjectsPage() {
  const [projects,  setProjects]  = useState<Project[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [creating,  setCreating]  = useState(false);
  const [showForm,  setShowForm]  = useState(false);
  const [title,     setTitle]     = useState('');
  const [topic,     setTopic]     = useState('');
  const [error,     setError]     = useState('');
  const [deleting,  setDeleting]  = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/projects').then(r => r.json())
      .then(d => { if (d.success) setProjects(d.data); })
      .finally(() => setLoading(false));
  }, []);

  const create = useCallback(async () => {
    if (!title.trim() || !topic.trim()) { setError('Title and topic are required'); return; }
    setCreating(true);
    try {
      const r = await fetch('/api/projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', title: title.trim(), topic: topic.trim() }),
      });
      const d = await r.json();
      if (d.success) {
        setProjects(prev => [d.data, ...prev]);
        setTitle(''); setTopic(''); setShowForm(false); setError('');
      } else setError(d.error);
    } catch { setError('Failed to create project'); }
    finally { setCreating(false); }
  }, [title, topic]);

  const del = useCallback(async (id: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!confirm('Delete this project? This cannot be undone.')) return;
    setDeleting(id);
    try {
      const r = await fetch('/api/projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', projectId: id }),
      });
      const d = await r.json();
      if (d.success) setProjects(prev => prev.filter(p => p.id !== id));
    } finally { setDeleting(null); }
  }, []);

  const activeStage = (status: Project['status']) =>
    STAGES.find(s => s.key === status) ?? STAGES[0];

  return (
    <AppLayout>
      <div className="min-h-screen bg-[hsl(var(--background))]">
        <PageHeader title="Projects" description="Track every video from idea to publish">
          <Button onClick={() => setShowForm(v => !v)} className="gap-2">
            <Plus className="w-4 h-4" /> New Project
          </Button>
        </PageHeader>

        <div className="px-4 sm:px-8 py-6 max-w-[1000px] mx-auto space-y-5">

          {/* ── Create form ── */}
          <AnimatePresence>
            {showForm && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                <Card>
                  <CardContent className="p-5">
                    <p className="text-sm font-semibold mb-4">New Project</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div>
                        <Label className="mb-1.5 block text-xs">Project Title</Label>
                        <Input value={title} onChange={e => setTitle(e.target.value)}
                          placeholder="e.g. Why IKEA Makes You Walk in Circles"
                          onKeyDown={e => e.key === 'Enter' && create()} />
                      </div>
                      <div>
                        <Label className="mb-1.5 block text-xs">Topic / Niche</Label>
                        <Input value={topic} onChange={e => setTopic(e.target.value)}
                          placeholder="e.g. consumer psychology"
                          onKeyDown={e => e.key === 'Enter' && create()} />
                      </div>
                    </div>
                    {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
                    <div className="flex gap-2">
                      <Button onClick={create} disabled={creating} className="gap-2">
                        {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Create
                      </Button>
                      <Button variant="outline" onClick={() => { setShowForm(false); setError(''); }}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── List ── */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-28 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] animate-pulse" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <Card className="py-20 text-center">
              <CardContent className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-[hsl(var(--primary))/10] flex items-center justify-center">
                  <FolderOpen className="w-8 h-8 text-[hsl(var(--primary))]" />
                </div>
                <div>
                  <p className="font-semibold mb-1">No projects yet</p>
                  <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
                    Create a project to track your video from idea to publish
                  </p>
                </div>
                <Button onClick={() => setShowForm(true)} className="gap-2">
                  <Plus className="w-4 h-4" /> Create First Project
                </Button>
              </CardContent>
            </Card>
          ) : (
            <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3">
              {projects.map(p => {
                const stage = activeStage(p.status);
                const Icon  = stage.icon;
                return (
                  <motion.div key={p.id} variants={row}>
                    <Link href={`/projects/${p.id}`}>
                      <div className="group relative rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 hover:border-[hsl(var(--primary))/40] hover:bg-[hsl(var(--surface-hover))] transition-all duration-150 cursor-pointer">
                        <div className="flex items-start gap-4">
                          {/* Icon */}
                          <div className={`w-10 h-10 rounded-xl bg-[hsl(var(--surface-elevated))] flex items-center justify-center shrink-0 ${stage.color}`}>
                            <Icon className="w-5 h-5" />
                          </div>

                          {/* Body */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-semibold text-sm truncate group-hover:text-[hsl(var(--primary))] transition-colors">
                                  {p.title}
                                </p>
                                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 truncate">
                                  {p.topic} · {p.videoLength}m · {p.platform}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Badge variant={p.status === 'complete' ? 'success' : 'outline'}
                                  className="text-[10px] capitalize hidden sm:flex">
                                  {stage.label}
                                </Badge>
                                <button
                                  onClick={e => del(p.id, e)}
                                  disabled={deleting === p.id}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100">
                                  {deleting === p.id
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : <Trash2 className="w-3.5 h-3.5" />}
                                </button>
                                <ChevronRight className="w-4 h-4 text-[hsl(var(--muted-foreground))] group-hover:text-[hsl(var(--primary))] group-hover:translate-x-0.5 transition-all" />
                              </div>
                            </div>

                            {/* Pipeline dots */}
                            <div className="mt-3 flex items-center gap-3">
                              <PipelineDots status={p.status} />
                              <span className="text-[10px] text-[hsl(var(--muted-foreground))] flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(p.updatedAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
