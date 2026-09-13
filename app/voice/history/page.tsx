'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { useEffect, useState, useRef } from 'react';
import { Play, Pause, Download, Trash2, Mic2, Clock } from 'lucide-react';

interface HistoryItem { id: string; text: string; voiceName: string; style: string; audioUrl: string; ts: number; }

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const row     = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

export default function VoiceHistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const h = localStorage.getItem('voiceHistory');
    if (h) { try { setHistory(JSON.parse(h)); } catch {} }
  }, []);

  const playItem = (item: HistoryItem) => {
    if (!audioRef.current) audioRef.current = new Audio();
    if (playing === item.id) { audioRef.current.pause(); setPlaying(null); return; }
    audioRef.current.src = item.audioUrl;
    audioRef.current.onended = () => setPlaying(null);
    audioRef.current.play();
    setPlaying(item.id);
  };

  const download = (item: HistoryItem) => {
    const a = document.createElement('a');
    a.href = item.audioUrl;
    a.download = `voice-${item.id}.mp3`;
    a.click();
  };

  const del = (id: string) => {
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    localStorage.setItem('voiceHistory', JSON.stringify(updated));
  };

  const clearAll = () => {
    if (!confirm('Clear all voice history?')) return;
    setHistory([]);
    localStorage.removeItem('voiceHistory');
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-[hsl(var(--background))]">
        <PageHeader title="Voice History" description="All generated voice-overs from this session">
          {history.length > 0 && (
            <Button variant="outline" size="sm" className="gap-2 text-red-400 border-red-500/30 hover:bg-red-500/10" onClick={clearAll}>
              Clear All
            </Button>
          )}
        </PageHeader>

        <div className="px-8 py-6 max-w-[900px] mx-auto">
          {history.length === 0 ? (
            <Card className="py-20 text-center">
              <Mic2 className="w-12 h-12 mx-auto text-[hsl(var(--muted-foreground))] mb-4" />
              <p className="text-sm text-[hsl(var(--muted-foreground))] mb-2">No voice history yet</p>
              <a href="/voice" className="text-[hsl(var(--primary))] text-sm hover:underline">
                Go to Voice Studio →
              </a>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                  {history.length} recordings
                </p>
              </div>
              <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-2">
                {history.map(item => (
                  <motion.div key={item.id} variants={row}>
                    <Card className="hover:border-[hsl(var(--primary))/30] transition-colors group">
                      <CardContent className="p-4 flex items-center gap-4">
                        {/* Play button */}
                        <button onClick={() => playItem(item)}
                          className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center transition-all"
                          style={{
                            background: playing === item.id ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.12)',
                          }}>
                          {playing === item.id
                            ? <Pause className="w-4 h-4 text-white" />
                            : <Play className="w-4 h-4 text-[hsl(var(--primary))]" />}
                        </button>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate text-[hsl(var(--foreground))]">{item.text}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{item.voiceName}</Badge>
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5">{item.style}</Badge>
                            <span className="text-[10px] text-[hsl(var(--muted-foreground))] flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(item.ts).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => download(item)}>
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="w-8 h-8 text-red-400 hover:bg-red-500/10" onClick={() => del(item.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
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
