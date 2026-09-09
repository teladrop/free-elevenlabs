'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  Download,
  Volume2,
  Zap,
  Music,
  History as HistoryIcon,
  X,
} from 'lucide-react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface HistoryItem {
  id: string;
  text: string;
  voice: string;
  audioData: string; // base64
  timestamp: number;
}

const KOKORO_VOICES = {
  'af_heart': { label: '❤️ af_heart - Female', gender: 'Female', accent: 'American' },
  'af_bella': { label: '🔥 af_bella - Female', gender: 'Female', accent: 'American' },
  'af_nicole': { label: '🎧 af_nicole - Female', gender: 'Female', accent: 'American' },
  'af_sarah': { label: '✨ af_sarah - Female', gender: 'Female', accent: 'American' },
  'af_nova': { label: '⭐ af_nova - Female', gender: 'Female', accent: 'American' },
  'am_michael': { label: '🎙️ am_michael - Male', gender: 'Male', accent: 'American' },
  'am_liam': { label: '💼 am_liam - Male', gender: 'Male', accent: 'American' },
  'am_puck': { label: '⚡ am_puck - Male', gender: 'Male', accent: 'American' },
  'am_echo': { label: '🔊 am_echo - Male', gender: 'Male', accent: 'American' },
  'bf_emma': { label: '🇬🇧 bf_emma - Female', gender: 'Female', accent: 'British' },
  'bf_lily': { label: '🌸 bf_lily - Female', gender: 'Female', accent: 'British' },
  'bf_isabella': { label: '👑 bf_isabella - Female', gender: 'Female', accent: 'British' },
  'bm_george': { label: '🎩 bm_george - Male', gender: 'Male', accent: 'British' },
  'bm_fable': { label: '📖 bm_fable - Male', gender: 'Male', accent: 'British' },
  'bm_lewis': { label: '🧭 bm_lewis - Male', gender: 'Male', accent: 'British' },
} as const;

