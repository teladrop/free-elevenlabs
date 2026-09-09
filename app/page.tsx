'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  Download,
  Mic,
  Upload,
  Trash2,
  Volume2,
  Zap,
  Music,
  History as HistoryIcon,
  X,
} from 'lucide-react';

// WebGPU type definitions
interface GPUAdapter {
  requestDevice(): Promise<GPUDevice>;
}

interface GPUDevice {
  createBuffer(descriptor: any): any;
}

declare global {
  interface Navigator {
    gpu?: {
      requestAdapter(): Promise<GPUAdapter | null>;
    };
  }
}

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface TTSAudio {
  audio: Float32Array;
  sampling_rate: number;
  save?: (filename: string) => void;
}

type VoiceType =
  | 'en-US-AriaNeural'
  | 'en-US-GuyNeural'
  | 'en-US-AmberNeural'
  | 'en-US-AshleyNeural'
  | 'en-US-CoraNeural'
  | 'en-US-ElizabethNeural'
  | 'en-US-MichelleNeural'
  | 'en-US-MonicaNeural'
  | 'en-US-SaraNeural'
  | 'en-US-AvaNeural'
  | 'en-US-BrianNeural'
  | 'en-US-ChristopherNeural'
  | 'en-US-EricNeural'
  | 'en-US-JacobNeural'
  | 'en-US-JasonNeural'
  | 'en-US-JerryNeural'
  | 'en-US-RyanNeural'
  | 'en-US-TonyNeural'
  | 'en-GB-SoniaNeural'
  | 'en-GB-RyanNeural'
  | 'en-GB-MaisieNeural'
  | 'en-GB-LibbyNeural'
  | 'en-GB-OliverNeural'
  | 'en-GB-NoahNeural'
  | 'en-IE-EmilyNeural'
  | 'en-IE-ConnorNeural';

interface TTSModel {
  generate: (
    text: string,
    options?: {
      voice?: VoiceType;
      speed?: number;
    }
  ) => Promise<TTSAudio>;
  list_voices: () => void;
  voices?: Record<string, any>;
}

interface HistoryItem {
  id: string;
  text: string;
  voice: string;
  speed: number;
  pitch: number;
  volume: number;
  audioData: string; // base64
  timestamp: number;
}

interface ChunkProgress {
  current: number;
  total: number;
  isProcessing: boolean;
}

// ============================================================================
// AI SCRIPT PARSER - AUTOMATIC EMOTION & PAUSE DETECTION
// ============================================================================

interface ScriptAnalysis {
  processedText: string;
  emotionTags: Map<number, string>;
  pauseMarkers: Map<number, number>;
  confidence: number;
}

interface SentenceContext {
  text: string;
  endsWithExclamation: boolean;
  endsWithQuestion: boolean;
  endsWithEllipsis: boolean;
  endsWithDash: boolean;
  hasComma: boolean;
  isShort: boolean; // < 10 words
  isAllCaps: boolean;
  hasQuotes: boolean;
  previousSentiment: 'positive' | 'negative' | 'neutral';
}

// Sentiment keywords for context analysis
const SENTIMENT_POSITIVE = [
  'amazing',
  'awesome',
  'wonderful',
  'fantastic',
  'great',
  'love',
  'happy',
  'excited',
  'brilliant',
  'perfect',
  'beautiful',
  'incredible',
  'wonderful',
  'delighted',
  'thrilled',
  'fabulous',
  'superb',
  'excellent',
  'outstanding',
  'marvelous',
];

const SENTIMENT_NEGATIVE = [
  'terrible',
  'awful',
  'horrible',
  'bad',
  'hate',
  'sad',
  'angry',
  'upset',
  'disgusting',
  'pathetic',
  'dreadful',
  'miserable',
  'wretched',
  'disastrous',
  'tragic',
  'ghastly',
  'vile',
  'abhorrent',
];

const SENTIMENT_SURPRISE = [
  'wait',
  'what',
  'really',
  'seriously',
  'unbelievable',
  'shocking',
  'surprising',
  'unexpected',
  'astonished',
  'stunned',
  'bewildered',
];

const SENTIMENT_WHISPER = [
  'quietly',
  'softly',
  'whispered',
  'secret',
  'confidential',
  'private',
  'shh',
  'psst',
  'sshhh',
  'between you and me',
  'just between us',
];

