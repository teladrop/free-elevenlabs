'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Play, Pause, Download, Volume2, Zap,
  Music, History as HistoryIcon, X, Mic, Upload,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface HistoryItem {
  id: string;
  text: string;
  voice: string;
  audioData: string;
  timestamp: number;
}

const KOKORO_VOICES = {
  'af_heart':    { label: '❤️ af_heart',    gender: 'Female', accent: 'American' },
  'af_bella':    { label: '🔥 af_bella',    gender: 'Female', accent: 'American' },
  'af_nicole':   { label: '🎧 af_nicole',   gender: 'Female', accent: 'American' },
  'af_sarah':    { label: '✨ af_sarah',    gender: 'Female', accent: 'American' },
  'af_nova':     { label: '⭐ af_nova',     gender: 'Female', accent: 'American' },
  'af_alloy':    { label: '🎵 af_alloy',    gender: 'Female', accent: 'American' },
  'af_aoede':    { label: '🎶 af_aoede',    gender: 'Female', accent: 'American' },
  'af_jessica':  { label: '💝 af_jessica',  gender: 'Female', accent: 'American' },
  'af_kore':     { label: '🌺 af_kore',     gender: 'Female', accent: 'American' },
  'af_river':    { label: '🌊 af_river',    gender: 'Female', accent: 'American' },
  'af_sky':      { label: '🌤️ af_sky',      gender: 'Female', accent: 'American' },
  'am_michael':  { label: '🎙️ am_michael',  gender: 'Male',   accent: 'American' },
  'am_liam':     { label: '💼 am_liam',     gender: 'Male',   accent: 'American' },
  'am_puck':     { label: '⚡ am_puck',     gender: 'Male',   accent: 'American' },
  'am_echo':     { label: '🔊 am_echo',     gender: 'Male',   accent: 'American' },
  'am_adam':     { label: '🧔 am_adam',     gender: 'Male',   accent: 'American' },
  'am_eric':     { label: '👨 am_eric',     gender: 'Male',   accent: 'American' },
  'am_fenrir':   { label: '🐺 am_fenrir',   gender: 'Male',   accent: 'American' },
  'am_onyx':     { label: '⬛ am_onyx',     gender: 'Male',   accent: 'American' },
  'am_santa':    { label: '🎅 am_santa',    gender: 'Male',   accent: 'American' },
  'bf_emma':     { label: '🇬🇧 bf_emma',    gender: 'Female', accent: 'British'  },
  'bf_lily':     { label: '🌸 bf_lily',     gender: 'Female', accent: 'British'  },
  'bf_isabella': { label: '👑 bf_isabella', gender: 'Female', accent: 'British'  },
  'bf_alice':    { label: '✨ bf_alice',    gender: 'Female', accent: 'British'  },
  'bm_george':   { label: '🎩 bm_george',   gender: 'Male',   accent: 'British'  },
  'bm_fable':    { label: '📖 bm_fable',    gender: 'Male',   accent: 'British'  },
  'bm_lewis':    { label: '🧭 bm_lewis',    gender: 'Male',   accent: 'British'  },
  'bm_daniel':   { label: '🎭 bm_daniel',   gender: 'Male',   accent: 'British'  },
} as const;

type KokoroVoice = keyof typeof KOKORO_VOICES;

// ============================================================================
// WAV ENCODER
// ============================================================================

