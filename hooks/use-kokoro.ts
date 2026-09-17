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

// Yield to the browser event loop so the UI can repaint
const yieldToMain = () => new Promise<void>(r => setTimeout(r, 0));

async function loadModel() {
  if (_tts) { notifyState('ready'); return; }
  if (_loadPromise) return _loadPromise;

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
   * Generate a WAV Blob from text.
   * Auto-loads the model on first call.
   * Uses the streaming API internally so long scripts process sentence by
   * sentence — the Promise resolves with the full concatenated WAV.
   */
  const generate = useCallback(async (
    text: string,
    voice: KokoroVoice = 'af_heart',
    speed = 1.0,
  ): Promise<Blob> => {
    if (!_tts) await loadModel();
    if (!_tts) throw new Error('Model failed to load');

    // For short text use generate() directly; for longer text use stream()
    // so we don't block the main thread for the full duration at once.
    const STREAM_THRESHOLD = 200; // characters

    if (text.length <= STREAM_THRESHOLD) {
      const audio = await _tts.generate(text, { voice, speed });
      return audio.toBlob() as Blob;
    }

    // Streaming: collect all chunks then concatenate into one WAV blob
    const { TextSplitterStream } = await import('kokoro-js');
    const splitter = new TextSplitterStream();
    const stream   = _tts.stream(splitter, { voice, speed });

    // Push text asynchronously while collecting results
    const buffers: ArrayBuffer[] = [];

    const pushText = async () => {
      const tokens = text.match(/\s*\S+/g) ?? [];
      for (const token of tokens) {
        splitter.push(token);
        // Yield briefly so the progress bar and UI can update
        await yieldToMain();
      }
      splitter.close();
    };

    const collectAudio = async () => {
      for await (const { audio } of stream) {
        const blob: Blob = audio.toBlob();
        buffers.push(await blob.arrayBuffer());
        await yieldToMain();
      }
    };

    await Promise.all([pushText(), collectAudio()]);

    if (buffers.length === 0) throw new Error('No audio generated');

    // All chunks are WAV — use the first header, concatenate only the PCM data
    // from subsequent chunks to produce a single valid WAV.
    if (buffers.length === 1) return new Blob([buffers[0]], { type: 'audio/wav' });

    // Parse WAV header from first buffer
    const first   = new DataView(buffers[0]);
    const sampleRate = first.getUint32(24, true);
    const bitDepth   = first.getUint16(34, true);
    const channels   = first.getUint16(22, true);

    // Collect raw PCM from every chunk (skip 44-byte WAV header each time)
    const pcmParts: Uint8Array[] = buffers.map(buf => new Uint8Array(buf, 44));
    const pcmLen  = pcmParts.reduce((n, p) => n + p.byteLength, 0);

    // Build a new WAV header for the concatenated PCM
    const outBuf = new ArrayBuffer(44 + pcmLen);
    const view   = new DataView(outBuf);
    const out    = new Uint8Array(outBuf);

    const writeStr = (offset: number, s: string) => {
      for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
    };
    const byteRate   = sampleRate * channels * bitDepth / 8;
    const blockAlign = channels * bitDepth / 8;

    writeStr(0,  'RIFF');
    view.setUint32(4,  36 + pcmLen,  true);
    writeStr(8,  'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16,           true);
    view.setUint16(20, 1,            true); // PCM
    view.setUint16(22, channels,     true);
    view.setUint32(24, sampleRate,   true);
    view.setUint32(28, byteRate,     true);
    view.setUint16(32, blockAlign,   true);
    view.setUint16(34, bitDepth,     true);
    writeStr(36, 'data');
    view.setUint32(40, pcmLen,       true);

    let offset = 44;
    for (const part of pcmParts) { out.set(part, offset); offset += part.byteLength; }

    return new Blob([outBuf], { type: 'audio/wav' });
  }, []);

  return { state, progress, error, load, generate };
}
