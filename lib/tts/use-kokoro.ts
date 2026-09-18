'use client';

import { useCallback, useRef, useState } from 'react';

// ─── Module-level singleton ───────────────────────────────────────────────────
// Stored outside React so it survives re-renders and page navigations within
// the same browser session. The 82MB model downloads once, then the browser
// caches it via the Transformers.js built-in cache (IndexedDB / Cache API).

let _tts: any = null;
let _loading: Promise<any> | null = null;

async function getOrLoadKokoro(
  onProgress?: (pct: number, msg: string) => void,
) {
  if (_tts) return _tts;
  if (_loading) return _loading;

  _loading = (async () => {
    // Dynamic import so this never runs during SSR / server build
    const { KokoroTTS } = await import('kokoro-js');

    _tts = await KokoroTTS.from_pretrained(
      'onnx-community/Kokoro-82M-v1.0-ONNX',
      {
        dtype:  'q8',   // ~82 MB quantised — best quality/size tradeoff
        device: 'wasm', // pure browser, no GPU required
        progress_callback: (info: any) => {
          // info shape: { status, name, file, progress, loaded, total }
          if (info.status === 'progress' && onProgress) {
            const pct = info.total > 0
              ? Math.round((info.loaded / info.total) * 100)
              : 0;
            onProgress(pct, `Downloading model… ${pct}%`);
          }
          if (info.status === 'done' && onProgress) {
            onProgress(100, 'Model ready');
          }
        },
      },
    );

    _loading = null;
    return _tts;
  })();

  return _loading;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export type KokoroStatus =
  | 'idle'
  | 'loading'    // downloading / initialising model
  | 'ready'      // model loaded, waiting for text
  | 'generating' // running inference
  | 'error';

export interface KokoroState {
  status:   KokoroStatus;
  progress: number;       // 0-100 while loading
  message:  string;
  isReady:  boolean;
  loaded:   boolean;      // true once model is in memory
}

/**
 * useKokoro
 *
 * Returns a `generate` function that accepts text + voice id and returns
 * a Blob (audio/wav).  The model is loaded once per browser session and
 * reused on every subsequent call.
 */
export function useKokoro() {
  const [state, setState] = useState<KokoroState>({
    status:   _tts ? 'ready' : 'idle',
    progress: 0,
    message:  _tts ? 'Model ready' : '',
    isReady:  !!_tts,
    loaded:   !!_tts,
  });

  const loadingRef = useRef(false);

  /** Load the model (no-op if already loaded) */
  const load = useCallback(async () => {
    if (_tts || loadingRef.current) return;
    loadingRef.current = true;

    setState(s => ({ ...s, status: 'loading', message: 'Downloading model…', progress: 0 }));

    try {
      await getOrLoadKokoro((pct, msg) => {
        setState(s => ({ ...s, progress: pct, message: msg }));
      });
      setState({ status: 'ready', progress: 100, message: 'Model ready', isReady: true, loaded: true });
    } catch (err: any) {
      setState(s => ({ ...s, status: 'error', message: err?.message ?? 'Failed to load model' }));
      _loading = null;
    } finally {
      loadingRef.current = false;
    }
  }, []);

  /** Generate speech — loads model automatically on first call */
  const generate = useCallback(async (
    text:  string,
    voice: string = 'af_heart',
  ): Promise<Blob> => {
    setState(s => ({ ...s, status: 'loading', message: 'Loading model…', progress: 0 }));

    const tts = await getOrLoadKokoro((pct, msg) => {
      setState(s => ({ ...s, progress: pct, message: msg }));
    });

    setState(s => ({ ...s, status: 'generating', message: 'Generating audio…', loaded: true, isReady: true }));

    try {
      const audio = await tts.generate(text, { voice });

      // Convert Float32Array samples → WAV Blob
      const blob = audioToWavBlob(audio);

      setState({ status: 'ready', progress: 100, message: 'Done', isReady: true, loaded: true });
      return blob;
    } catch (err: any) {
      setState(s => ({ ...s, status: 'error', message: err?.message ?? 'Generation failed' }));
      throw err;
    }
  }, []);

  return { state, load, generate };
}

// ─── PCM Float32 → WAV ────────────────────────────────────────────────────────

function audioToWavBlob(audio: { audio: Float32Array; sampling_rate: number }): Blob {
  const { audio: samples, sampling_rate: sr } = audio;
  const numChannels  = 1;
  const bitsPerSample = 16;
  const byteRate     = sr * numChannels * (bitsPerSample / 8);
  const blockAlign   = numChannels * (bitsPerSample / 8);
  const dataLen      = samples.length * 2;
  const buffer       = new ArrayBuffer(44 + dataLen);
  const view         = new DataView(buffer);

  const write = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };

  write(0,  'RIFF');
  view.setUint32(4,  36 + dataLen, true);
  write(8,  'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);                  // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  write(36, 'data');
  view.setUint32(40, dataLen, true);

  // Clamp & convert f32 → int16
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}