function encodeWAV(audioData: Float32Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bytesPerSample = 2;
  const dataSize = audioData.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let i = 0; i < audioData.length; i++) {
    const s = Math.max(-1, Math.min(1, audioData[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Home() {
  const [activeTab, setActiveTab] = useState<'preset' | 'clone'>('preset');

  // Kokoro model state
  const kokoroRef = useRef<any>(null);
  const [kokoroReady, setKokoroReady] = useState(false);
  const [kokoroLoading, setKokoroLoading] = useState(false);
  const [kokoroStatus, setKokoroStatus] = useState('Not loaded');

  // VoxShot (voice cloning) state
  const voxshotRef = useRef<any>(null);
  const [voxshotReady, setVoxshotReady] = useState(false);
  const [voxshotLoading, setVoxshotLoading] = useState(false);
  const [voxshotStatus, setVoxshotStatus] = useState('Not loaded');

  // Shared input
  const [textInput, setTextInput] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<KokoroVoice>('af_heart');
  const [speed, setSpeed] = useState(1.0);

  // Voice cloning
  const [cloneAudio, setCloneAudio] = useState<Blob | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunks = useRef<BlobPart[]>([]);

  // Processing / playback
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [currentBlob, setCurrentBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const previewCacheRef = useRef<Map<string, Blob>>(new Map());
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // History
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // ============================================================================
  // LOAD HISTORY
  // ============================================================================
  useEffect(() => {
    const saved = localStorage.getItem('tts-history');
    if (saved) { try { setHistory(JSON.parse(saved)); } catch {} }
  }, []);

  const saveToHistory = (text: string, voice: string, blob: Blob) => {
    const reader = new FileReader();
    reader.onload = () => {
      const item: HistoryItem = { id: Date.now().toString(), text, voice, audioData: reader.result as string, timestamp: Date.now() };
      setHistory(prev => {
        const updated = [item, ...prev].slice(0, 50);
        localStorage.setItem('tts-history', JSON.stringify(updated));
        return updated;
      });
    };
    reader.readAsDataURL(blob);
  };

  // ============================================================================
  // LOAD KOKORO (lazy, on demand)
  // ============================================================================
  const loadKokoro = async () => {
    if (kokoroRef.current) return true;
    setKokoroLoading(true);
    setKokoroStatus('Downloading model (~80MB)...');
    try {
      const { KokoroTTS } = await import('kokoro-js');
      setKokoroStatus('Initializing WASM engine...');
      const model = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'wasm' });
      kokoroRef.current = model;
      setKokoroReady(true);
      setKokoroStatus('Ready ✓');
      return true;
    } catch (e: any) {
      setKokoroStatus('Failed: ' + (e?.message ?? 'Unknown'));
      return false;
    } finally {
      setKokoroLoading(false);
    }
  };

  // ============================================================================
  // LOAD VOXSHOT (lazy, on demand)
  // ============================================================================
  const loadVoxShot = async () => {
    if (voxshotRef.current) return true;
    setVoxshotLoading(true);
    setVoxshotStatus('Downloading Chatterbox model (~1.5GB)...');
    try {
      const { VoxShot, ChatterboxEngine } = await import('voxshot');
      const engine = new ChatterboxEngine({
        onProgress: (p: any) => {
          if (p.status === 'load-ready') setVoxshotStatus('Ready ✓');
          else if (p.status === 'load-start') setVoxshotStatus(`Loading: ${p.plan}...`);
          else if (p.progress != null) setVoxshotStatus(`Downloading: ${Math.round(p.progress)}%`);
        },
      });
      const tts = await VoxShot.create({ engine });
      voxshotRef.current = tts;
      setVoxshotReady(true);
      setVoxshotStatus('Ready ✓');
      return true;
    } catch (e: any) {
      setVoxshotStatus('Failed: ' + (e?.message ?? 'Unknown'));
      return false;
    } finally {
      setVoxshotLoading(false);
    }
  };

  // ============================================================================
  // PLAY HELPER
  // ============================================================================
  const playBlob = (blob: Blob) => {
    setCurrentBlob(blob);
    const url = URL.createObjectURL(blob);
    if (audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  // ============================================================================
  // GENERATE WITH PRESET VOICE (Kokoro)
  // ============================================================================
  const generatePreset = async () => {
    if (!textInput.trim()) return;
    setIsProcessing(true);
    setStatusMsg('Loading Kokoro model...');
    try {
      const ok = await loadKokoro();
      if (!ok) throw new Error('Could not load Kokoro model');
      setStatusMsg('Generating speech...');
      const audio = await kokoroRef.current.generate(textInput, { voice: selectedVoice });
      const blob = encodeWAV(audio.audio, audio.sampling_rate);
      playBlob(blob);
      saveToHistory(textInput, selectedVoice, blob);
      setStatusMsg('Done ✓');
    } catch (e: any) {
      setStatusMsg('');
      alert(`Error: ${e?.message ?? 'Unknown'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================================================
  // VOICE PREVIEW
  // ============================================================================
  const previewVoice = async (voice: KokoroVoice) => {
    setIsPreviewLoading(true);
    try {
      const ok = await loadKokoro();
      if (!ok) throw new Error('Model unavailable');
      if (previewCacheRef.current.has(voice)) {
        const url = URL.createObjectURL(previewCacheRef.current.get(voice)!);
        if (previewAudioRef.current) { previewAudioRef.current.src = url; previewAudioRef.current.play().catch(() => {}); }
        return;
      }
      const audio = await kokoroRef.current.generate('Hi. This is the voice.', { voice });
      const blob = encodeWAV(audio.audio, audio.sampling_rate);
      previewCacheRef.current.set(voice, blob);
      const url = URL.createObjectURL(blob);
      if (previewAudioRef.current) { previewAudioRef.current.src = url; previewAudioRef.current.play().catch(() => {}); }
    } catch (e: any) {
      alert(`Preview failed: ${e?.message ?? 'Unknown'}`);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // ============================================================================
  // RECORDING
  // ============================================================================
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingChunks.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => recordingChunks.current.push(e.data);
      mr.onstop = () => {
        setCloneAudio(new Blob(recordingChunks.current, { type: 'audio/webm' }));
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setIsRecording(true);
      setTimeout(() => { if (mr.state !== 'inactive') { mr.stop(); setIsRecording(false); } }, 15000);
    } catch { alert('Microphone access denied'); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state !== 'inactive') { mediaRecorderRef.current?.stop(); setIsRecording(false); }
  };

  // ============================================================================
  // GENERATE WITH CLONED VOICE (VoxShot)
  // ============================================================================
  const generateCloned = async () => {
    if (!textInput.trim() || !cloneAudio) return;
    setIsProcessing(true);
    setStatusMsg('Loading VoxShot voice cloning model...');
    try {
      const ok = await loadVoxShot();
      if (!ok) throw new Error('Could not load VoxShot');
      setStatusMsg('Analyzing reference voice...');
      await voxshotRef.current.cloneVoice(cloneAudio);
      setStatusMsg('Generating cloned speech...');
      const audio = await voxshotRef.current.speak(textInput, { speed });
      const blob = audio.toBlob();
      playBlob(blob);
      saveToHistory(textInput, '🎙️ Cloned Voice', blob);
      setStatusMsg('Done ✓');
    } catch (e: any) {
      setStatusMsg('');
      alert(`Voice clone error: ${e?.message ?? 'Unknown'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================================================
  // DOWNLOAD / HISTORY
  // ============================================================================
  const downloadAudio = () => {
    if (!currentBlob) return;
    const a = document.createElement('a'); a.href = URL.createObjectURL(currentBlob); a.download = `tts-${Date.now()}.wav`; a.click();
  };
  const playHistory = (item: HistoryItem) => { if (audioRef.current) { audioRef.current.src = item.audioData; audioRef.current.play(); setIsPlaying(true); } };
  const deleteHistory = (id: string) => { setHistory(p => { const u = p.filter(h => h.id !== id); localStorage.setItem('tts-history', JSON.stringify(u)); return u; }); };

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Free TTS Studio</h1>
              <p className="text-xs text-slate-400">Kokoro + VoxShot • 100% Browser • No API Keys</p>
            </div>
          </div>
          <button onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-700 transition">
            <HistoryIcon className="h-4 w-4" /> History
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3">

          {/* ── LEFT: Main Controls ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Tabs */}
            <div className="flex gap-2 rounded-xl bg-slate-800/60 p-1">
              <button onClick={() => setActiveTab('preset')}
                className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${activeTab === 'preset' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
                🎙️ 29 Preset Voices
              </button>
              <button onClick={() => { setActiveTab('clone'); }}
                className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${activeTab === 'clone' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
                🧬 Clone Any Voice
              </button>
            </div>

            {/* Text Input (shared) */}
            <div className="rounded-xl bg-slate-800/40 p-5 space-y-3">
              <label className="block text-sm font-medium text-slate-200">Your Script</label>
              <textarea value={textInput} onChange={e => setTextInput(e.currentTarget.value)}
                placeholder="Type or paste your script here..."
                className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none resize-none"
                rows={5} />
              <p className="text-xs text-slate-500">{textInput.split(/\s+/).filter(w => w).length} words</p>
            </div>

            {/* ── PRESET VOICES TAB ── */}
            {activeTab === 'preset' && (
              <div className="rounded-xl bg-slate-800/40 p-5 space-y-4">
                <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Music className="h-4 w-4" /> Select Voice
                </h2>

                <select value={selectedVoice} onChange={e => setSelectedVoice(e.currentTarget.value as KokoroVoice)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2.5 text-slate-100 focus:border-blue-500 focus:outline-none">
                  <optgroup label="🇺🇸 American Female (11)">
                    {(['af_heart','af_bella','af_nicole','af_sarah','af_nova','af_alloy','af_aoede','af_jessica','af_kore','af_river','af_sky'] as KokoroVoice[]).map(v => (
                      <option key={v} value={v}>{KOKORO_VOICES[v].label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="🇺🇸 American Male (9)">
                    {(['am_michael','am_liam','am_puck','am_echo','am_adam','am_eric','am_fenrir','am_onyx','am_santa'] as KokoroVoice[]).map(v => (
                      <option key={v} value={v}>{KOKORO_VOICES[v].label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="🇬🇧 British Female (4)">
                    {(['bf_emma','bf_lily','bf_isabella','bf_alice'] as KokoroVoice[]).map(v => (
                      <option key={v} value={v}>{KOKORO_VOICES[v].label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="🇬🇧 British Male (4)">
                    {(['bm_george','bm_fable','bm_lewis','bm_daniel'] as KokoroVoice[]).map(v => (
                      <option key={v} value={v}>{KOKORO_VOICES[v].label}</option>
                    ))}
                  </optgroup>
                </select>

                {/* Voice details */}
                <div className="flex items-center gap-3 rounded-lg bg-slate-900/40 px-4 py-3 text-sm">
                  <span className="text-2xl">{KOKORO_VOICES[selectedVoice].gender === 'Female' ? '👩' : '👨'}</span>
                  <div>
                    <p className="font-semibold text-blue-400">{selectedVoice}</p>
                    <p className="text-slate-400 text-xs">{KOKORO_VOICES[selectedVoice].gender} · {KOKORO_VOICES[selectedVoice].accent} English</p>
                  </div>
                  <button onClick={() => previewVoice(selectedVoice)} disabled={isPreviewLoading}
                    className="ml-auto flex items-center gap-1.5 rounded-lg bg-purple-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-600 disabled:opacity-50 transition">
                    <Volume2 className="h-3.5 w-3.5" />
                    {isPreviewLoading ? 'Loading...' : 'Preview'}
                  </button>
                </div>

                {/* Speed */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Speed: {speed.toFixed(1)}x</label>
                  <input type="range" min="0.5" max="2" step="0.1" value={speed}
                    onChange={e => setSpeed(parseFloat(e.currentTarget.value))}
                    className="w-full accent-blue-500" />
                </div>

                {/* Kokoro status */}
                {kokoroLoading && (
                  <div className="rounded-lg bg-blue-900/30 border border-blue-800 px-4 py-3 text-xs text-blue-200">
                    ⏳ {kokoroStatus}
                  </div>
                )}

                <button onClick={generatePreset} disabled={isProcessing || !textInput.trim()}
                  className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 py-3 font-semibold text-white hover:from-blue-500 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition">
                  {isProcessing && activeTab === 'preset' ? `⏳ ${statusMsg || 'Generating...'}` : '🎤 Generate Speech'}
                </button>

                <audio ref={previewAudioRef} className="hidden" />
              </div>
            )}

            {/* ── VOICE CLONE TAB ── */}
            {activeTab === 'clone' && (
              <div className="rounded-xl bg-slate-800/40 p-5 space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-200">🧬 Voice Cloning</h2>
                  <p className="text-xs text-slate-400 mt-1">Record or upload 5–15 seconds of clean speech to clone that voice.</p>
                </div>

                {/* VoxShot status */}
                <div className="rounded-lg bg-purple-900/30 border border-purple-800 px-4 py-3 text-xs text-purple-200">
                  <p>⚡ Powered by <strong>VoxShot + Chatterbox</strong> (MIT licensed, 100% free)</p>
                  <p className="mt-1">Status: <span className={voxshotReady ? 'text-green-400' : 'text-yellow-400'}>{voxshotStatus}</span></p>
                  {!voxshotReady && !voxshotLoading && (
                    <button onClick={loadVoxShot}
                      className="mt-2 rounded bg-purple-700 px-3 py-1 text-xs font-medium text-white hover:bg-purple-600 transition">
                      Load Voice Cloning Model
                    </button>
                  )}
                </div>

                {/* Record section */}
                <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4 space-y-3">
                  <p className="text-xs font-medium text-slate-300 flex items-center gap-1.5"><Mic className="h-3.5 w-3.5" /> Record Reference Audio</p>
                  {!cloneAudio ? (
                    <div className="flex gap-2">
                      {!isRecording ? (
                        <button onClick={startRecording}
                          className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-500 transition">
                          🔴 Start Recording
                        </button>
                      ) : (
                        <button onClick={stopRecording}
                          className="flex-1 rounded-lg bg-red-700 py-2 text-sm font-medium text-white hover:bg-red-600 transition animate-pulse">
                          ⏹ Stop Recording
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <audio controls src={URL.createObjectURL(cloneAudio)} className="flex-1 h-8 rounded" />
                      <button onClick={() => setCloneAudio(null)} className="rounded-lg bg-slate-700 p-1.5 text-slate-300 hover:bg-slate-600 transition">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Upload section */}
                <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4 space-y-2">
                  <p className="text-xs font-medium text-slate-300 flex items-center gap-1.5"><Upload className="h-3.5 w-3.5" /> Or Upload Audio File</p>
                  <input type="file" accept="audio/*"
                    onChange={e => { const f = e.currentTarget.files?.[0]; if (f) setCloneAudio(f); }}
                    className="w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-purple-600 file:px-3 file:py-1.5 file:text-white file:font-medium hover:file:bg-purple-500 transition" />
                </div>

                {/* Speed */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Speed: {speed.toFixed(1)}x</label>
                  <input type="range" min="0.5" max="2" step="0.1" value={speed}
                    onChange={e => setSpeed(parseFloat(e.currentTarget.value))}
                    className="w-full accent-purple-500" />
                </div>

                {voxshotLoading && (
                  <div className="rounded-lg bg-purple-900/30 border border-purple-800 px-4 py-3 text-xs text-purple-200">
                    ⏳ {voxshotStatus}
                  </div>
                )}

                <button onClick={generateCloned} disabled={isProcessing || !textInput.trim() || !cloneAudio}
                  className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 py-3 font-semibold text-white hover:from-purple-500 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition">
                  {isProcessing && activeTab === 'clone' ? `⏳ ${statusMsg || 'Cloning...'}` : '🧬 Generate with Cloned Voice'}
                </button>

                {!cloneAudio && (
                  <p className="text-xs text-slate-500 text-center">⚠️ Record or upload a reference audio first</p>
                )}
              </div>
            )}
          </div>

          {/* ── RIGHT: Player + History ── */}
          <div className="space-y-5">
            {/* Player */}
            <div className="rounded-xl bg-slate-800/40 p-5 space-y-4">
              <h2 className="text-base font-semibold text-white">Player</h2>
              <audio ref={audioRef}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                controls className="w-full rounded-lg" />
              <div className="flex gap-2">
                <button
                  onClick={() => { if (audioRef.current) { isPlaying ? audioRef.current.pause() : audioRef.current.play(); } }}
                  disabled={!currentBlob}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition">
                  {isPlaying ? <><Pause className="h-4 w-4" /> Pause</> : <><Play className="h-4 w-4" /> Play</>}
                </button>
                <button onClick={downloadAudio} disabled={!currentBlob}
                  className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-500 disabled:opacity-50 transition">
                  <Download className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Model status */}
            <div className="rounded-xl bg-slate-800/40 p-4 text-xs space-y-1.5">
              <p className="font-medium text-slate-300">Model Status</p>
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${kokoroReady ? 'bg-green-500' : 'bg-yellow-500'}`} />
                <span className="text-slate-400">Kokoro (preset voices): <span className={kokoroReady ? 'text-green-400' : 'text-yellow-400'}>{kokoroReady ? 'Ready' : 'Not loaded'}</span></span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${voxshotReady ? 'bg-green-500' : 'bg-yellow-500'}`} />
                <span className="text-slate-400">VoxShot (voice clone): <span className={voxshotReady ? 'text-green-400' : 'text-yellow-400'}>{voxshotReady ? 'Ready' : 'Not loaded'}</span></span>
              </div>
              <p className="text-slate-500 pt-1">Models load on first use and are cached locally.</p>
            </div>

            {/* History */}
            {showHistory && (
              <div className="rounded-xl bg-slate-800/40 p-5 max-h-96 overflow-y-auto space-y-3">
                <h2 className="text-base font-semibold text-white">History</h2>
                {history.length === 0 ? (
                  <p className="text-xs text-slate-400">No generations yet.</p>
                ) : (
                  history.map(item => (
                    <div key={item.id} className="rounded-lg border border-slate-700 bg-slate-900/50 p-3 space-y-2">
                      <p className="truncate text-xs text-slate-200">{item.text}</p>
                      <p className="text-xs text-slate-500">{item.voice} · {new Date(item.timestamp).toLocaleTimeString()}</p>
                      <div className="flex gap-2">
                        <button onClick={() => playHistory(item)} className="flex-1 rounded bg-blue-700 py-1 text-xs text-white hover:bg-blue-600 transition">Play</button>
                        <button onClick={() => { const a = document.createElement('a'); a.href = item.audioData; a.download = `tts-${item.id}.wav`; a.click(); }}
                          className="flex-1 rounded bg-green-700 py-1 text-xs text-white hover:bg-green-600 transition">Download</button>
                        <button onClick={() => deleteHistory(item.id)} className="rounded bg-red-700 px-2 py-1 text-xs text-white hover:bg-red-600 transition"><X className="h-3 w-3" /></button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-800 py-5 text-center text-xs text-slate-500">
        Kokoro TTS (82M, Apache 2.0) + VoxShot/Chatterbox (MIT) • 100% in browser • Completely free forever
      </footer>
    </div>
  );
}