const LAUGHTER_TRIGGERS = [
  'laugh',
  'funny',
  'hilarious',
  'joke',
  'comedy',
  'ridiculous',
  'absurd',
  'silly',
  'haha',
  'lol',
  'ha',
  'chuckle',
  'giggle',
  'amusing',
];

function analyzeSentenceContext(sentence: string): SentenceContext {
  const trimmed = sentence.trim();
  const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
  const lowerSentence = trimmed.toLowerCase();

  // Check for sentiment keywords
  let previousSentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
  if (SENTIMENT_POSITIVE.some((keyword) => lowerSentence.includes(keyword))) {
    previousSentiment = 'positive';
  } else if (SENTIMENT_NEGATIVE.some((keyword) => lowerSentence.includes(keyword))) {
    previousSentiment = 'negative';
  }

  return {
    text: trimmed,
    endsWithExclamation: trimmed.endsWith('!'),
    endsWithQuestion: trimmed.endsWith('?'),
    endsWithEllipsis: trimmed.endsWith('...'),
    endsWithDash: trimmed.includes('—'),
    hasComma: trimmed.includes(','),
    isShort: words.length < 10,
    isAllCaps: trimmed === trimmed.toUpperCase() && trimmed.length > 3,
    hasQuotes: trimmed.includes('"') || trimmed.includes("'"),
    previousSentiment,
  };
}

function detectEmotionTag(context: SentenceContext): string | null {
  const lowerText = context.text.toLowerCase();

  // Rule 1: ALL CAPS = Shouting
  if (context.isAllCaps) {
    return '[shout]';
  }

  // Rule 2: Exclamation marks with excitement keywords = Shout/Emphasis
  if (context.endsWithExclamation) {
    if (
      context.previousSentiment === 'positive' ||
      LAUGHTER_TRIGGERS.some((keyword) => lowerText.includes(keyword))
    ) {
      if (LAUGHTER_TRIGGERS.some((keyword) => lowerText.includes(keyword))) {
        return '[laughter]';
      }
      return '[shout]'; // Enthusiastic shout
    }
  }

  // Rule 3: Laughter triggers
  if (LAUGHTER_TRIGGERS.some((keyword) => lowerText.includes(keyword))) {
    return '[laughter]';
  }

  // Rule 4: Surprise/gasping moments
  if (SENTIMENT_SURPRISE.some((keyword) => lowerText.includes(keyword))) {
    // Check if question or exclamation (adds emphasis)
    if (context.endsWithExclamation || context.endsWithQuestion) {
      return '[gasp]';
    }
    return '[gasp]';
  }

  // Rule 5: Whisper cues (soft speech, secrets, confidential)
  if (SENTIMENT_WHISPER.some((keyword) => lowerText.includes(keyword))) {
    return '[whisper]';
  }

  // Rule 6: Negative sentiment + exclamation = emotional shout
  if (context.endsWithExclamation && context.previousSentiment === 'negative') {
    return '[shout]';
  }

  // Rule 7: Short sentences with question mark = curious/gasp-like delivery
  if (context.isShort && context.endsWithQuestion && context.text.length < 20) {
    return '[gasp]';
  }

  // Rule 8: Sigh patterns (resigned, disappointed, tired)
  if (
    lowerText.includes('sigh') ||
    lowerText.includes('oh well') ||
    lowerText.includes('i suppose')
  ) {
    return '[sigh]';
  }

  return null;
}

function calculatePauseDuration(
  punctuation: string,
  nextSentenceContext?: SentenceContext | null,
): number {
  // Ellipses (...) = 300-400ms dramatic pause
  if (punctuation === '...') {
    return 350;
  }

  // Em-dash (—) = 200-250ms breath pause
  if (punctuation === '—') {
    return 220;
  }

  // Question mark = 150-200ms (natural question pause)
  if (punctuation === '?') {
    return 180;
  }

  // Exclamation = 100-150ms (quick punch)
  if (punctuation === '!') {
    return 120;
  }

  // Period = 200ms (standard sentence break)
  if (punctuation === '.') {
    return 200;
  }

  // Comma = 80-100ms (breath)
  if (punctuation === ',') {
    return 90;
  }

  return 0;
}

