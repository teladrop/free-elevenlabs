'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type KokoroVoice =
  | 'af_heart' | 'af_bella' | 'af_nicole' | 'af_sarah' | 'af_sky'
  | 'am_adam'  | 'am_michael' | 'am_puck' | 'am_fenrir' | 'am_echo'
  | 'bf_emma'  | 'bf_isabella' | 'bf_alice' | 'bf_lily'
  | 'bm_george' | 'bm_lewis' | 'bm_daniel' | 'bm_fable';

export interface KokoroProgress {
  /** 0–100 */
  pct: number;
  /** Human-readable status line */
  status: string;
}

export type KokoroState = 'idle' | 'loading' | 'ready' | 'error';

interface KokoroInstance {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tts: any;
  state: 'ready';
}

// ─── Module-level singleton ───────────────────────────────────────────────────
// Survives React re-renders, StrictMode double-invocations, and hot reloads.
// Only one load ever happens per browser session.
let _instance: KokoroInstance | null = null;
let _loadPromise: Promise<KokoroInstance> | null = null;

async function loadKokoro(
  onProgress: (p: KokoroProgress) => void,
): Promise<KokoroInstance> {
  if (_instance) return _instance;
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    onProgress({ pct: 0, status: 'Loading Kokoro TTS…' });

    // Dynamic import keeps this out of the server bundle entirely.
    const { KokoroTTS } = await import('kokoro-js');

    onProgress({ pct: 5, status: 'Downloading model (82 MB — cached after first use)…' });

    const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: (info: { status: string; progress?: number; name?: string }) => {
        if (info.status === 'progress' && typeof info.progress === 'number') {
          // progress is 0–100 per file; map to 5–90 overall
          const pct = 5 + Math.round(info.progress * 0.85);
          const label = info.name ? info.name.split('/').pop() ?? '' : '';
          onProgress({ pct, status: `Downloading${label ? ` ${label}` : ''}… ${info.progress.toFixed(0)}%` });
        } else if (info.status === 'done') {
          onProgress({ pct: 92, status: 'Initialising WASM runtime…' });
        }
      },
    });

    onProgress({ pct: 100, status: 'Ready' });
    _instance = { tts, state: 'ready' };
    return _instance;
  })();

  // If the load fails, clear the promise so a retry is possible.
  _loadPromise.catch(() => { _loadPromise = null; });

  return _loadPromise;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useKokoro() {
  const [state, setState] = useState<KokoroState>(() =>
    _instance ? 'ready' : 'idle',
  );
  const [progress, setProgress] = useState<KokoroProgress>({ pct: 0, status: '' });
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    // If already loaded by a previous mount, reflect that immediately.
    if (_instance) setState('ready');
    return () => { mountedRef.current = false; };
  }, []);

  /** Call once to trigger model download + init. Safe to call multiple times. */
  const load = useCallback(async () => {
    if (_instance) { setState('ready'); return; }
    if (state === 'loading') return;

    setState('loading');
    setError(null);

    try {
      await loadKokoro((p) => {
        if (mountedRef.current) setProgress(p);
      });
      if (mountedRef.current) { setState('ready'); setProgress({ pct: 100, status: 'Ready' }); }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load Kokoro';
      if (mountedRef.current) { setState('error'); setError(msg); }
    }
  }, [state]);

  /**
   * Generate a WAV Blob from text.
   * Automatically loads the model on first call.
   */
  const generate = useCallback(async (
    text: string,
    voice: KokoroVoice = 'af_heart',
    speed = 1.0,
  ): Promise<Blob> => {
    let inst = _instance;
    if (!inst) {
      setState('loading');
      setError(null);
      inst = await loadKokoro((p) => {
        if (mountedRef.current) setProgress(p);
      });
      if (mountedRef.current) setState('ready');
    }
    const audio = await inst.tts.generate(text, { voice, speed });
    return audio.toBlob();
  }, []);

  return { state, progress, error, load, generate };
}
