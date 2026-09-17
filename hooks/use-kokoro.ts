'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type KokoroVoice =
  | 'af_heart' | 'af_bella' | 'af_nicole' | 'af_sarah' | 'af_sky'
  | 'am_adam'  | 'am_michael' | 'am_puck' | 'am_fenrir' | 'am_echo'
  | 'bf_emma'  | 'bf_isabella' | 'bf_alice' | 'bf_lily'
  | 'bm_george' | 'bm_lewis' | 'bm_daniel' | 'bm_fable';

export interface KokoroProgress { pct: number; status: string; }
export type KokoroState = 'idle' | 'loading' | 'ready' | 'error';

// ─── Module-level singleton ───────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _tts: any = null;
let _loadPromise: Promise<void> | null = null;
let _globalState: KokoroState = 'idle';

type ProgressCb = (p: KokoroProgress) => void;
type StateCb    = (s: KokoroState, err?: string) => void;
const _progressSubs = new Set<ProgressCb>();
const _stateSubs    = new Set<StateCb>();

function notifyProgress(p: KokoroProgress) { _progressSubs.forEach(cb => cb(p)); }
function notifyState(s: KokoroState, err?: string) {
  _globalState = s;
  _stateSubs.forEach(cb => cb(s, err));
}

// Yield to the browser event loop so the UI can repaint between heavy ops
const yieldToMain = () => new Promise<void>(r => setTimeout(r, 0));

async function loadModel() {
  if (_tts)          { notifyState('ready'); return; }
  if (_loadPromise)  return _loadPromise;

  _loadPromise = (async () => {
    try {
      notifyState('loading');
      notifyProgress({ pct: 2, status: 'Importing Kokoro…' });
      await yieldToMain();

      const { KokoroTTS } = await import('kokoro-js');

      notifyProgress({ pct: 5, status: 'Downloading model (82 MB — cached after first use)…' });
      await yieldToMain();

      _tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: (info: { status: string; progress?: number; name?: string }) => {
          if (info.status === 'progress' && typeof info.progress === 'number') {
            const pct   = 5 + Math.round(info.progress * 0.85);
            const label = info.name ? info.name.split('/').pop() ?? '' : '';
            notifyProgress({
              pct,
              status: `Downloading${label ? ` ${label}` : ''}… ${info.progress.toFixed(0)}%`,
            });
          } else if (info.status === 'done') {
            notifyProgress({ pct: 92, status: 'Initialising WASM runtime…' });
          }
        },
      });

      notifyProgress({ pct: 100, status: 'Ready' });
      notifyState('ready');
    } catch (e) {
      _loadPromise = null;
      _tts         = null;
      notifyState('error', e instanceof Error ? e.message : 'Failed to load Kokoro');
    }
  })();

  return _loadPromise;
}

// ─── Sentence splitter ────────────────────────────────────────────────────────
// Splits on sentence-ending punctuation. Keeps chunks under MAX_CHARS so
// Kokoro's WASM tokenizer never hits its ~500-token limit.
const MAX_CHARS = 400;

function splitIntoChunks(text: string): string[] {
  // Split on .  !  ?  followed by whitespace or end of string
  const sentences = text
    .replace(/([.!?])\s+/g, '$1\n')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    // If a single sentence is over the limit, hard-split it at word boundaries
    if (sentence.length > MAX_CHARS) {
      if (current) { chunks.push(current.trim()); current = ''; }
      const words = sentence.split(' ');
      for (const word of words) {
        if ((current + ' ' + word).length > MAX_CHARS) {
          if (current) chunks.push(current.trim());
          current = word;
        } else {
          current = current ? current + ' ' + word : word;
        }
      }
      if (current) { chunks.push(current.trim()); current = ''; }
      continue;
    }

    if ((current + ' ' + sentence).length > MAX_CHARS) {
      if (current) chunks.push(current.trim());
      current = sentence;
    } else {
      current = current ? current + ' ' + sentence : sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// ─── WAV helpers ─────────────────────────────────────────────────────────────
// Extracts the raw PCM from a WAV ArrayBuffer (skips the 44-byte header).
function extractPCM(buf: ArrayBuffer): Uint8Array {
  // WAV header is always 44 bytes for standard PCM
  return new Uint8Array(buf, 44);
}

// Reads sample rate / channels / bit depth from a WAV ArrayBuffer header.
function parseWavHeader(buf: ArrayBuffer) {
  const v = new DataView(buf);
  return {
    channels:   v.getUint16(22, true),
    sampleRate: v.getUint32(24, true),
    bitDepth:   v.getUint16(34, true),
  };
}

// Builds a new WAV file by concatenating multiple WAV blobs' PCM data.
async function concatWavBlobs(blobs: Blob[]): Promise<Blob> {
  if (blobs.length === 0) throw new Error('No audio blobs to concatenate');
  if (blobs.length === 1) return blobs[0];

  const buffers = await Promise.all(blobs.map(b => b.arrayBuffer()));
  const { channels, sampleRate, bitDepth } = parseWavHeader(buffers[0]);

  const pcmParts  = buffers.map(extractPCM);
  const pcmTotal  = pcmParts.reduce((n, p) => n + p.byteLength, 0);
  const outBuf    = new ArrayBuffer(44 + pcmTotal);
  const view      = new DataView(outBuf);
  const out       = new Uint8Array(outBuf);

  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  w(0,  'RIFF'); view.setUint32(4, 36 + pcmTotal, true);
  w(8,  'WAVE');
  w(12, 'fmt '); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bitDepth / 8, true);
  view.setUint16(32, channels * bitDepth / 8, true);
  view.setUint16(34, bitDepth, true);
  w(36, 'data'); view.setUint32(40, pcmTotal, true);

  let offset = 44;
  for (const part of pcmParts) { out.set(part, offset); offset += part.byteLength; }

  return new Blob([outBuf], { type: 'audio/wav' });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useKokoro() {
  const [state,    setState]    = useState<KokoroState>(_globalState);
  const [progress, setProgress] = useState<KokoroProgress>({ pct: 0, status: '' });
  const [error,    setError]    = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (_globalState !== 'idle') setState(_globalState);

    const onP: ProgressCb = (p) => { if (mountedRef.current) setProgress(p); };
    const onS: StateCb    = (s, err) => {
      if (!mountedRef.current) return;
      setState(s);
      if (err) setError(err);
    };
    _progressSubs.add(onP);
    _stateSubs.add(onS);
    return () => {
      mountedRef.current = false;
      _progressSubs.delete(onP);
      _stateSubs.delete(onS);
    };
  }, []);

  const load = useCallback(() => {
    if (_globalState === 'ready' || _globalState === 'loading') return;
    loadModel();
  }, []);

  /**
   * Generate a complete WAV Blob for the given text.
   *
   * Splits the text into ≤400-char chunks first so Kokoro's tokenizer
   * never truncates, generates each chunk individually (with a yield
   * between each so the UI stays responsive), then concatenates all
   * chunks into a single WAV file.
   */
  const generate = useCallback(async (
    text: string,
    voice: KokoroVoice = 'af_heart',
    speed = 1.0,
  ): Promise<Blob> => {
    if (!_tts) await loadModel();
    if (!_tts) throw new Error('Model failed to load');

    const chunks = splitIntoChunks(text);
    const blobs:  Blob[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      // Yield between chunks so the UI can breathe
      await yieldToMain();
      const audio = await _tts.generate(chunk, { voice, speed });
      blobs.push(audio.toBlob() as Blob);
    }

    return concatWavBlobs(blobs);
  }, []);

  return { state, progress, error, load, generate };
}
