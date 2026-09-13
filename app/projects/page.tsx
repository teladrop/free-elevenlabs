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
import { Loader2, Plus, Trash2, ArrowRight, FolderOpen, Clock, FileText } from 'lucide-react';
import { Project } from '@/lib/types';

const STATUS: Record<string, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'outline' }> = {
  draft:     { label: 'Draft',     variant: 'outline'    },
  research:  { label: 'Research',  variant: 'warning'    },
  scripting: { label: 'Scripting', variant: 'default'    },
  visual:    { label: 'Visuals',   variant: 'secondary'  },
  voiceover: { label: 'Voice',     variant: 'success'    },
  complete:  { label: 'Done',      variant: 'success'    },
};

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const row     = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

export default function ProjectsPage() {
  const [projects,    setProjects]    = useState<Project[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [creating,    setCreating]    = useState(false);
  const [showForm,    setShowForm]    = useState(false);
  const [title,       setTitle]       = useState('');
  const [topic,       setTopic]       = useState('');
  const [error,       setError]       = useState('');

  useEffect(() => {
    fetch('/api/projects').then(r => r.json())
      .then(d => { if (d.success) setProjects(d.data); })
      .finally(() => setLoading(false));
  }, []);

  const create = useCallback(async () => {
    if (!title.trim() || !topic.trim()) { setError('Title and topic required'); return; }
    setCreating(true);
    try {
      const r = await fetch('/api/projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', title, topic }),
      });
      const d = await r.json();
      if (d.success) { setProjects([d.data, ...projects]); setTitle(''); setTopic(''); setShowForm(false); setError(''); }
      else setError(d.error);
    } catch { setError('Failed to create'); }
    finally { setCreating(false); }
  }, [title, topic, projects]);

  const del = useCallback(async (id: string) => {
    if (!confirm('Delete this project?')) return;
    const r = await fetch('/api/projects', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', projectId: id }),
    });
    const d = await r.json();
    if (d.success) setProjects(projects.filter(p => p.id !== id));
  }, [projects]);

  return (
    <AppLayout>
      <div className="min-h-screen bg-[hsl(var(--background))]">
        <PageHeader title="Projects" description="All your content projects in one place">
          <Button onClick={() => setShowForm(v => !v)} className="gap-2">
            <Plus className="w-4 h-4" /> New Project
          </Button>
        </PageHeader>

        <div className="px-8 py-6 max-w-[1000px] mx-auto space-y-5">

          {/* Create form */}
          <AnimatePresence>
            {showForm && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <Card>
                  <CardContent className="p-5">
                    <p className="text-sm font-semibold mb-4">New Project</p>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <Label className="mb-1.5 block">Title</Label>
                        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Project title" onKeyDown={e => e.key === 'Enter' && create()} />
                      </div>
                      <div>
                        <Label className="mb-1.5 block">Topic</Label>
                        <Input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Main topic" onKeyDown={e => e.key === 'Enter' && create()} />
                      </div>
                    </div>
                    {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
                    <div className="flex gap-2">
                      <Button onClick={create} disabled={creating} className="gap-2">
                        {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create
                      </Button>
                      <Button variant="outline" onClick={() => { setShowForm(false); setError(''); }}>Cancel</Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* List */}
          {loading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}
            </div>
          ) : projects.length === 0 ? (
            <Card className="py-20 text-center">
              <FolderOpen className="w-12 h-12 mx-auto text-[hsl(var(--muted-foreground))] mb-4" />
              <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">No projects yet. Start creating!</p>
              <Button onClick={() => setShowForm(true)} className="gap-2">
                <Plus className="w-4 h-4" /> Create First Project
              </Button>
            </Card>
          ) : (
            <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-2">
              {projects.map(p => {
                const st = STATUS[p.status] ?? STATUS.draft;
                return (
                  <motion.div key={p.id} variants={row}>
                    <Card className="group hover:border-[hsl(var(--primary))/40] transition-all duration-150">
                      <CardContent className="p-5 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-[hsl(var(--primary))/12] flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5 text-[hsl(var(--primary))]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <p className="font-semibold text-sm truncate group-hover:text-[hsl(var(--primary))] transition-colors">{p.title}</p>
                            <Badge variant={st.variant}>{st.label}</Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
                            <span>{p.topic}</span>
                            <span>·</span>
                            <span>{p.videoLength}m</span>
                            <span>·</span>
                            <span>{p.platform}</span>
                            <span>·</span>
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(p.updatedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Link href={`/scripts/generator?projectId=${p.id}`}>
                            <Button variant="ghost" size="icon" className="w-8 h-8">
                              <ArrowRight className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button variant="ghost" size="icon" className="w-8 h-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={() => del(p.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
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
