'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, Download, Zap, Loader2, History, X, Square, Mic2, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useKokoro, type KokoroVoice } from '@/hooks/use-kokoro';
import { wavToMp3 } from '@/lib/wav-to-mp3';

/* ─── Kokoro voice list ───────────────────────────────────────────────────── */
const VOICES: {
  id: KokoroVoice;
  name: string;
  accent: string;
  gender: 'F' | 'M';
  grade: string;
  traits?: string;
}[] = [
  // American English — Female
  { id: 'af_heart',   name: '⭐ Heart',    accent: 'American', gender: 'F', grade: 'A',  traits: '❤️'    },
  { id: 'af_bella',   name: '⭐ Bella',    accent: 'American', gender: 'F', grade: 'A-', traits: '🔥'    },
  { id: 'af_nicole',  name: 'Nicole',      accent: 'American', gender: 'F', grade: 'B-', traits: '🎧'    },
  { id: 'af_sarah',   name: 'Sarah',       accent: 'American', gender: 'F', grade: 'C+' },
  { id: 'af_sky',     name: 'Sky',         accent: 'American', gender: 'F', grade: 'C-' },
  // American English — Male
  { id: 'am_puck',    name: '⭐ Puck',     accent: 'American', gender: 'M', grade: 'C+' },
  { id: 'am_michael', name: 'Michael',     accent: 'American', gender: 'M', grade: 'C+' },
  { id: 'am_fenrir',  name: 'Fenrir',      accent: 'American', gender: 'M', grade: 'C+' },
  { id: 'am_echo',    name: 'Echo',        accent: 'American', gender: 'M', grade: 'D'  },
  { id: 'am_adam',    name: 'Adam',        accent: 'American', gender: 'M', grade: 'F+' },
  // British English — Female
  { id: 'bf_emma',    name: '⭐ Emma',     accent: 'British',  gender: 'F', grade: 'B-' },
  { id: 'bf_isabella',name: 'Isabella',    accent: 'British',  gender: 'F', grade: 'C'  },
  { id: 'bf_alice',   name: 'Alice',       accent: 'British',  gender: 'F', grade: 'D', traits: '⭐'   },
  { id: 'bf_lily',    name: 'Lily',        accent: 'British',  gender: 'F', grade: 'D', traits: '⭐'   },
  // British English — Male
  { id: 'bm_george',  name: 'George',      accent: 'British',  gender: 'M', grade: 'C'  },
  { id: 'bm_lewis',   name: 'Lewis',       accent: 'British',  gender: 'M', grade: 'D+' },
  { id: 'bm_daniel',  name: 'Daniel',      accent: 'British',  gender: 'M', grade: 'D', traits: '⭐'   },
  { id: 'bm_fable',   name: 'Fable',       accent: 'British',  gender: 'M', grade: 'C', traits: '⭐'   },
];

/* ─── Speaking styles → speed multipliers ────────────────────────────────── */
const SPEAKING_STYLES = [
  { id: 'neutral',      label: 'Neutral',        speedMod: 1.00 },
  { id: 'documentary',  label: '🎙 Documentary',  speedMod: 0.90 },
  { id: 'excited',      label: '🎉 Excited',      speedMod: 1.20 },
  { id: 'calm',         label: '😌 Calm',         speedMod: 0.85 },
  { id: 'energetic',    label: '⚡ Energetic',    speedMod: 1.15 },
  { id: 'dramatic',     label: '🎭 Dramatic',     speedMod: 0.95 },
  { id: 'professional', label: '💼 Professional', speedMod: 1.00 },
  { id: 'storytelling', label: '📖 Storytelling', speedMod: 0.92 },
] as const;
type StyleId = typeof SPEAKING_STYLES[number]['id'];

interface HistoryItem {
  id: string;
  text: string;
  voiceName: string;
  style: string;
  audioUrl: string;
  ts: number;
}