type KokoroVoice = keyof typeof KOKORO_VOICES;

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function Home() {
  // Model state
  const [ttsModel, setTtsModel] = useState<any>(null);
  const [modelLoading, setModelLoading] = useState(true);
  const [modelProgress, setModelProgress] = useState(0);
  const modelRef = useRef<any>(null);

  // TTS parameters
  const [textInput, setTextInput] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<KokoroVoice>('af_heart');
  const [speed, setSpeed] = useState(1);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentAudioBlob, setCurrentAudioBlob] = useState<Blob | null>(null);

  // Playback state
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // History
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Voice preview state
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement>(null);

  // ============================================================================
  // INITIALIZATION: Load Kokoro model on mount
  // ============================================================================

  useEffect(() => {
    const loadModel = async () => {
      try {
        setModelProgress(10);
        console.log('🎵 Loading Kokoro TTS model...');

        // Dynamic import to avoid SSR issues
        const { KokoroTTS } = await import('kokoro-js');

        setModelProgress(30);
        console.log('📦 Initializing KokoroTTS with WASM backend...');

        const model = await KokoroTTS.from_pretrained(
          'onnx-community/Kokoro-82M-v1.0-ONNX',
          {
            dtype: 'q8', // Quantized for smaller size
            device: 'wasm', // Browser WASM - completely free, no server
          }
        );

        setModelProgress(90);
        console.log('✅ Kokoro model loaded successfully!');
        console.log('🎙️ Available voices:', model.list_voices ? model.list_voices() : 'Multiple');

        modelRef.current = model;
        setTtsModel(model);
        setModelProgress(100);
      } catch (error) {
        console.error('❌ Failed to load Kokoro model:', error);
        alert(
          'Failed to load Kokoro TTS. This usually means:\n\n' +
          '1. Your browser doesn\'t support WebAssembly (WASM)\n' +
          '2. Not enough memory - close other browser tabs\n' +
          '3. Try Chrome/Edge instead\n\n' +
          'Check console (F12) for details.'
        );
      } finally {
        setModelLoading(false);
      }
    };

    loadModel();
  }, []);

  // ============================================================================
  // LOAD HISTORY FROM LOCALSTORAGE
  // ============================================================================

  useEffect(() => {
    const saved = localStorage.getItem('tts-history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse history:', e);
      }
    }
  }, []);

  // ============================================================================
  // SAVE HISTORY TO LOCALSTORAGE
  // ============================================================================

  const saveToHistory = (text: string, voice: string, audioBlob: Blob) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        text,
        voice,
        audioData: base64,
        timestamp: Date.now(),
      };
      const updated = [newItem, ...history].slice(0, 50); // Keep last 50
      setHistory(updated);
      localStorage.setItem('tts-history', JSON.stringify(updated));
    };
    reader.readAsDataURL(audioBlob);
  };

  // ============================================================================
  // TEXT-TO-SPEECH GENERATION (100% CLIENT-SIDE KOKORO)
  // ============================================================================

  const generateSpeech = async () => {
    if (!textInput.trim()) return;
    if (!modelRef.current) {
      alert('Model not loaded yet. Please wait...');
      return;
    }

    // Enforce word limit
    const wordCount = textInput.split(/\s+/).filter((w) => w).length;
    if (wordCount > 2000) {
      alert('Text exceeds 2,000 word limit for browser processing. Please reduce.');
      return;
    }

    setIsProcessing(true);

    try {
      console.log(`📝 Generating speech with voice: ${selectedVoice}`);
      console.log(`📊 Text length: ${textInput.length} chars, ${wordCount} words`);

      // Generate audio using Kokoro (100% in browser via WASM)
      const audio = await modelRef.current.generate(textInput, {
        voice: selectedVoice,
      });

      console.log(`✅ Audio generated: ${audio.audio.length} samples @ ${audio.sampling_rate} Hz`);

      // Convert Float32Array to WAV Blob
      const wavBlob = encodeWAV(audio.audio, audio.sampling_rate);
      setCurrentAudioBlob(wavBlob);

      // Play audio
      const url = URL.createObjectURL(wavBlob);
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
        setIsPlaying(true);
      }

      // Save to history
      saveToHistory(textInput, selectedVoice, wavBlob);
      console.log('💾 Saved to history');
    } catch (error) {
      console.error('❌ Speech generation failed:', error);
      alert(
        `Failed to generate speech:\n\n${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
        'Try reducing text length or closing other browser tabs.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================================================
  // VOICE PREVIEW / TESTING
  // ============================================================================

  const previewVoiceSample = async (voice: KokoroVoice) => {
    if (!modelRef.current) {
      alert('Model not loaded yet. Please wait...');
      return;
    }

    setIsPreviewLoading(true);
    console.log(`🔊 Previewing voice: ${voice}`);

    try {
      const sampleText = 'Hello. This is a voice preview. Listen to how this voice sounds.';

      // Generate preview audio
      const audio = await modelRef.current.generate(sampleText, {
        voice,
      });

      // Convert to WAV
      const wavBlob = encodeWAV(audio.audio, audio.sampling_rate);
      const url = URL.createObjectURL(wavBlob);

      if (previewAudioRef.current) {
        previewAudioRef.current.src = url;
        console.log('🎵 Playing preview...');
        await previewAudioRef.current.play();
        console.log('✅ Preview playing!');
      }
    } catch (error) {
      console.error('❌ Voice preview failed:', error);
      alert('Failed to generate preview. Check console for details.');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // ============================================================================
  // WAV ENCODING UTILITY
  // ============================================================================

  function encodeWAV(audioData: Float32Array, sampleRate: number): Blob {
    const numChannels = 1;
    const length = audioData.length;
    const bytesPerSample = 2;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = length * bytesPerSample;

    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    // Convert Float32 to Int16
    let offset = 44;
    for (let i = 0; i < audioData.length; i++) {
      const s = Math.max(-1, Math.min(1, audioData[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  // ============================================================================
  // DOWNLOAD AUDIO
  // ============================================================================

  const downloadAudio = () => {
    if (!currentAudioBlob) return;
    const url = URL.createObjectURL(currentAudioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tts-${Date.now()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ============================================================================
  // HISTORY MANAGEMENT
  // ============================================================================

  const playFromHistory = (item: HistoryItem) => {
    if (audioRef.current) {
      audioRef.current.src = item.audioData;
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const downloadFromHistory = (item: HistoryItem) => {
    const a = document.createElement('a');
    a.href = item.audioData;
    a.download = `tts-${item.id}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const deleteFromHistory = (id: string) => {
    const updated = history.filter((h) => h.id !== id);
    setHistory(updated);
    localStorage.setItem('tts-history', JSON.stringify(updated));
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">Kokoro TTS</h1>
              <span className="text-xs text-slate-400 ml-2">100% Browser • Completely Free</span>
            </div>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-700"
            >
              <HistoryIcon className="h-4 w-4" />
              History
            </button>
          </div>
        </div>
      </header>

      {/* Model Loading Status */}
      {modelLoading && (
        <div className="border-b border-slate-800 bg-slate-900/80 px-4 py-4">
          <div className="mx-auto max-w-6xl">
            <p className="mb-2 text-sm text-slate-300">
              Loading Kokoro TTS model... ({modelProgress}%)
            </p>
            <div className="h-2 w-full rounded-full bg-slate-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all"
                style={{ width: `${modelProgress}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-400">
              ℹ️ First load downloads ~500MB model. Takes 30-60 seconds on first run. Browser will cache it locally.
            </p>
          </div>
        </div>
      )}

      {/* Model Ready Status */}
      {!modelLoading && ttsModel && (
        <div className="border-b border-slate-800 bg-slate-900/50 px-4 py-2">
          <div className="mx-auto max-w-6xl text-xs text-slate-400">
            ✓ Model ready • 🧠 Running 100% in your browser (WASM) • 🔒 No data sent to any server
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left Panel: Controls */}
          <div className="lg:col-span-2">
            <div className="space-y-6 rounded-lg bg-slate-800/30 p-6 backdrop-blur">
              {/* Text Input */}
              <div>
                <label className="block text-sm font-medium text-slate-200">
                  Your Script (up to 2,000 words)
                </label>
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.currentTarget.value)}
                  placeholder="Paste your script here. Kokoro will generate natural speech with emotion and pacing."
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  rows={6}
                />
                <div className="mt-2 text-xs text-slate-400">
                  {textInput.split(/\s+/).filter((w) => w).length} words
                  {textInput.split(/\s+/).filter((w) => w).length > 2000 && (
                    <span className="ml-2 text-red-400">⚠️ Exceeds 2k limit</span>
                  )}
                </div>
              </div>

              {/* Voice Selection with Preview */}
              <div>
                <label className="block text-sm font-medium text-slate-200">
                  <Music className="mb-1 inline h-4 w-4" /> Select Voice (Click 🔊 to preview)
                </label>
                <div className="mt-2 space-y-2">
                  <select
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.currentTarget.value as KokoroVoice)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2 text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <optgroup label="American Female">
                      <option value="af_heart">{KOKORO_VOICES.af_heart.label}</option>
                      <option value="af_bella">{KOKORO_VOICES.af_bella.label}</option>
                      <option value="af_nicole">{KOKORO_VOICES.af_nicole.label}</option>
                      <option value="af_sarah">{KOKORO_VOICES.af_sarah.label}</option>
                      <option value="af_nova">{KOKORO_VOICES.af_nova.label}</option>
                    </optgroup>
                    <optgroup label="American Male">
                      <option value="am_michael">{KOKORO_VOICES.am_michael.label}</option>
                      <option value="am_liam">{KOKORO_VOICES.am_liam.label}</option>
                      <option value="am_puck">{KOKORO_VOICES.am_puck.label}</option>
                      <option value="am_echo">{KOKORO_VOICES.am_echo.label}</option>
                    </optgroup>
                    <optgroup label="British Female">
                      <option value="bf_emma">{KOKORO_VOICES.bf_emma.label}</option>
                      <option value="bf_lily">{KOKORO_VOICES.bf_lily.label}</option>
                      <option value="bf_isabella">{KOKORO_VOICES.bf_isabella.label}</option>
                    </optgroup>
                    <optgroup label="British Male">
                      <option value="bm_george">{KOKORO_VOICES.bm_george.label}</option>
                      <option value="bm_fable">{KOKORO_VOICES.bm_fable.label}</option>
                      <option value="bm_lewis">{KOKORO_VOICES.bm_lewis.label}</option>
                    </optgroup>
                  </select>

                  {/* Voice Preview Button */}
                  <button
                    onClick={() => previewVoiceSample(selectedVoice)}
                    disabled={isPreviewLoading || modelLoading}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Volume2 className="h-4 w-4" />
                    {isPreviewLoading ? '⏳ Previewing...' : '🔊 Preview Voice'}
                  </button>

                  {/* Hidden preview audio element */}
                  <audio ref={previewAudioRef} className="hidden" />
                </div>
              </div>

              {/* Speed Slider */}
              <div>
                <label className="block text-sm font-medium text-slate-200">
                  Speed: {speed.toFixed(1)}x
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.currentTarget.value))}
                  className="mt-2 w-full"
                />
                <p className="mt-1 text-xs text-slate-400">0.5x to 2.0x</p>
              </div>

              {/* Info Box */}
              <div className="rounded-lg bg-blue-900/20 border border-blue-800 p-3">
                <p className="text-xs text-blue-200">
                  ⚡ <strong>100% Browser-based:</strong> Kokoro TTS runs entirely in your browser via WASM
                </p>
                <p className="text-xs text-blue-200 mt-1">
                  🔒 No data sent to servers • 🎙️ Real male + female voices • ⏱️ Typical time: 5-15sec per generation
                </p>
              </div>

              {/* Generate Button */}
              <button
                onClick={generateSpeech}
                disabled={isProcessing || modelLoading || !textInput.trim()}
                className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 font-semibold text-white transition hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? '⏳ Generating...' : '🎤 Generate Speech'}
              </button>
            </div>
          </div>

          {/* Right Panel: Audio Player & History */}
          <div className="space-y-6">
            {/* Voice Info Panel */}
            <div className="rounded-lg bg-slate-800/30 p-6 backdrop-blur">
              <h2 className="mb-4 text-lg font-semibold text-white">Voice Details</h2>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-slate-400">Selected Voice:</p>
                  <p className="text-lg font-bold text-blue-400">{selectedVoice}</p>
                </div>

                <div>
                  <p className="text-slate-400">Gender:</p>
                  <p className="text-slate-200">
                    {KOKORO_VOICES[selectedVoice].gender === 'Female' ? '👩' : '👨'} {KOKORO_VOICES[selectedVoice].gender}
                  </p>
                </div>

                <div>
                  <p className="text-slate-400">Accent:</p>
                  <p className="text-slate-200">{KOKORO_VOICES[selectedVoice].accent} English</p>
                </div>

                <div className="pt-3 border-t border-slate-700">
                  <p className="text-slate-400 text-xs">
                    💡 <strong>Tip:</strong> Click "Preview Voice" to hear a sample before generating your full text.
                  </p>
                </div>
              </div>
            </div>

            {/* Player */}
            <div className="rounded-lg bg-slate-800/30 p-6 backdrop-blur">
              <h2 className="mb-4 text-lg font-semibold text-white">Player</h2>
              <audio
                ref={audioRef}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                className="mb-4 w-full rounded-lg"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (audioRef.current) {
                      if (isPlaying) audioRef.current.pause();
                      else audioRef.current.play();
                    }
                  }}
                  disabled={!currentAudioBlob && audioRef.current?.src === ''}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="h-4 w-4" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" /> Play
                    </>
                  )}
                </button>
                <button
                  onClick={downloadAudio}
                  disabled={!currentAudioBlob}
                  className="flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* History Panel */}
            {showHistory && (
              <div className="rounded-lg bg-slate-800/30 p-6 backdrop-blur max-h-96 overflow-y-auto">
                <h2 className="mb-4 text-lg font-semibold text-white">Generation History</h2>
                {history.length === 0 ? (
                  <p className="text-sm text-slate-400">No generations yet.</p>
                ) : (
                  <div className="space-y-3">
                    {history.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-slate-700 bg-slate-900/50 p-3"
                      >
                        <p className="truncate text-sm text-slate-200">{item.text}</p>
                        <p className="text-xs text-slate-400">{item.voice}</p>
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => playFromHistory(item)}
                            className="flex-1 rounded px-2 py-1 text-xs bg-blue-600 text-white hover:bg-blue-700"
                          >
                            Play
                          </button>
                          <button
                            onClick={() => downloadFromHistory(item)}
                            className="flex-1 rounded px-2 py-1 text-xs bg-green-600 text-white hover:bg-green-700"
                          >
                            Download
                          </button>
                          <button
                            onClick={() => deleteFromHistory(item.id)}
                            className="rounded px-2 py-1 text-xs bg-red-600 text-white hover:bg-red-700"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/50 px-4 py-6 text-center text-sm text-slate-400">
        <p>Powered by Kokoro TTS (82M parameters) • 100% runs in your browser • Completely free forever</p>
      </footer>
    </div>
  );
}
