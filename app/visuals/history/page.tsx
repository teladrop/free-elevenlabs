'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2, Layers, Trash2, RotateCcw, Clock,
  AlertTriangle, Copy, Check, ChevronDown, ChevronRight,
} from 'lucide-react';
import type { VisualHistoryEntry } from '@/lib/db/history';

export default function VisualHistoryPage() {
  const router = useRouter();
  const [entries,  setEntries]  = useState<VisualHistoryEntry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied,   setCopied]   = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/history/visuals')
      .then(r => r.json())
      .then(d => {
        if (d.success) setEntries(d.data);
        else setError(d.error);
      })
      .catch(() => setError('Failed to load history'))
      .finally(() => setLoading(false));
  }, []);

  const restore = useCallback((entry: VisualHistoryEntry) => {
    // Write to localStorage so visual prompts page restores on mount
    const state = {
      scriptText:  entry.script_text,
      style:       entry.visual_style,
      bible:       entry.visual_bible || '',
      lines:       entry.lines,
    };
    localStorage.setItem('visualPrompts_state', JSON.stringify(state));
    router.push('/visuals/prompts');
  }, [router]);

  const copyAll = (entry: VisualHistoryEntry) => {
    const text = entry.lines
      .filter(l => l.visualPrompt?.trim())
      .map(l => l.visualPrompt!.trim())
      .join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(entry.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const del = useCallback(async (id: string) => {
    if (!confirm('Delete this session from history?')) return;
    setDeleting(id);
    const r = await fetch('/api/history/visuals', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    });
    if (r.ok) setEntries(prev => prev.filter(e => e.id !== id));
    setDeleting(null);
  }, []);

  const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const styleLabel = (s: string) => s.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');

  return (
    <AppLayout>
      <div className="min-h-screen bg-[hsl(var(--background))]">
        <PageHeader title="Visual Prompts History" description="All generated prompt sessions — click Restore to reload any into the editor" />

        <div className="px-8 py-6 max-w-[960px] mx-auto space-y-3">

          {error && (
            <div className="flex items-start gap-2.5 rounded-xl bg-amber-500/8 border border-amber-500/20 px-4 py-3 text-sm text-amber-400">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold mb-0.5">History unavailable</p>
                <p className="text-xs">{error}</p>
                {error.includes('Supabase') && (
                  <p className="text-xs mt-1 text-amber-300/70">
                    Add <code className="bg-white/5 px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
                    <code className="bg-white/5 px-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{' '}
                    <code className="bg-white/5 px-1 rounded">.env.local</code>, then restart the server.
                  </p>
                )}
              </div>
            </div>
          )}

          {loading && (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}
            </div>
          )}

          {!loading && !error && entries.length === 0 && (
            <Card className="py-20 text-center">
              <Layers className="w-10 h-10 mx-auto text-[hsl(var(--muted-foreground))] mb-3" />
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No visual prompt sessions yet — generate some first</p>
            </Card>
          )}

          <AnimatePresence>
            {entries.map(entry => {
              const isOpen = expanded === entry.id;
              const readyCount = entry.lines.filter(l => l.visualPrompt?.trim()).length;
              return (
                <motion.div key={entry.id}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <Card className="hover:border-[hsl(var(--primary))/30] transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="w-9 h-9 rounded-lg bg-purple-500/12 flex items-center justify-center shrink-0">
                          <Layers className="w-4 h-4 text-purple-400" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="font-semibold text-sm text-[hsl(var(--foreground))] truncate max-w-xs">
                              {entry.script_text.slice(0, 60)}{entry.script_text.length > 60 ? '…' : ''}
                            </p>
                            <Badge variant="outline" className="text-[10px] shrink-0">{styleLabel(entry.visual_style)}</Badge>
                            <Badge variant="outline" className="text-[10px] shrink-0 text-purple-400 border-purple-500/30">
                              {readyCount} prompts
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-[hsl(var(--muted-foreground))]">
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmt(entry.created_at)}</span>
                            <span>{entry.lines.length} lines</span>
                          </div>

                          {/* Expanded prompts list */}
                          {isOpen && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                              className="mt-3 space-y-1.5 max-h-64 overflow-y-auto pr-1">
                              {entry.lines.map(l => (
                                <div key={l.id} className="rounded-lg bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border))] px-3 py-2 text-xs">
                                  <span className="text-[hsl(var(--muted-foreground))] mr-2">#{l.index + 1}</span>
                                  <span className="text-[hsl(var(--foreground))]">{l.visualPrompt || <em className="opacity-40">no prompt</em>}</span>
                                </div>
                              ))}
                            </motion.div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="w-8 h-8 text-[hsl(var(--muted-foreground))]"
                            onClick={() => setExpanded(isOpen ? null : entry.id)} title="Preview prompts">
                            {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="w-8 h-8 text-[hsl(var(--muted-foreground))]"
                            onClick={() => copyAll(entry)} title="Copy all prompts">
                            {copied === entry.id
                              ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                              : <Copy className="w-3.5 h-3.5" />}
                          </Button>
                          <Button variant="ghost" size="sm"
                            className="gap-1.5 h-8 text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))/10]"
                            onClick={() => restore(entry)}>
                            <RotateCcw className="w-3.5 h-3.5" /> Restore
                          </Button>
                          <Button variant="ghost" size="icon"
                            className="w-8 h-8 text-red-400 hover:bg-red-500/10"
                            disabled={deleting === entry.id}
                            onClick={() => del(entry.id)}>
                            {deleting === entry.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Trash2 className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </AppLayout>
  );
}
