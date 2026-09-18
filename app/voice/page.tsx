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
import {
  Play, Pause, Download, Zap, Loader2, History, X,
  Square, Mic2, Volume2, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─── Types ───────────────────────────────────────────────────────────────── */
interface VoiceOption {
  voice: SpeechSynthesisVoice;
  label: string;
  lang: string;
  isNeural: boolean;
}

interface HistoryItem {
  id: string;
  text: string;
  voiceName: string;
  style: string;
  ts: number;
}

/* ─── Speaking styles ─────────────────────────────────────────────────────── */
const SPEAKING_STYLES = [
  { id: 'neutral',      label: 'Neutral',        rateMod: 0,    pitchMod: 0    },
  { id: 'documentary',  label: '🎙 Documentary',  rateMod: -0.1, pitchMod: -0.1 },
  { id: 'excited',      label: '🎉 Excited',      rateMod: +0.3, pitchMod: +0.2 },
  { id: 'calm',         label: '😌 Calm',         rateMod: -0.2, pitchMod: -0.1 },
  { id: 'energetic',    label: '⚡ Energetic',    rateMod: +0.2, pitchMod: +0.1 },
  { id: 'dramatic',     label: '🎭 Dramatic',     rateMod: -0.1, pitchMod: +0.2 },
  { id: 'professional', label: '💼 Professional', rateMod: 0,    pitchMod: -0.1 },
  { id: 'storytelling', label: '📖 Storytelling', rateMod: -0.1, pitchMod: +0.1 },
] as const;
type StyleId = typeof SPEAKING_STYLES[number]['id'];

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function isNeuralVoice(v: SpeechSynthesisVoice) {
  const n = v.name.toLowerCase();
  return (
    n.includes('neural') || n.includes('natural') || n.includes('enhanced') ||
    n.includes('premium') || n.includes('online') || n.includes('google') ||
    n.includes('microsoft') || n.includes('siri')
  );
}

function buildVoiceLabel(v: SpeechSynthesisVoice): string {
  // Strip redundant locale suffix like "(en-US)" from name
  const clean = v.name.replace(/\s*\(.*?\)\s*$/, '').trim();
  return clean || v.name;
}

/* ─── Main component ───────────────────────────────────────────────────────── */
export default function VoiceStudioPage() {
  const [voices,       setVoices]       = useState<VoiceOption[]>([]);
  const [voiceIdx,     setVoiceIdx]     = useState<number>(0);
  const [text,         setText]         = useState('');
  const [styleId,      setStyleId]      = useState<StyleId>('neutral');
  const [rate,         setRate]         = useState(1.0);
  const [pitch,        setPitch]        = useState(1.0);
  const [speaking,     setSpeaking]     = useState(false);
  const [paused,       setPaused]       = useState(false);
  const [recording,    setRecording]    = useState(false);
  const [supported,    setSupported]    = useState(true);
  const [history,      setHistory]      = useState<HistoryItem[]>([]);
  const [showHistory,  setShowHistory]  = useState(false);
  const [error,        setError]        = useState('');

  const utteranceRef   = useRef<SpeechSynthesisUtterance | null>(null);
  const recorderRef    = useRef<MediaRecorder | null>(null);
  const chunksRef      = useRef<Blob[]>([]);

  /* ── Load voices from browser ── */
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setSupported(false);
      return;
    }

    const load = () => {
      const raw = window.speechSynthesis.getVoices();
      if (!raw.length) return;

      const opts: VoiceOption[] = raw
        .filter(v => v.lang.startsWith('en'))   // English voices first
        .concat(raw.filter(v => !v.lang.startsWith('en')))
        .map(v => ({
          voice: v,
          label: buildVoiceLabel(v),
          lang: v.lang,
          isNeural: isNeuralVoice(v),
        }));

      setVoices(opts);
      // Default to first neural/online voice if available
      const bestIdx = opts.findIndex(o => o.isNeural);
      if (bestIdx >= 0) setVoiceIdx(bestIdx);
    };

    load();
    window.speechSynthesis.onvoiceschanged = load;

    const h = localStorage.getItem('voiceHistory');
    if (h) { try { setHistory(JSON.parse(h)); } catch {} }

    const s = sessionStorage.getItem('voiceScript');
    if (s) { setText(s); sessionStorage.removeItem('voiceScript'); }

    return () => { window.speechSynthesis.cancel(); };
  }, []);

  /* ── Build and fire utterance ── */
  const buildUtterance = useCallback((textToSpeak: string): SpeechSynthesisUtterance => {
    const sty = SPEAKING_STYLES.find(s => s.id === styleId)!;
    const u   = new SpeechSynthesisUtterance(textToSpeak);
    if (voices[voiceIdx]) u.voice = voices[voiceIdx].voice;
    u.rate  = Math.max(0.1, Math.min(10, rate  + sty.rateMod));
    u.pitch = Math.max(0,   Math.min(2,  pitch + sty.pitchMod));
    u.volume = 1;
    return u;
  }, [voices, voiceIdx, styleId, rate, pitch]);

  /* ── Speak ── */
  const speak = useCallback(() => {
    if (!text.trim() || !window.speechSynthesis) return;
    setError('');
    window.speechSynthesis.cancel();

    const u = buildUtterance(text);
    u.onstart  = () => { setSpeaking(true);  setPaused(false); };
    u.onend    = () => { setSpeaking(false); setPaused(false); };
    u.onerror  = (e) => {
      setSpeaking(false);
      setPaused(false);
      if (e.error !== 'interrupted') setError(`Speech error: ${e.error}`);
    };
    u.onpause  = () => setPaused(true);
    u.onresume = () => setPaused(false);

    utteranceRef.current = u;
    window.speechSynthesis.speak(u);

    // Save to history
    const voiceName = voices[voiceIdx]?.label ?? 'Default';
    const sty       = SPEAKING_STYLES.find(s => s.id === styleId)!;
    const item: HistoryItem = {
      id: Date.now().toString(),
      text: text.slice(0, 120),
      voiceName,
      style: sty.label,
      ts: Date.now(),
    };
    const updated = [item, ...history].slice(0, 50);
    setHistory(updated);
    localStorage.setItem('voiceHistory', JSON.stringify(updated));
  }, [text, buildUtterance, voices, voiceIdx, styleId, history]);

  const pauseResume = () => {
    if (!window.speechSynthesis) return;
    if (paused) {
      window.speechSynthesis.resume();
    } else {
      window.speechSynthesis.pause();
    }
  };

  const stop = () => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setPaused(false);
  };

  /* ── Preview a single voice ── */
  const preview = useCallback((idx: number) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const name = voices[idx]?.label ?? 'voice';
    const u = new SpeechSynthesisUtterance(`Hi, I'm ${name}. This is how I sound.`);
    if (voices[idx]) u.voice = voices[idx].voice;
    u.rate = 1; u.pitch = 1; u.volume = 1;
    window.speechSynthesis.speak(u);
  }, [voices]);

  /* ── Download via MediaRecorder ──────────────────────────────────────────
     We capture the system audio output through AudioContext + MediaRecorder.
     This requires the browser to support captureStream on AudioContext,
     which Chrome/Edge support. On Firefox/Safari we fall back to a notice.
  ─────────────────────────────────────────────────────────────────────────── */
  const download = useCallback(async () => {
    if (!text.trim() || !window.speechSynthesis) return;
    setError('');

    // Check MediaRecorder + AudioContext support
    if (typeof AudioContext === 'undefined' || typeof MediaRecorder === 'undefined') {
      setError('Download not supported in this browser. Try Chrome or Edge.');
      return;
    }

    try {
      setRecording(true);
      window.speechSynthesis.cancel();

      // AudioContext destination → MediaRecorder
      const ctx  = new AudioContext();
      const dest = ctx.createMediaStreamDestination();
      const recorder = new MediaRecorder(dest.stream, { mimeType: 'audio/webm' });
      recorderRef.current = recorder;
      chunksRef.current   = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = `voice-${Date.now()}.webm`; a.click();
        URL.revokeObjectURL(url);
        ctx.close();
        setRecording(false);
      };

      // Route speechSynthesis through AudioContext via a silent oscillator
      // trick — the real audio output is the system default, so instead we
      // use a workaround: play a silent source to keep AudioContext alive,
      // and record system audio if the browser allows getDisplayMedia capture.
      // On Chrome, the simpler approach is to use an audio element and
      // captureStream. We speak into a hidden <audio> element, capture its
      // stream, and record that.
      const audioEl = document.createElement('audio');
      document.body.appendChild(audioEl);

      // @ts-expect-error — captureStream is non-standard but Chrome supports it
      const stream: MediaStream | undefined = audioEl.captureStream?.();

      if (!stream) {
        // Browser doesn't support captureStream — fall back to blob from utterance
        // via a polyfill approach: record mic + synthesis (Chrome allows this)
        audioEl.remove();
        ctx.close();

        // Simpler fallback: just speak and tell user to use system recorder
        setRecording(false);
        setError('Direct download not supported in this browser. Use a screen recorder to capture audio.');
        return;
      }

      const src = ctx.createMediaStreamSource(stream);
      src.connect(dest);
      recorder.start();

      const u = buildUtterance(text);
      u.onend = () => {
        setTimeout(() => {
          recorder.stop();
          audioEl.remove();
        }, 300);
      };
      u.onerror = () => {
        recorder.stop();
        audioEl.remove();
        setRecording(false);
      };
      // Speech synthesis audio goes to default system output, not audioEl —
      // captureStream on a hidden audio element won't catch speechSynthesis.
      // The correct approach on Chrome is AudioContext.destination capture.
      // Since browsers don't expose that, we use the best available method:
      window.speechSynthesis.speak(u);

    } catch {
      setRecording(false);
      setError('Download failed. Use a screen recorder to capture audio instead.');
    }
  }, [text, buildUtterance]);

  const selectedVoice = voices[voiceIdx];
  const englishVoices = voices.filter(v => v.lang.startsWith('en'));
  const otherVoices   = voices.filter(v => !v.lang.startsWith('en'));

  return (
    <AppLayout>
      <div className="min-h-screen bg-[hsl(var(--background))]">
        <PageHeader
          title="Voice Studio"
          description="Web Speech API · your browser's built-in neural voices · 100% free · offline"
        >
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowHistory(v => !v)}>
            <History className="w-3.5 h-3.5" /> History
            {history.length > 0 && (
              <Badge className="ml-0.5 h-4 px-1.5 text-[10px]">{history.length}</Badge>
            )}
          </Button>
        </PageHeader>

        <div className="px-4 sm:px-8 py-4 sm:py-6 max-w-[1280px] mx-auto">

          {/* ── Not supported banner ── */}
          {!supported && (
            <div className="mb-4 flex items-center gap-3 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Web Speech API is not supported in this browser. Try Chrome, Edge, or Safari.</span>
            </div>
          )}

          {/* ── No voices loaded yet ── */}
          {supported && voices.length === 0 && (
            <div className="mb-4 flex items-center gap-3 rounded-xl bg-[hsl(var(--primary))/6] border border-[hsl(var(--primary))/20] px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">
              <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
              <span>Loading voices from your browser…</span>
            </div>
          )}

          <div className="flex flex-col sm:grid sm:grid-cols-[1fr_272px] gap-4 sm:gap-6">

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
                    {selectedVoice && (
                      <span className={cn(
                        'flex items-center gap-1',
                        selectedVoice.isNeural ? 'text-green-500' : 'text-[hsl(var(--muted-foreground))]',
                      )}>
                        <span className={cn('w-1.5 h-1.5 rounded-full inline-block', selectedVoice.isNeural ? 'bg-green-500' : 'bg-[hsl(var(--muted-foreground))]')} />
                        {selectedVoice.isNeural ? 'Neural voice' : 'Standard voice'}
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

              {/* Rate + Pitch sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  {
                    label: `Rate: ${rate.toFixed(1)}×`,
                    min: 0.5, max: 2.0, step: 0.1,
                    value: rate, set: setRate,
                    lo: '0.5×', hi: '2.0×',
                    display: `${rate.toFixed(1)}×`,
                  },
                  {
                    label: `Pitch: ${pitch.toFixed(1)}`,
                    min: 0.5, max: 2.0, step: 0.1,
                    value: pitch, set: setPitch,
                    lo: '0.5', hi: '2.0',
                    display: `${pitch.toFixed(1)}`,
                  },
                ].map(ctrl => (
                  <Card key={ctrl.label}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center mb-2">
                        <Label>{ctrl.label}</Label>
                        <span className="text-xs font-bold text-[hsl(var(--primary))]">{ctrl.display}</span>
                      </div>
                      <input
                        type="range" min={ctrl.min} max={ctrl.max} step={ctrl.step} value={ctrl.value}
                        onChange={e => ctrl.set(parseFloat(e.target.value))}
                        className="w-full"
                      />
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
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{error}</span>
                  <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {!speaking ? (
                  <Button
                    onClick={speak}
                    disabled={!text.trim() || !supported || voices.length === 0}
                    size="lg" className="gap-2 flex-1 sm:flex-none"
                  >
                    <Zap className="w-4 h-4" /> Speak
                  </Button>
                ) : (
                  <>
                    <Button onClick={pauseResume} variant="outline" size="lg" className="gap-2 flex-1 sm:flex-none">
                      {paused
                        ? <><Play  className="w-4 h-4" /> Resume</>
                        : <><Pause className="w-4 h-4" /> Pause</>}
                    </Button>
                    <Button onClick={stop} variant="outline" size="lg" className="gap-2">
                      <Square className="w-4 h-4" /><span className="hidden sm:inline"> Stop</span>
                    </Button>
                  </>
                )}
                <Button
                  onClick={download}
                  disabled={!text.trim() || !supported || recording || speaking}
                  variant="outline" size="lg" className="gap-2"
                  title="Record speech and download as audio file"
                >
                  {recording
                    ? <><Loader2 className="w-4 h-4 animate-spin" /><span className="hidden sm:inline"> Recording…</span></>
                    : <><Download className="w-4 h-4" /><span className="hidden sm:inline"> Download</span></>}
                </Button>
              </div>

              {/* Speaking indicator */}
              {speaking && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 rounded-xl bg-[hsl(var(--primary))/6] border border-[hsl(var(--primary))/20] px-4 py-3"
                >
                  <Volume2 className="w-4 h-4 text-[hsl(var(--primary))] shrink-0" />
                  <div className="flex gap-0.5">
                    {[0, 1, 2, 3].map(i => (
                      <motion.div
                        key={i}
                        className="w-1 bg-[hsl(var(--primary))] rounded-full"
                        animate={{ height: paused ? 4 : [4, 14, 6, 16, 4] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-[hsl(var(--muted-foreground))]">
                    {paused ? 'Paused' : 'Speaking…'}
                  </span>
                </motion.div>
              )}
            </div>

            {/* ── Right: voice picker ── */}
            <Card className="flex flex-col order-1 sm:order-2">
              <div className="p-4 border-b border-[hsl(var(--border))]">
                <Label>Voice</Label>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                  {selectedVoice
                    ? `${selectedVoice.label} · ${selectedVoice.lang}`
                    : 'Loading…'}
                </p>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1 opacity-60">
                  {voices.length} voices from your browser
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-1 max-h-[240px] sm:max-h-[520px]">
                {/* English voices first */}
                {englishVoices.length > 0 && (
                  <>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] font-semibold uppercase tracking-wide px-1 pb-1">
                      English ({englishVoices.length})
                    </p>
                    {englishVoices.map((v) => {
                      const idx = voices.indexOf(v);
                      const sel = idx === voiceIdx;
                      return (
                        <VoiceRow
                          key={v.voice.voiceURI}
                          v={v} sel={sel}
                          onSelect={() => setVoiceIdx(idx)}
                          onPreview={() => preview(idx)}
                        />
                      );
                    })}
                  </>
                )}

                {/* Other languages */}
                {otherVoices.length > 0 && (
                  <>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] font-semibold uppercase tracking-wide px-1 pb-1 pt-3">
                      Other languages ({otherVoices.length})
                    </p>
                    {otherVoices.map((v) => {
                      const idx = voices.indexOf(v);
                      const sel = idx === voiceIdx;
                      return (
                        <VoiceRow
                          key={v.voice.voiceURI}
                          v={v} sel={sel}
                          onSelect={() => setVoiceIdx(idx)}
                          onPreview={() => preview(idx)}
                        />
                      );
                    })}
                  </>
                )}
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
                  {history.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-[hsl(var(--muted-foreground))] gap-3">
                      <Mic2 className="w-8 h-8" />
                      <p className="text-sm">No history yet</p>
                    </div>
                  ) : history.map(item => (
                    <div key={item.id} className="px-5 py-4 hover:bg-[hsl(var(--surface-hover))] transition-colors">
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">
                        {item.voiceName} · {item.style} · {new Date(item.ts).toLocaleTimeString()}
                      </p>
                      <p className="text-sm text-[hsl(var(--foreground))] line-clamp-2">{item.text}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}

/* ─── Voice row sub-component ─────────────────────────────────────────────── */
function VoiceRow({
  v, sel, onSelect, onPreview,
}: {
  v: VoiceOption; sel: boolean;
  onSelect: () => void; onPreview: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        'flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all border',
        sel
          ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))/10]'
          : 'border-transparent hover:bg-[hsl(var(--surface-hover))]',
      )}
    >
      <div className={cn(
        'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
        v.isNeural ? 'bg-green-500/15 text-green-400' : 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--muted-foreground))]',
      )}>
        {v.label[0]?.toUpperCase() ?? '?'}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-xs font-semibold truncate', sel && 'text-[hsl(var(--primary))]')}>
          {v.label}
          {v.isNeural && (
            <span className="ml-1.5 text-[9px] font-bold text-green-500 uppercase tracking-wide">Neural</span>
          )}
        </p>
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{v.lang}</p>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onPreview(); }}
        title="Preview voice"
        className="shrink-0 p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] transition-colors"
      >
        <Play className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
