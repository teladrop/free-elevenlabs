/**
 * Kokoro TTS Web Worker
 *
 * Runs entirely off the main thread so the browser UI never hangs.
 * The model is loaded once and kept alive for the lifetime of the worker.
 *
 * Message protocol (main → worker):
 *   { type: 'load' }
 *   { type: 'generate', id: string, text: string, voice: string, speed: number }
 *
 * Message protocol (worker → main):
 *   { type: 'progress', pct: number, status: string }
 *   { type: 'ready' }
 *   { type: 'error', message: string }
 *   { type: 'result', id: string, buffer: ArrayBuffer }   ← transferable
 *   { type: 'generateError', id: string, message: string }
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tts: any = null;
let loading  = false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctx = self as any;

function post(msg: object, transfer?: Transferable[]) {
  if (transfer?.length) {
    ctx.postMessage(msg, transfer);
  } else {
    ctx.postMessage(msg);
  }
}

async function loadModel() {
  if (tts)    { post({ type: 'ready' }); return; }
  if (loading) return;
  loading = true;

  try {
    post({ type: 'progress', pct: 0, status: 'Loading Kokoro TTS…' });

    const { KokoroTTS } = await import('kokoro-js');

    post({ type: 'progress', pct: 5, status: 'Downloading model (82 MB — cached after first use)…' });

    tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: (info: { status: string; progress?: number; name?: string }) => {
        if (info.status === 'progress' && typeof info.progress === 'number') {
          const pct   = 5 + Math.round(info.progress * 0.85);
          const label = info.name ? info.name.split('/').pop() ?? '' : '';
          post({ type: 'progress', pct, status: `Downloading${label ? ` ${label}` : ''}… ${info.progress.toFixed(0)}%` });
        } else if (info.status === 'done') {
          post({ type: 'progress', pct: 92, status: 'Initialising WASM runtime…' });
        }
      },
    });

    post({ type: 'progress', pct: 100, status: 'Ready' });
    post({ type: 'ready' });
  } catch (e) {
    loading = false;
    tts     = null;
    post({ type: 'error', message: e instanceof Error ? e.message : 'Failed to load model' });
  }
}

async function generate(id: string, text: string, voice: string, speed: number) {
  try {
    // Auto-load if not ready yet
    if (!tts) await loadModel();
    if (!tts) { post({ type: 'generateError', id, message: 'Model not loaded' }); return; }

    const audio = await tts.generate(text, { voice, speed });
    // toBlob() returns a WAV Blob — extract its ArrayBuffer and transfer it
    const blob: Blob   = audio.toBlob();
    const buffer       = await blob.arrayBuffer();
    // Transfer ownership so no copy is made across the thread boundary
    post({ type: 'result', id, buffer }, [buffer]);
  } catch (e) {
    post({ type: 'generateError', id, message: e instanceof Error ? e.message : 'Generation failed' });
  }
}

ctx.onmessage = (e: MessageEvent) => {
  const msg = e.data;
  switch (msg?.type) {
    case 'load':
      loadModel();
      break;
    case 'generate':
      generate(msg.id, msg.text, msg.voice, msg.speed);
      break;
  }
};