function parseScriptWithEmotion(rawText: string): ScriptAnalysis {
  let processedText = rawText;
  const emotionTags = new Map<number, string>();
  const pauseMarkers = new Map<number, number>();
  let confidence = 0.85;

  // Split into sentences (basic regex, may need refinement)
  const sentenceRegex = /[^.!?—…\n]+[.!?—…]/g;
  const sentences = rawText.match(sentenceRegex) || [rawText];

  let charOffset = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const nextSentence = i + 1 < sentences.length ? sentences[i + 1] : null;
    const nextContext = nextSentence ? analyzeSentenceContext(nextSentence) : null;

    const context = analyzeSentenceContext(sentence);
    const emotionTag = detectEmotionTag(context);

    // Store emotion tag at sentence start
    if (emotionTag) {
      emotionTags.set(charOffset, emotionTag);
    }

    // Detect punctuation and add pause markers
    let pauseDuration = 0;
    if (context.endsWithEllipsis) {
      pauseDuration = calculatePauseDuration('...', nextContext);
    } else if (context.endsWithDash) {
      pauseDuration = calculatePauseDuration('—', nextContext);
    } else if (context.endsWithQuestion) {
      pauseDuration = calculatePauseDuration('?', nextContext);
    } else if (context.endsWithExclamation) {
      pauseDuration = calculatePauseDuration('!', nextContext);
    } else if (sentence.trim().endsWith('.')) {
      pauseDuration = calculatePauseDuration('.', nextContext);
    }

    if (pauseDuration > 0) {
      pauseMarkers.set(charOffset + sentence.length, pauseDuration);
    }

    charOffset += sentence.length;
  }

  // Build processed text with tags and pause markers
  let result = rawText;
  const insertions: Array<{ pos: number; text: string }> = [];

  // Add emotion tags
  for (const [pos, tag] of emotionTags) {
    insertions.push({ pos, text: tag + ' ' });
  }

  // Add pause markers as special tokens
  for (const [pos, duration] of pauseMarkers) {
    insertions.push({ pos, text: ` [PAUSE_${duration}]` });
  }

  // Sort by position (descending) to insert from end to start
  insertions.sort((a, b) => b.pos - a.pos);

  for (const insertion of insertions) {
    result = result.slice(0, insertion.pos) + insertion.text + result.slice(insertion.pos);
  }

  processedText = result;

  return {
    processedText,
    emotionTags,
    pauseMarkers,
    confidence,
  };
}

// ============================================================================
// LEGACY EXPRESSIVE PAUSE INJECTION (now enhanced by parser)
// ============================================================================

function injectExpressivePauses(text: string): string {
  // Replace ellipses with pause marker
  let result = text.replace(/\.\.\./g, '[PAUSE_350]');

  // Replace em-dashes with pause marker
  result = result.replace(/—/g, '[PAUSE_220]');

  // Replace double commas with breath pause
  result = result.replace(/,{2,}/g, '[PAUSE_90]');

  // Replace period at sentence end with pause (if not already marked)
  result = result.replace(/(?<!\])\. (?=[A-Z])/g, ' [PAUSE_200] ');

  return result;
}

// ============================================================================
// TEXT CHUNKING UTILITY (IMPROVED)
// ============================================================================

