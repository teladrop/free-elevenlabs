'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type KokoroVoice =
  | 'af_heart' | 'af_bella' | 'af_nicole' | 'af_sarah' | 'af_sky'
  | 'am_adam'  | 'am_michael' | 'am_puck' | 'am_fenrir' | 'am_echo'
  | 'bf_emma'  | 'bf_isabella' | 'bf_alice' | 'bf_lily'
  | 'bm_george' | 'bm_lewis' | 'bm_daniel' | 'bm_fable';

export interface KokoroProgress {
  pct: number;
  status: string;
}

export type KokoroState = 'idle' | 'loading' | 'ready' | 'error';

// ─── Pending generate callbacks ───────────────────────────────────────────────
// Each generate() call gets a unique id. When the worker posts back a result
// or error with that id, we resolve/reject the matching promise.
type PendingResolve = (buf: ArrayBuffer) => void;
type PendingReject  = (err: Error) => void;
const _pending = new Map<string, [PendingResolve, PendingReject]>();

// ─── Worker singleton ─────────────────────────────────────────────────────────
// One worker for the whole tab. Created lazily on first use.
let _worker: Worker | null = null;

// Subscribers that want progress / ready / error notifications
type ProgressCb = (p: KokoroProgress) => void;
type StateCb    = (s: KokoroState, err?: string) => void;
const _progressSubs = new Set<ProgressCb>();
const _stateSubs    = new Set<StateCb>();
let   _state: KokoroState = 'idle';

function getWorker(): Worker {
  if (_worker) return _worker;

  _worker = new Worker(
    // webpack/Next.js detects this pattern and bundles the worker separately
    new URL('../workers/kokoro.worker.ts', import.meta.url),
    { type: 'module' },
  );

  _worker.onmessage = (e: MessageEvent) => {
    const msg = e.data;
    switch (msg?.type) {
      case 'progress':
        _progressSubs.forEach(cb => cb({ pct: msg.pct, status: msg.status }));
        break;

      case 'ready':
        _state = 'ready';
        _stateSubs.forEach(cb => cb('ready'));
        break;

      case 'error':
        _state = 'error';
        _stateSubs.forEach(cb => cb('error', msg.message));
        break;

      case 'result': {
        const pending = _pending.get(msg.id);
        if (pending) { _pending.delete(msg.id); pending[0](msg.buffer as ArrayBuffer); }
        break;
      }

      case 'generateError': {
        const pending = _pending.get(msg.id);
        if (pending) { _pending.delete(msg.id); pending[1](new Error(msg.message)); }
        break;
      }
    }
  };

  _worker.onerror = (e) => {
    _state = 'error';
    const msg = e.message ?? 'Worker crashed';
    _stateSubs.forEach(cb => cb('error', msg));
    // Reject all pending generate calls
    _pending.forEach(([, reject]) => reject(new Error(msg)));
    _pending.clear();
    _worker = null; // allow recreation on retry
  };

  return _worker;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useKokoro() {
  const [state,    setState]    = useState<KokoroState>(_state);
  const [progress, setProgress] = useState<KokoroProgress>({ pct: 0, status: '' });
  const [error,    setError]    = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Sync with current worker state in case it was already loaded
    if (_state !== state) setState(_state);

    const onProgress: ProgressCb = (p) => {
      if (mountedRef.current) setProgress(p);
    };
    const onState: StateCb = (s, err) => {
      if (!mountedRef.current) return;
      setState(s);
      if (s === 'loading') setProgress({ pct: 0, status: 'Loading…' });
      if (err) setError(err);
    };

    _progressSubs.add(onProgress);
    _stateSubs.add(onState);

    return () => {
      mountedRef.current = false;
      _progressSubs.delete(onProgress);
      _stateSubs.delete(onState);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Trigger model download + init in the worker. Safe to call multiple times. */
  const load = useCallback(() => {
    if (_state === 'ready' || _state === 'loading') return;
    _state = 'loading';
    setState('loading');
    setError(null);
    getWorker().postMessage({ type: 'load' });
  }, []);

  /**
   * Generate a WAV Blob from text — runs entirely in the worker.
   * Auto-triggers model load if not ready yet.
   */
  const generate = useCallback(async (
    text: string,
    voice: KokoroVoice = 'af_heart',
    speed = 1.0,
  ): Promise<Blob> => {
    // Kick off load if not already started
    if (_state === 'idle') {
      _state = 'loading';
      setState('loading');
      setError(null);
      getWorker().postMessage({ type: 'load' });
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const worker = getWorker();

    return new Promise<Blob>((resolve, reject) => {
      _pending.set(id, [
        (buffer: ArrayBuffer) => resolve(new Blob([buffer], { type: 'audio/wav' })),
        reject,
      ]);
      worker.postMessage({ type: 'generate', id, text, voice, speed });
    });
  }, []);

  return { state, progress, error, load, generate };
}