/* ─── Component ───────────────────────────────────────────────────────────── */
export default function VoiceStudioPage() {
  const [text,        setText]        = useState('');
  const [voiceId,     setVoiceId]     = useState<KokoroVoice>('af_heart');
  const [styleId,     setStyleId]     = useState<StyleId>('neutral');
  const [speed,       setSpeed]       = useState(1.0);
  const [generating,  setGenerating]  = useState(false);
  const [encoding,    setEncoding]    = useState(false);
  const [previewing,  setPreviewing]  = useState<KokoroVoice | null>(null);
  const [audioUrl,    setAudioUrl]    = useState<string | null>(null);
  const wavBlobRef = useRef<Blob | null>(null);
  const [playing,     setPlaying]     = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history,     setHistory]     = useState<HistoryItem[]>([]);
  const [error,       setError]       = useState('');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { state: kokoroState, progress, error: kokoroError, load, generate: kokoroGenerate } = useKokoro();

  /* restore session / history */
  useEffect(() => {
    const s = sessionStorage.getItem('voiceScript');
    if (s) { setText(s); sessionStorage.removeItem('voiceScript'); }
    const h = localStorage.getItem('voiceHistory');
    if (h) { try { setHistory(JSON.parse(h)); } catch {} }
  }, []);

  /* pre-warm the model as soon as the page mounts */
  useEffect(() => { load(); }, [load]);

  /* audio playback helpers */
  const playUrl = useCallback((url: string) => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.onended = () => setPlaying(false);
      audioRef.current.onpause = () => setPlaying(false);
      audioRef.current.onplay  = () => setPlaying(true);
    }
    audioRef.current.src = url;
    audioRef.current.play();
  }, []);

  const togglePlay = () => {
    if (!audioRef.current || !audioUrl) return;
    playing ? audioRef.current.pause() : audioRef.current.play();
  };
  const stop = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setPlaying(false);
  };
  const download = async () => {
    if (!wavBlobRef.current) return;
    setEncoding(true);
    try {
      const mp3  = await wavToMp3(wavBlobRef.current);
      const url  = URL.createObjectURL(mp3);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `kokoro-${Date.now()}.mp3`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // fallback: offer the raw WAV
      const url  = URL.createObjectURL(wavBlobRef.current);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `kokoro-${Date.now()}.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setEncoding(false);
    }
  };

  /* main generate */
  const generate = useCallback(async () => {
    if (!text.trim()) return;
    setError('');
    setGenerating(true);
    try {
      const sty         = SPEAKING_STYLES.find(s => s.id === styleId)!;
      const effectiveSpd = +(speed * sty.speedMod).toFixed(2);
      const blob        = await kokoroGenerate(text, voiceId, effectiveSpd);
      wavBlobRef.current = blob;
      const url         = URL.createObjectURL(blob);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(url);
      playUrl(url);
      const voice = VOICES.find(v => v.id === voiceId)!;
      const item: HistoryItem = {
        id: Date.now().toString(),
        text: text.slice(0, 120),
        voiceName: voice.name,
        style: sty.label,
        audioUrl: url,
        ts: Date.now(),
      };
      const updated = [item, ...history].slice(0, 50);
      setHistory(updated);
      localStorage.setItem('voiceHistory', JSON.stringify(updated));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }, [text, voiceId, styleId, speed, audioUrl, history, playUrl, kokoroGenerate]);

  /* voice preview — short sample sentence */
  const preview = useCallback(async (id: KokoroVoice) => {
    setPreviewing(id);
    try {
      const v    = VOICES.find(v => v.id === id)!;
      const blob = await kokoroGenerate(`Hi, I'm ${v.name}. This is how I sound.`, id, 1.0);
      playUrl(URL.createObjectURL(blob));
    } catch {
      /* swallow preview errors silently */
    } finally {
      setPreviewing(null);
    }
  }, [kokoroGenerate, playUrl]);

  const selectedVoice = VOICES.find(v => v.id === voiceId)!;
  const isLoading     = kokoroState === 'loading';
  const isReady       = kokoroState === 'ready';
  const isBusy        = generating || isLoading || encoding;

  return (
    <AppLayout>
      <div className="min-h-screen bg-[hsl(var(--background))]">
        <PageHeader
          title="Voice Studio"
          description="Kokoro 82M · browser-local WASM · no server, no quota"
        >
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowHistory(v => !v)}>
            <History className="w-3.5 h-3.5" /> History
            {history.length > 0 && (
              <Badge className="ml-0.5 h-4 px-1.5 text-[10px]">{history.length}</Badge>
            )}
          </Button>
        </PageHeader>

        <div className="px-4 sm:px-8 py-4 sm:py-6 max-w-[1280px] mx-auto space-y-4">

          {/* ── Model loading banner ── */}
          <AnimatePresence>
            {(isLoading || kokoroState === 'error') && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={cn(
                  'rounded-xl border px-4 py-3 text-sm',
                  kokoroState === 'error'
                    ? 'bg-red-500/8 border-red-500/20 text-red-400'
                    : 'bg-[hsl(var(--primary))/6] border-[hsl(var(--primary))/20] text-[hsl(var(--foreground))]',
                )}
              >
                {kokoroState === 'error' ? (
                  <div className="flex items-center gap-2">
                    <span className="flex-1">Failed to load model: {kokoroError}</span>
                    <button onClick={load} className="text-xs underline opacity-70 hover:opacity-100">Retry</button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-[hsl(var(--primary))] shrink-0 animate-pulse" />
                      <span className="flex-1 text-[hsl(var(--muted-foreground))]">{progress.status || 'Loading Kokoro…'}</span>
                      <span className="text-xs font-bold text-[hsl(var(--primary))] tabular-nums w-9 text-right">
                        {progress.pct}%
                      </span>
                    </div>
                    {/* progress bar */}
                    <div className="h-1 w-full rounded-full bg-[hsl(var(--border))] overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-[hsl(var(--primary))]"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress.pct}%` }}
                        transition={{ ease: 'easeOut', duration: 0.4 }}
                      />
                    </div>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                      82 MB · cached after first download · zero server compute
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Main grid: [left | voice picker] ── */}
          <div className="flex flex-col sm:grid sm:grid-cols-[1fr_256px] gap-4 sm:gap-6">

            {/* ── Left / Main ── */}
            <div className="space-y-4 order-2 sm:order-1">

              {/* Text area */}
              <Card>
                <CardContent className="p-4 sm:p-5">
                  <Label className="mb-2 block">Script / Text</Label>
                  <Textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder="Paste your script here…"
                    rows={8}
                    className="text-sm leading-7"
                  />
                  <div className="flex justify-between mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                    <span>{text.length.toLocaleString()} chars</span>
                    {isReady && (
                      <span className="flex items-center gap-1 text-green-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                        Model ready
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Speaking style */}
              <Card>
                <CardContent className="p-4 sm:p-5">
                  <Label className="mb-3 block">Speaking Style</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {SPEAKING_STYLES.map(s => (
                      <button
                        key={s.id}
                        onClick={() => setStyleId(s.id)}
                        className={cn(
                          'py-2 px-3 rounded-lg text-xs font-semibold text-center transition-all border',
                          styleId === s.id
                            ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))/12] text-[hsl(var(--primary))]'
                            : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--surface-hover))] hover:text-[hsl(var(--foreground))]',
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Speed slider — Kokoro supports 0.5–2.0 */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex justify-between items-center mb-2">
                    <Label>Speed</Label>
                    <span className="text-xs font-bold text-[hsl(var(--primary))]">{speed.toFixed(1)}×</span>
                  </div>
                  <input
                    type="range" min={0.5} max={2.0} step={0.05} value={speed}
                    onChange={e => setSpeed(parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">
                    <span>0.5×</span><span>2.0×</span>
                  </div>
                </CardContent>
              </Card>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2.5 rounded-xl bg-red-500/8 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                  <span className="flex-1">{error}</span>
                  <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={generate}
                  disabled={isBusy || !text.trim()}
                  size="lg"
                  className="gap-2 flex-1 sm:flex-none"
                >
                  {generating ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                  ) : isLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Loading model…</>
                  ) : (
                    <><Zap className="w-4 h-4" /> Generate Voice</>
                  )}
                </Button>
                {audioUrl && (
                  <>
                    <Button variant="outline" onClick={togglePlay} className="gap-2 flex-1 sm:flex-none">
                      {playing
                        ? <><Pause className="w-4 h-4" /> Pause</>
                        : <><Play  className="w-4 h-4" /> Play</>}
                    </Button>
                    <Button variant="outline" onClick={stop} className="gap-2">
                      <Square className="w-4 h-4" /><span className="hidden sm:inline"> Stop</span>
                    </Button>
                    <Button variant="outline" onClick={download} disabled={encoding} className="gap-2">
                      {encoding
                        ? <><Loader2 className="w-4 h-4 animate-spin" /><span className="hidden sm:inline"> Encoding…</span></>
                        : <><Download className="w-4 h-4" /><span className="hidden sm:inline"> Download MP3</span></>}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* ── Right: voice picker ── */}
            <Card className="flex flex-col order-1 sm:order-2">
              <div className="p-4 border-b border-[hsl(var(--border))]">
                <Label>Kokoro Voice</Label>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                  {selectedVoice.name} · {selectedVoice.accent} · {speed.toFixed(1)}×
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-1 max-h-[220px] sm:max-h-[500px]">
                {VOICES.map(v => {
                  const sel  = v.id === voiceId;
                  const prev = previewing === v.id;
                  return (
                    <div
                      key={v.id}
                      onClick={() => setVoiceId(v.id)}
                      className={cn(
                        'flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all border',
                        sel
                          ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))/10]'
                          : 'border-transparent hover:bg-[hsl(var(--surface-hover))]',
                      )}
                    >
                      <div className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                        v.gender === 'F' ? 'bg-pink-500/15 text-pink-400' : 'bg-blue-500/15 text-blue-400',
                      )}>
                        {v.name.replace('⭐ ', '')[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-xs font-semibold truncate', sel && 'text-[hsl(var(--primary))]')}>
                          {v.name}
                        </p>
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                          {v.accent} · {v.gender === 'F' ? 'Female' : 'Male'} · {v.grade}
                        </p>
                      </div>
                      {/* preview button */}
                      <button
                        onClick={e => { e.stopPropagation(); preview(v.id); }}
                        disabled={prev || isBusy}
                        title="Preview voice"
                        className="shrink-0 p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] transition-colors disabled:opacity-40"
                      >
                        {prev
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Play    className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </Card>

          </div>
        </div>

        {/* ── History Drawer ── */}
        <AnimatePresence>
          {showHistory && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 z-40"
                onClick={() => setShowHistory(false)}
              />
              <motion.div
                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 260 }}
                className="fixed inset-y-0 right-0 w-96 bg-[hsl(var(--card))] border-l border-[hsl(var(--border))] flex flex-col z-50 shadow-2xl"
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
                  <p className="font-semibold text-sm">Voice History</p>
                  <div className="flex gap-2">
                    {history.length > 0 && (
                      <Button
                        variant="ghost" size="sm" className="text-red-400 h-7 text-xs"
                        onClick={() => { setHistory([]); localStorage.removeItem('voiceHistory'); }}
                      >
                        Clear
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setShowHistory(false)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-[hsl(var(--border))]">
                  {history.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-[hsl(var(--muted-foreground))] gap-3">
                      <Mic2 className="w-8 h-8" />
                      <p className="text-sm">No history yet</p>
                    </div>
                  ) : (
                    history.map(item => (
                      <div key={item.id} className="px-5 py-4 hover:bg-[hsl(var(--surface-hover))] transition-colors">
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => playUrl(item.audioUrl)}
                            className="w-8 h-8 rounded-full bg-[hsl(var(--primary))/15] flex items-center justify-center shrink-0 hover:bg-[hsl(var(--primary))/25] transition-colors"
                          >
                            <Play className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">
                              {item.voiceName} · {item.style} · {new Date(item.ts).toLocaleTimeString()}
                            </p>
                            <p className="text-sm text-[hsl(var(--foreground))] line-clamp-2">{item.text}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
