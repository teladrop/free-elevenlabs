'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Layers, Plus } from 'lucide-react';
import { ScriptLine } from '@/lib/types';

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const row     = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } };

export default function LineBreakdownPage() {
  const [lines,      setLines]      = useState<ScriptLine[]>([]);
  const [pasteMode,  setPasteMode]  = useState(false);
  const [rawScript,  setRawScript]  = useState('');

  useEffect(() => {
    const s = sessionStorage.getItem('visualLines');
    if (s) { try { setLines(JSON.parse(s)); } catch {} }
  }, []);

  const loadFromPaste = () => {
    const sentences = rawScript
      .split(/(?<=[.!?])\s+|\n+/)
      .map(s => s.trim())
      .filter(s => s.length > 5);
    const nl: ScriptLine[] = sentences.map((text, i) => ({ id: `line_${i}`, index: i, text }));
    setLines(nl);
    sessionStorage.setItem('visualLines', JSON.stringify(nl));
    setPasteMode(false);
    setRawScript('');
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-[hsl(var(--background))]">
        <PageHeader title="Line Breakdown" description="Every script sentence mapped to its visual prompt">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setPasteMode(v => !v)}>
            <Plus className="w-3.5 h-3.5" />
            {pasteMode ? 'Cancel' : 'Paste Script'}
          </Button>
        </PageHeader>

        <div className="px-8 py-6 max-w-[1100px] mx-auto space-y-5">

          {/* Paste mode */}
          {pasteMode && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardContent className="p-5 space-y-3">
                  <Label>Paste Script</Label>
                  <Textarea value={rawScript} onChange={e => setRawScript(e.target.value)}
                    placeholder="Paste your script here. Each sentence will become a line." rows={6} />
                  <Button onClick={loadFromPaste} disabled={!rawScript.trim()} className="gap-2">
                    Split into Lines
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Lines */}
          {lines.length === 0 ? (
            <Card className="py-20 text-center">
              <Layers className="w-12 h-12 mx-auto text-[hsl(var(--muted-foreground))] mb-4" />
              <p className="text-sm text-[hsl(var(--muted-foreground))] mb-2">No lines loaded</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]/60">
                Generate visuals in{' '}
                <a href="/visuals/prompts" className="text-[hsl(var(--primary))] hover:underline">Visual Prompts</a>
                {' '}or paste a script above
              </p>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                  {lines.length} lines
                </p>
                <div className="flex gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                  <span className="text-emerald-400 font-semibold">{lines.filter(l => l.visualPrompt).length}</span> with visuals ·
                  <span className="text-amber-400 font-semibold">{lines.filter(l => !l.visualPrompt).length}</span> pending
                </div>
              </div>
              <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-2">
                {lines.map(line => (
                  <motion.div key={line.id} variants={row}>
                    <Card className={line.visualPrompt ? 'hover:border-[hsl(var(--primary))/30]' : 'hover:border-amber-500/30'}>
                      <CardContent className="p-4 grid grid-cols-[36px_1fr_1fr] gap-5 items-start">
                        {/* Line number */}
                        <div className="pt-0.5">
                          <Badge variant="outline" className="text-[10px] w-8 justify-center px-0">
                            {line.index + 1}
                          </Badge>
                        </div>

                        {/* Script */}
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-1.5">Narration</p>
                          <p className="text-sm leading-relaxed text-[hsl(var(--foreground))]">{line.text}</p>
                          {line.duration && (
                            <p className="mt-1.5 text-[10px] text-[hsl(var(--muted-foreground))]/60">{line.duration}s</p>
                          )}
                        </div>

                        {/* Visual prompt */}
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-1.5">Visual Prompt</p>
                          {line.visualPrompt ? (
                            <p className="text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{line.visualPrompt}</p>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              <p className="text-xs text-amber-400/70 italic">
                                Not generated · go to{' '}
                                <a href="/visuals/prompts" className="text-amber-400 hover:underline">Visual Prompts</a>
                              </p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
