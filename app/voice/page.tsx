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
import { Play, Pause, Download, Zap, Loader2, History, X, Square, Mic2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─── Voices ──────────────────────────────────────────────────────────────── */
const VOICES = [
  { id: 'en-US-EmmaMultilingualNeural',   name: '⭐ Emma',     locale: 'en-US', gender: 'F', style: 'Conversational' },
  { id: 'en-US-AvaMultilingualNeural',    name: '⭐ Ava',      locale: 'en-US', gender: 'F', style: 'Friendly'       },
  { id: 'en-US-AndrewMultilingualNeural', name: '⭐ Andrew',   locale: 'en-US', gender: 'M', style: 'Professional'   },
  { id: 'en-US-JennyNeural',              name: 'Jenny',       locale: 'en-US', gender: 'F', style: 'Friendly'       },
  { id: 'en-US-AriaNeural',               name: 'Aria',        locale: 'en-US', gender: 'F', style: 'News'           },
  { id: 'en-US-GuyNeural',                name: 'Guy',         locale: 'en-US', gender: 'M', style: 'News'           },
  { id: 'en-US-ChristopherNeural',        name: 'Christopher', locale: 'en-US', gender: 'M', style: 'Reliable'       },
  { id: 'en-US-EricNeural',               name: 'Eric',        locale: 'en-US', gender: 'M', style: 'Calm'           },
  { id: 'en-GB-SoniaNeural',              name: 'Sonia',       locale: 'en-GB', gender: 'F', style: 'British'        },
  { id: 'en-GB-RyanNeural',               name: 'Ryan',        locale: 'en-GB', gender: 'M', style: 'British'        },
  { id: 'en-GB-MaisieNeural',             name: 'Maisie',      locale: 'en-GB', gender: 'F', style: 'British'        },
  { id: 'en-GB-ThomasNeural',             name: 'Thomas',      locale: 'en-GB', gender: 'M', style: 'British'        },
  { id: 'en-AU-NatashaNeural',            name: 'Natasha',     locale: 'en-AU', gender: 'F', style: 'Australian'     },
  { id: 'en-AU-WilliamNeural',            name: 'William',     locale: 'en-AU', gender: 'M', style: 'Australian'     },
  { id: 'en-AU-AmandaNeural',             name: 'Amanda',      locale: 'en-AU', gender: 'F', style: 'Australian'     },
  { id: 'en-IN-NeerjaNeural',             name: 'Neerja',      locale: 'en-IN', gender: 'F', style: 'Indian'         },
  { id: 'en-IN-PriyaNeural',              name: 'Priya',       locale: 'en-IN', gender: 'F', style: 'Indian'         },
  { id: 'en-CA-ClaraNeural',              name: 'Clara',       locale: 'en-CA', gender: 'F', style: 'Canadian'       },
  { id: 'en-CA-LiamNeural',               name: 'Liam',        locale: 'en-CA', gender: 'M', style: 'Canadian'       },
  { id: 'en-IE-ConnorNeural',             name: 'Connor',      locale: 'en-IE', gender: 'M', style: 'Irish'          },
  { id: 'en-IE-EmilyNeural',              name: 'Emily',       locale: 'en-IE', gender: 'F', style: 'Irish'          },
  { id: 'en-ZA-LeahNeural',               name: 'Leah',        locale: 'en-ZA', gender: 'F', style: 'S. African'     },
  { id: 'en-ZA-LukeNeural',               name: 'Luke',        locale: 'en-ZA', gender: 'M', style: 'S. African'     },
] as const;

type VoiceId = typeof VOICES[number]['id'];

/* ─── Speaking styles ─────────────────────────────────────────────────────── */
const SPEAKING_STYLES = [
  { id: 'neutral',      label: 'Neutral',        rate: '+0%',   pitch: '+0Hz'  },
  { id: 'documentary',  label: '🎙 Documentary',  rate: '-5%',   pitch: '-5Hz'  },
  { id: 'excited',      label: '🎉 Excited',      rate: '+15%',  pitch: '+10Hz' },
  { id: 'calm',         label: '😌 Calm',         rate: '-10%',  pitch: '-10Hz' },
  { id: 'energetic',    label: '⚡ Energetic',    rate: '+10%',  pitch: '+5Hz'  },
  { id: 'dramatic',     label: '🎭 Dramatic',     rate: '-5%',   pitch: '+15Hz' },
  { id: 'professional', label: '💼 Professional', rate: '+0%',   pitch: '-3Hz'  },
  { id: 'storytelling', label: '📖 Storytelling', rate: '-5%',   pitch: '+2Hz'  },
] as const;
type StyleId = typeof SPEAKING_STYLES[number]['id'];

interface HistoryItem { id: string; text: string; voiceName: string; style: string; audioUrl: string; ts: number; }

/* ─── Edge TTS call ───────────────────────────────────────────────────────── */
async function synthesize(text: string, voice: VoiceId, rate: string, pitch: string): Promise<Blob> {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice, rate, pitch }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(e.error ?? 'TTS failed');
  }
  return res.blob();
}