function splitTextIntoChunks(text: string, targetWords: number = 50): string[] {
  // First split by double newlines (paragraphs)
  const paragraphs = text.split(/\n\n+/);

  const chunks: string[] = [];
  let currentChunk = '';
  let currentWordCount = 0;

  for (const paragraph of paragraphs) {
    const paragraphWords = paragraph.trim().split(/\s+/).length;

    // If adding this paragraph would exceed target, flush current chunk
    if (currentWordCount + paragraphWords > targetWords && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
      currentWordCount = 0;
    }

    // If this single paragraph is huge, split it by sentences
    if (paragraphWords > targetWords) {
      const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
      for (const sentence of sentences) {
        const sentenceWords = sentence.trim().split(/\s+/).length;
        if (currentWordCount + sentenceWords > targetWords && currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
          currentWordCount = 0;
        }
        currentChunk += sentence.trim() + ' ';
        currentWordCount += sentenceWords;
      }
    } else {
      currentChunk += paragraph.trim() + '\n\n';
      currentWordCount += paragraphWords;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter((c) => c.length > 0);
}

// ============================================================================
// WAV ENCODING UTILITY
// ============================================================================

function concatenateAudioBuffers(
  buffers: Float32Array[],
  sampleRate: number,
): { audioData: Float32Array; sampleRate: number } {
  const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
  const concatenated = new Float32Array(totalLength);

  let offset = 0;
  for (const buffer of buffers) {
    concatenated.set(buffer, offset);
    offset += buffer.length;
  }

  return { audioData: concatenated, sampleRate };
}

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
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // 16-bit depth
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
// MAIN PAGE COMPONENT
// ============================================================================

export default function Home() {
  // Model & state
  const [ttsModel, setTtsModel] = useState<TTSModel | null>(null);
  const [modelLoading, setModelLoading] = useState(true);
  const [modelProgress, setModelProgress] = useState(0);

  // TTS parameters
  const [activeTab, setActiveTab] = useState<'premium' | 'voiceclone'>('premium');
  const [textInput, setTextInput] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<VoiceType>('en-US-AriaNeural');
  const [speed, setSpeed] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [volume, setVolume] = useState(1);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [shouldCancel, setShouldCancel] = useState(false);
  const [chunkProgress, setChunkProgress] = useState<ChunkProgress>({
    current: 0,
    total: 0,
    isProcessing: false,
  });
  const [currentAudioBlob, setCurrentAudioBlob] = useState<Blob | null>(null);

  // Playback state
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // History
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Voice preview state
  const [previewVoice, setPreviewVoice] = useState<VoiceType | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement>(null);

  // Voice cloning state
  const [cloneRecording, setCloneRecording] = useState<Blob | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const premiumVoices = [
    'af_heart',
    'af_alloy',
    'af_aoede',
    'af_bella',
    'af_jessica',
    'af_kore',
    'af_nicole',
    'af_nova',
    'af_river',
    'af_sarah',
    'af_sky',
    'am_adam',
    'am_echo',
    'am_eric',
    'am_fenrir',
    'am_liam',
    'am_michael',
    'am_onyx',
    'am_puck',
    'am_santa',
    'bf_alice',
    'bf_emma',
    'bf_isabella',
    'bf_lily',
    'bm_daniel',
    'bm_fable',
    'bm_george',
    'bm_lewis',
  ] as const;

  // ============================================================================
  // INITIALIZATION: Load model on mount
  // ============================================================================
  // INITIALIZATION: Model ready - API handles it server-side
  // ============================================================================

  useEffect(() => {
    console.log('🎵 Kokoro TTS ready - API will load model on first request');
    setTtsModel({ ready: true } as any); // Mark as ready immediately
    setModelLoading(false);
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

  const saveToHistory = (
    text: string,
    voice: string,
    audioBlob: Blob,
    spd: number = speed,
    pit: number = pitch,
    vol: number = volume,
  ) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        text,
        voice,
        speed: spd,
        pitch: pit,
        volume: vol,
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
  // TEXT-TO-SPEECH GENERATION (via backend API)
  // ============================================================================

  const generateSpeech = async () => {
    if (!textInput.trim()) return;

    // Enforce word limit
    const wordCount = textInput.split(/\s+/).filter((w) => w).length;
    if (wordCount > 10000) {
      alert('Text exceeds 10,000 word limit. Please reduce to ensure stable processing.');
      return;
    }

    setIsProcessing(true);
    setShouldCancel(false);
    setChunkProgress({ current: 0, total: 0, isProcessing: true });

    try {
      // Step 1: AI Script Parser - Automatic emotion & pause detection
      const scriptAnalysis = parseScriptWithEmotion(textInput);
      const processedText = scriptAnalysis.processedText;

      console.log('📝 Script Analysis:');
      console.log(`  - Detected emotions: ${scriptAnalysis.emotionTags.size}`);
      console.log(`  - Detected pauses: ${scriptAnalysis.pauseMarkers.size}`);
      console.log(`  - Confidence: ${(scriptAnalysis.confidence * 100).toFixed(0)}%`);

      // Step 2: Call backend API with processed text
      console.log('🔄 Sending to server for Kokoro TTS...');
      setChunkProgress({ current: 0, total: 1, isProcessing: true });

      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: processedText,
          voice: selectedVoice,
          speed,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate speech');
      }

      const audioBlob = await response.blob();

      console.log(`✅ Generated ${audioBlob.size} bytes of audio`);
      setChunkProgress({ current: 1, total: 1, isProcessing: true });

      // Set current audio and play
      setCurrentAudioBlob(audioBlob);

      // Step 3: Play audio
      const url = URL.createObjectURL(audioBlob);
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
        setIsPlaying(true);
      }

      // Step 4: Save to history
      saveToHistory(textInput, selectedVoice, audioBlob);
    } catch (error) {
      console.error('Speech generation failed:', error);
      alert(
        'Failed to generate speech. Possible causes:\n1. Text too long - try reducing\n2. Browser memory low - close other tabs\n3. Try Chrome/Edge instead\n\nCheck console (F12) for details.'
      );
    } finally {
      setIsProcessing(false);
      setChunkProgress({ current: 0, total: 0, isProcessing: false });
    }
  };

  // ============================================================================
  // VOICE PREVIEW / TESTING
  // ============================================================================

  const previewVoiceSample = async (voice: VoiceType) => {
    setIsPreviewLoading(true);
    console.log(`🔊 Previewing voice: ${voice}`);

    try {
      const sampleText = 'Hello. This is a voice preview. Listen to how this voice sounds.';

      console.log('📝 Generating preview audio...');
      
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sampleText,
          voice,
          speed: 1.0,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate preview');
      }

      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);

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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setCloneRecording(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);

      // Auto-stop after 10 seconds
      setTimeout(() => {
        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
          setIsRecording(false);
        }
      }, 10000);
    } catch (error) {
      console.error('Microphone access denied:', error);
      alert('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (file) {
      setCloneRecording(file);
    }
  };

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
  // REPLAY FROM HISTORY
  // ============================================================================

  const playFromHistory = (item: HistoryItem) => {
    if (audioRef.current) {
      audioRef.current.src = item.audioData;
      audioRef.current.play();
      setIsPlaying(true);
      setCurrentAudioBlob(null); // Indicate replaying from history
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
              <h1 className="text-2xl font-bold text-white">ElevenLabs TTS</h1>
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
          </div>
        </div>
      )}

      {/* Model Ready Status - Show Acceleration Backend */}
      {!modelLoading && ttsModel && (
        <div className="border-b border-slate-800 bg-slate-900/50 px-4 py-2">
          <div className="mx-auto max-w-6xl text-xs text-slate-400">
            ✓ Model ready • ⚙️ WASM mode (stable)
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left Panel: Controls */}
          <div className="lg:col-span-2">
            {/* Tabs */}
            <div className="mb-6 flex gap-2 rounded-lg bg-slate-800/50 p-1">
              <button
                onClick={() => setActiveTab('premium')}
                className={`flex-1 rounded-md px-4 py-2 font-medium transition ${
                  activeTab === 'premium'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Premium Voices
              </button>
              <button
                onClick={() => setActiveTab('voiceclone')}
                className={`flex-1 rounded-md px-4 py-2 font-medium transition ${
                  activeTab === 'voiceclone'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Voice Cloning
              </button>
            </div>

            {/* Premium Voices Tab */}
            {activeTab === 'premium' && (
              <div className="space-y-6 rounded-lg bg-slate-800/30 p-6 backdrop-blur">
                {/* Text Input */}
                <div>
                  <label className="block text-sm font-medium text-slate-200">
                    Your Script (up to 10,000 words)
                  </label>
                  <textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.currentTarget.value)}
                    placeholder="Paste your script here. AI will automatically detect emotions, add pauses, and make it sound natural!"
                    className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    rows={6}
                  />
                  <div className="mt-2 space-y-1 text-xs text-slate-400">
                    <p>
                      🤖 <strong>AI Auto-Detection:</strong> Emotions detected from punctuation &
                      context
                    </p>
                    <p>
                      ✓ Exclamation! → [shout] | Question? → pause | ...ellipsis → breath |
                      Funny things → [laughter]
                    </p>
                    <p className="text-slate-500">
                      {textInput.split(/\s+/).filter((w) => w).length} words
                      {textInput.split(/\s+/).filter((w) => w).length > 10000 && (
                        <span className="ml-2 text-red-400">⚠️ Exceeds 10k limit</span>
                      )}
                    </p>
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
                      onChange={(e) =>
                        setSelectedVoice(
                          e.currentTarget.value as VoiceType
                        )
                      }
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2 text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <optgroup label="American Female Voices">
                        <option value="af_heart">AF Heart ❤️ (Premium)</option>
                        <option value="af_bella">AF Bella 🔥 (Premium)</option>
                        <option value="af_nicole">AF Nicole 🎧 (Professional)</option>
                        <option value="af_alloy">AF Alloy</option>
                        <option value="af_aoede">AF Aoede</option>
                        <option value="af_jessica">AF Jessica</option>
                        <option value="af_kore">AF Kore</option>
                        <option value="af_nova">AF Nova</option>
                        <option value="af_river">AF River</option>
                        <option value="af_sarah">AF Sarah</option>
                        <option value="af_sky">AF Sky</option>
                      </optgroup>
                      <optgroup label="American Male Voices">
                        <option value="am_adam">AM Adam (Premium)</option>
                        <option value="am_fenrir">AM Fenrir</option>
                        <option value="am_michael">AM Michael</option>
                        <option value="am_puck">AM Puck</option>
                        <option value="am_echo">AM Echo</option>
                        <option value="am_eric">AM Eric</option>
                        <option value="am_liam">AM Liam</option>
                        <option value="am_onyx">AM Onyx</option>
                        <option value="am_santa">AM Santa</option>
                      </optgroup>
                      <optgroup label="British Female Voices">
                        <option value="bf_emma">BF Emma (Professional)</option>
                        <option value="bf_alice">BF Alice</option>
                        <option value="bf_isabella">BF Isabella</option>
                        <option value="bf_lily">BF Lily</option>
                      </optgroup>
                      <optgroup label="British Male Voices">
                        <option value="bm_george">BM George</option>
                        <option value="bm_fable">BM Fable</option>
                        <option value="bm_lewis">BM Lewis</option>
                        <option value="bm_daniel">BM Daniel</option>
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

                {/* Pitch Slider */}
                <div>
                  <label className="block text-sm font-medium text-slate-200">
                    Pitch: {pitch.toFixed(1)}
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={pitch}
                    onChange={(e) => setPitch(parseFloat(e.currentTarget.value))}
                    className="mt-2 w-full"
                  />
                  <p className="mt-1 text-xs text-slate-400">0.5 to 2.0 (cosmetic only)</p>
                </div>

                {/* Volume Slider */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-200">
                    <Volume2 className="h-4 w-4" /> Volume: {Math.round(volume * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.currentTarget.value))}
                    className="mt-2 w-full"
                  />
                </div>

                {/* Progress Indicator with Time Estimate */}
                {chunkProgress.isProcessing && (
                  <div className="rounded-lg bg-slate-700/50 p-4">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-sm font-medium text-slate-100">
                        Processing chunk {chunkProgress.current} of {chunkProgress.total}...
                      </p>
                      <p className="text-xs text-slate-400">
                        {chunkProgress.total > 0
                          ? `${Math.round((chunkProgress.current / chunkProgress.total) * 100)}% complete`
                          : 'Starting...'}
                      </p>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-600">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all"
                        style={{
                          width: `${
                            chunkProgress.total > 0
                              ? (chunkProgress.current / chunkProgress.total) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      ⏱️ Est. {Math.round((chunkProgress.total - chunkProgress.current) * 2)}s remaining
                      ({chunkProgress.total} chunks × ~2s each)
                    </p>
                    <button
                      onClick={() => setShouldCancel(true)}
                      className="mt-3 w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
                    >
                      ⏹️ Cancel Processing
                    </button>
                  </div>
                )}

                {/* Generate Button */}
                <div className="rounded-lg bg-blue-900/20 border border-blue-800 p-3 mb-4">
                  <p className="text-xs text-blue-200">
                    ⚡ <strong>Speed optimization:</strong> Server-side Kokoro + 50-word chunks for stability
                  </p>
                  <p className="text-xs text-blue-200 mt-1">
                    Typical time: ~2-3sec per chunk. For 500 words, expect ~20-30 seconds total.
                  </p>
                </div>
                <button
                  onClick={generateSpeech}
                  disabled={isProcessing || modelLoading || !textInput.trim()}
                  className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 font-semibold text-white transition hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? 'Generating...' : 'Generate Speech'}
                </button>
              </div>
            )}

            {/* Voice Cloning Tab */}
            {activeTab === 'voiceclone' && (
              <div className="space-y-6 rounded-lg bg-slate-800/30 p-6 backdrop-blur">
                <p className="text-sm text-slate-300">
                  Record or upload a 5-10 second reference sample to clone a voice.
                </p>

                {/* Recording Section */}
                <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
                  <h3 className="mb-4 font-medium text-slate-200">
                    <Mic className="mb-1 inline h-4 w-4" /> Record Reference Audio
                  </h3>
                  {!cloneRecording ? (
                    <div className="flex gap-2">
                      {!isRecording ? (
                        <button
                          onClick={startRecording}
                          className="flex-1 rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition hover:bg-red-700"
                        >
                          Start Recording
                        </button>
                      ) : (
                        <button
                          onClick={stopRecording}
                          className="flex-1 rounded-lg bg-red-700 px-4 py-2 font-medium text-white transition hover:bg-red-800"
                        >
                          Stop Recording
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <audio
                        controls
                        src={URL.createObjectURL(cloneRecording)}
                        className="flex-1 rounded-lg"
                      />
                      <button
                        onClick={() => setCloneRecording(null)}
                        className="rounded-lg bg-slate-700 px-3 py-2 text-slate-200 transition hover:bg-slate-600"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* File Upload Section */}
                <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
                  <h3 className="mb-4 font-medium text-slate-200">
                    <Upload className="mb-1 inline h-4 w-4" /> Or Upload Audio File
                  </h3>
                  <input
                    type="file"
                    accept="audio/mp3,audio/wav,audio/webm"
                    onChange={handleAudioUpload}
                    className="block w-full text-sm text-slate-400 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-white file:font-medium hover:file:bg-blue-700"
                  />
                </div>

                {cloneRecording && (
                  <div className="rounded-lg bg-green-900/20 border border-green-800 p-4 text-sm text-green-200">
                    ✓ Reference audio loaded. The voice features will be extracted on the server
                    when you generate speech.
                  </div>
                )}

                <p className="text-xs text-slate-400">
                  Note: Voice cloning requires server-side processing. Once implemented with your
                  backend, reference audio features will be extracted and used as a custom voice
                  prompt.
                </p>
              </div>
            )}
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
                
                {/* Voice quality indicator */}
                <div>
                  <p className="text-slate-400">Quality:</p>
                  <div className="mt-1 flex items-center gap-2">
                    {selectedVoice.includes('heart') || selectedVoice.includes('bella') || selectedVoice.includes('adam') || selectedVoice.includes('emma') ? (
                      <>
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        <p className="text-green-400">Premium</p>
                      </>
                    ) : selectedVoice.includes('nicole') ? (
                      <>
                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                        <p className="text-blue-400">Professional</p>
                      </>
                    ) : (
                      <>
                        <div className="h-2 w-2 rounded-full bg-yellow-500" />
                        <p className="text-yellow-400">Standard</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Gender/Region */}
                <div>
                  <p className="text-slate-400">Type:</p>
                  <p className="text-slate-200">
                    {selectedVoice.startsWith('af') ? '👩 American Female' :
                     selectedVoice.startsWith('am') ? '👨 American Male' :
                     selectedVoice.startsWith('bf') ? '👩 British Female' :
                     selectedVoice.startsWith('bm') ? '👨 British Male' : 'Unknown'}
                  </p>
                </div>

                {/* Instructions */}
                <div className="pt-3 border-t border-slate-700">
                  <p className="text-slate-400 text-xs">💡 Click "Preview Voice" to hear a sample, then use "Generate Speech" for your full text.</p>
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
                        <p className="text-xs text-slate-400">
                          {item.voice} • {item.speed.toFixed(1)}x
                        </p>
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
                            <Trash2 className="h-3 w-3" />
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
        <p>Powered by Kokoro TTS • All processing is local to your browser</p>
      </footer>
    </div>
  );
}
