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
  Loader2, FileText, Trash2, RotateCcw, Clock, BarChart2,
  AlertTriangle, Copy, Check,
} from 'lucide-react';
import type { ScriptHistoryEntry } from '@/lib/db/history';

export default function ScriptHistoryPage() {
  const router = useRouter();
  const [entries,  setEntries]  = useState<ScriptHistoryEntry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied,   setCopied]   = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/history/scripts')
      .then(r => r.json())
      .then(d => {
        if (d.success) setEntries(d.data);
        else setError(d.error);
      })
      .catch(() => setError('Failed to load history'))
      .finally(() => setLoading(false));
  }, []);

  const restore = useCallback((entry: ScriptHistoryEntry) => {
    // Save full state to localStorage so the generator page picks it up
    const state = {
      topic:     entry.params.topic,
      ctype:     entry.params.contentType,
      style:     entry.params.style,
      audience:  entry.params.targetAudience,
      length:    entry.params.videoLength,
      tone:      entry.params.tone,
      intensity: entry.params.retentionIntensity,
      keyPts:    '',
      research:  entry.params.researchMaterial || '',
      platform:  entry.params.platform,
      analyze:   true,
      script:    entry.script,
      analysis:  entry.analysis,
    };
    localStorage.setItem('scriptGen_state', JSON.stringify(state));
    router.push('/scripts/generator');
  }, [router]);

  const copyScript = (entry: ScriptHistoryEntry) => {
    navigator.clipboard.writeText(entry.script);
    setCopied(entry.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const del = useCallback(async (id: string) => {
    if (!confirm('Delete this script from history?')) return;
    setDeleting(id);
    const r = await fetch('/api/history/scripts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    });
    if (r.ok) setEntries(prev => prev.filter(e => e.id !== id));
    setDeleting(null);
  }, []);

  const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <AppLayout>
      <div className="min-h-screen bg-[hsl(var(--background))]">
        <PageHeader title="Script History" description="All generated scripts — click Restore to reload any into the generator" />

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
              <FileText className="w-10 h-10 mx-auto text-[hsl(var(--muted-foreground))] mb-3" />
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No scripts yet — generate one first</p>
            </Card>
          )}

          <AnimatePresence>
            {entries.map(entry => (
              <motion.div key={entry.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Card className="hover:border-[hsl(var(--primary))/30] transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="w-9 h-9 rounded-lg bg-[hsl(var(--primary))/12] flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-[hsl(var(--primary))]" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="font-semibold text-sm text-[hsl(var(--foreground))] truncate">{entry.topic}</p>
                          <Badge variant="outline" className="text-[10px] shrink-0">{entry.params.style}</Badge>
                          <Badge variant="outline" className="text-[10px] shrink-0">{entry.params.tone}</Badge>
                          {entry.analysis && (
                            <Badge variant="outline" className={`text-[10px] shrink-0 ${
                              entry.analysis.overallScore >= 70 ? 'text-emerald-400 border-emerald-500/30' :
                              entry.analysis.overallScore >= 50 ? 'text-amber-400 border-amber-500/30' :
                              'text-red-400 border-red-500/30'}`}>
                              <BarChart2 className="w-2.5 h-2.5 mr-1" />{entry.analysis.overallScore}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-[hsl(var(--muted-foreground))]">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmt(entry.created_at)}</span>
                          {entry.word_count && <span>{entry.word_count.toLocaleString()} words</span>}
                          {entry.duration_m && <span>~{entry.duration_m}m</span>}
                          <span>{entry.params.platform}</span>
                        </div>

                        {/* Expanded preview */}
                        {expanded === entry.id && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                            className="mt-3 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg p-3 max-h-48 overflow-y-auto">
                            <p className="text-xs font-mono leading-6 text-[hsl(var(--muted-foreground))] whitespace-pre-wrap">
                              {entry.script.slice(0, 800)}{entry.script.length > 800 ? '…' : ''}
                            </p>
                          </motion.div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="w-8 h-8 text-[hsl(var(--muted-foreground))]"
                          onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                          title="Preview">
                          <FileText className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="w-8 h-8 text-[hsl(var(--muted-foreground))]"
                          onClick={() => copyScript(entry)} title="Copy script">
                          {copied === entry.id
                            ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                            : <Copy className="w-3.5 h-3.5" />}
                        </Button>
                        <Button variant="ghost" size="sm" className="gap-1.5 h-8 text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))/10]"
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
            ))}
          </AnimatePresence>
        </div>
      </div>
    </AppLayout>
  );
}