/* ─── Rate / pitch combiners ──────────────────────────────────────────────── */
function buildRate(speedVal: number, styleRate: string): string {
  const base  = Math.round((speedVal - 1) * 100);
  const style = parseInt(styleRate);
  const total = base + style;
  return total === 0 ? '+0%' : total > 0 ? `+${total}%` : `${total}%`;
}
function buildPitch(shift: number, stylePitch: string): string {
  const total = shift + parseInt(stylePitch);
  return total === 0 ? '+0Hz' : total > 0 ? `+${total}Hz` : `${total}Hz`;
}

/* ─── Component ───────────────────────────────────────────────────────────── */
export default function VoiceStudioPage() {
  const [text,        setText]        = useState('');
  const [voiceId,     setVoiceId]     = useState<VoiceId>('en-US-EmmaMultilingualNeural');
  const [styleId,     setStyleId]     = useState<StyleId>('neutral');
  const [speed,       setSpeed]       = useState(1.0);
  const [pitchShift,  setPitchShift]  = useState(0);
  const [generating,  setGenerating]  = useState(false);
  const [previewing,  setPreviewing]  = useState<VoiceId | null>(null);
  const [audioUrl,    setAudioUrl]    = useState<string | null>(null);
  const [playing,     setPlaying]     = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history,     setHistory]     = useState<HistoryItem[]>([]);
  const [error,       setError]       = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const s = sessionStorage.getItem('voiceScript');
    if (s) { setText(s); sessionStorage.removeItem('voiceScript'); }
    const h = localStorage.getItem('voiceHistory');
    if (h) { try { setHistory(JSON.parse(h)); } catch {} }
  }, []);

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

  const generate = useCallback(async () => {
    if (!text.trim()) return;
    setError(''); setGenerating(true);
    try {
      const sty  = SPEAKING_STYLES.find(s => s.id === styleId)!;
      const blob = await synthesize(text, voiceId, buildRate(speed, sty.rate), buildPitch(pitchShift, sty.pitch));
      const url  = URL.createObjectURL(blob);
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
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setGenerating(false); }
  }, [text, voiceId, styleId, speed, pitchShift, audioUrl, history, playUrl]);

  const preview = useCallback(async (id: VoiceId) => {
    setPreviewing(id);
    try {
      const v    = VOICES.find(v => v.id === id)!;
      const blob = await synthesize(`Hi, I'm ${v.name.replace('⭐ ', '')}. This is how I sound.`, id, '+0%', '+0Hz');
      playUrl(URL.createObjectURL(blob));
    } catch {} finally { setPreviewing(null); }
  }, [playUrl]);

  const togglePlay = () => { if (!audioRef.current || !audioUrl) return; playing ? audioRef.current.pause() : audioRef.current.play(); };
  const stop       = () => { if (!audioRef.current) return; audioRef.current.pause(); audioRef.current.currentTime = 0; setPlaying(false); };
  const download   = () => {
    if (!audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl; a.download = `voice-${Date.now()}.mp3`; a.click();
  };

  const selectedVoice = VOICES.find(v => v.id === voiceId)!;

  return (
    <AppLayout>
      <div className="min-h-screen bg-[hsl(var(--background))]">
        <PageHeader title="Voice Studio" description="Microsoft Edge TTS · 23 neural voices · always free · no limits">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowHistory(v => !v)}>
            <History className="w-3.5 h-3.5" /> History
            {history.length > 0 && <Badge className="ml-0.5 h-4 px-1.5 text-[10px]">{history.length}</Badge>}
          </Button>
        </PageHeader>

        <div className="px-4 sm:px-8 py-4 sm:py-6 max-w-[1280px] mx-auto">
          <div className="flex flex-col sm:grid sm:grid-cols-[1fr_256px] gap-4 sm:gap-6">

            {/* ── Left / Main ── */}
            <div className="space-y-4 order-2 sm:order-1">

              {/* Text area */}
              <Card>
                <CardContent className="p-4 sm:p-5">
                  <Label className="mb-2 block">Script / Text</Label>
                  <Textarea value={text} onChange={e => setText(e.target.value)}
                    placeholder="Paste your script here…" rows={8} className="text-sm leading-7" />
                  <div className="flex justify-between mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                    <span>{text.length.toLocaleString()} chars</span>
                  </div>
                </CardContent>
              </Card>

              {/* Speaking style */}
              <Card>
                <CardContent className="p-4 sm:p-5">
                  <Label className="mb-3 block">Speaking Style</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {SPEAKING_STYLES.map(s => (
                      <button key={s.id} onClick={() => setStyleId(s.id)}
                        className={cn(
                          'py-2 px-3 rounded-lg text-xs font-semibold text-center transition-all border',
                          styleId === s.id
                            ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))/12] text-[hsl(var(--primary))]'
                            : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--surface-hover))] hover:text-[hsl(var(--foreground))]',
                        )}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Speed + Pitch */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: `Speed: ${speed.toFixed(1)}×`, min: 0.5, max: 2.0, step: 0.1,
                    value: speed, set: (v: number) => setSpeed(v),
                    display: `${speed.toFixed(1)}×`, lo: '0.5×', hi: '2.0×' },
                  { label: `Pitch: ${pitchShift > 0 ? '+' : ''}${pitchShift}Hz`, min: -20, max: 20, step: 1,
                    value: pitchShift, set: (v: number) => setPitchShift(v),
                    display: `${pitchShift > 0 ? '+' : ''}${pitchShift}Hz`, lo: '-20Hz', hi: '+20Hz' },
                ].map(ctrl => (
                  <Card key={ctrl.label}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center mb-2">
                        <Label>{ctrl.label}</Label>
                        <span className="text-xs font-bold text-[hsl(var(--primary))]">{ctrl.display}</span>
                      </div>
                      <input type="range" min={ctrl.min} max={ctrl.max} step={ctrl.step} value={ctrl.value}
                        onChange={e => ctrl.set(parseFloat(e.target.value))} className="w-full" />
                      <div className="flex justify-between mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">
                        <span>{ctrl.lo}</span><span>{ctrl.hi}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2.5 rounded-xl bg-red-500/8 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                  <span className="flex-1">{error}</span>
                  <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Button onClick={generate} disabled={generating || !text.trim()} size="lg" className="gap-2 flex-1 sm:flex-none">
                  {generating
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                    : <><Zap className="w-4 h-4" /> Generate Voice</>}
                </Button>
                {audioUrl && <>
                  <Button variant="outline" onClick={togglePlay} className="gap-2 flex-1 sm:flex-none">
                    {playing ? <><Pause className="w-4 h-4" /> Pause</> : <><Play className="w-4 h-4" /> Play</>}
                  </Button>
                  <Button variant="outline" onClick={stop} className="gap-2">
                    <Square className="w-4 h-4" /><span className="hidden sm:inline"> Stop</span>
                  </Button>
                  <Button variant="outline" onClick={download} className="gap-2">
                    <Download className="w-4 h-4" /><span className="hidden sm:inline"> Download MP3</span>
                  </Button>
                </>}
              </div>
            </div>

            {/* ── Right: voice picker ── */}
            <Card className="flex flex-col order-1 sm:order-2">
              <div className="p-4 border-b border-[hsl(var(--border))]">
                <Label>Voice</Label>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                  {selectedVoice.name} · {selectedVoice.locale} · {speed.toFixed(1)}×
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-1 max-h-[220px] sm:max-h-[580px]">
                {VOICES.map(v => {
                  const sel  = v.id === voiceId;
                  const prev = previewing === v.id;
                  return (
                    <div key={v.id} onClick={() => setVoiceId(v.id)}
                      className={cn(
                        'flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all border',
                        sel ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))/10]'
                            : 'border-transparent hover:bg-[hsl(var(--surface-hover))]',
                      )}>
                      <div className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                        v.gender === 'F' ? 'bg-pink-500/15 text-pink-400' : 'bg-blue-500/15 text-blue-400',
                      )}>
                        {v.name.replace('⭐ ', '')[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-xs font-semibold truncate', sel && 'text-[hsl(var(--primary))]')}>{v.name}</p>
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{v.style} · {v.locale}</p>
                      </div>
                      <button onClick={e => { e.stopPropagation(); preview(v.id); }}
                        disabled={prev || generating}
                        className="shrink-0 p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] transition-colors disabled:opacity-40">
                        {prev ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
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
          {showHistory && <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowHistory(false)} />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="fixed inset-y-0 right-0 w-96 bg-[hsl(var(--card))] border-l border-[hsl(var(--border))] flex flex-col z-50 shadow-2xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
                <p className="font-semibold text-sm">Voice History</p>
                <div className="flex gap-2">
                  {history.length > 0 && (
                    <Button variant="ghost" size="sm" className="text-red-400 h-7 text-xs"
                      onClick={() => { setHistory([]); localStorage.removeItem('voiceHistory'); }}>
                      Clear
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setShowHistory(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-[hsl(var(--border))]">
                {history.length === 0
                  ? <div className="flex flex-col items-center justify-center h-full text-[hsl(var(--muted-foreground))] gap-3">
                      <Mic2 className="w-8 h-8" />
                      <p className="text-sm">No history yet</p>
                    </div>
                  : history.map(item => (
                      <div key={item.id} className="px-5 py-4 hover:bg-[hsl(var(--surface-hover))] transition-colors">
                        <div className="flex items-start gap-3">
                          <button onClick={() => playUrl(item.audioUrl)}
                            className="w-8 h-8 rounded-full bg-[hsl(var(--primary))/15] flex items-center justify-center shrink-0 hover:bg-[hsl(var(--primary))/25] transition-colors">
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
                }
              </div>
            </motion.div>
          </>}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
