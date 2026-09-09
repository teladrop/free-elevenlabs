import { NextRequest, NextResponse } from 'next/server';

function encodeWAV(samples: Float32Array, sampleRate: number): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = samples.length * 2;
  const bufferSize = 44 + dataSize;
  const buffer = Buffer.alloc(bufferSize);
  let offset = 0;

  buffer.write('RIFF', offset); offset += 4;
  buffer.writeUInt32LE(36 + dataSize, offset); offset += 4;
  buffer.write('WAVE', offset); offset += 4;
  buffer.write('fmt ', offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4;
  buffer.writeUInt16LE(1, offset); offset += 2;
  buffer.writeUInt16LE(numChannels, offset); offset += 2;
  buffer.writeUInt32LE(sampleRate, offset); offset += 4;
  buffer.writeUInt32LE(byteRate, offset); offset += 4;
  buffer.writeUInt16LE(blockAlign, offset); offset += 2;
  buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;
  buffer.write('data', offset); offset += 4;
  buffer.writeUInt32LE(dataSize, offset); offset += 4;

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(s < 0 ? s * 0x8000 : s * 0x7fff, offset);
    offset += 2;
  }
  return buffer;
}

// Map voice names to Hugging Face TTS models
const voiceModels: Record<string, string> = {
  'en_US_1': 'espnet/kan-bayashi_ljspeech_vits',
  'en_US_2': 'espnet/kan-bayashi_ljspeech_vits',
  'en_US_3': 'espnet/kan-bayashi_ljspeech_vits',
  'en_US_4': 'espnet/kan-bayashi_ljspeech_vits',
  'en_US_5': 'espnet/kan-bayashi_ljspeech_vits',
  'en_US_6': 'espnet/kan-bayashi_ljspeech_vits',
  'en_US_7': 'espnet/kan-bayashi_ljspeech_vits',
  'en_US_8': 'espnet/kan-bayashi_ljspeech_vits',
  'en_US_9': 'espnet/kan-bayashi_ljspeech_vits',
  'en_US_10': 'espnet/kan-bayashi_ljspeech_vits',
  'en_GB_1': 'facebook/mms-tts-eng',
  'en_GB_2': 'facebook/mms-tts-eng',
  'en_GB_3': 'facebook/mms-tts-eng',
  'en_GB_4': 'facebook/mms-tts-eng',
  'en_GB_5': 'facebook/mms-tts-eng',
  'en_GB_6': 'facebook/mms-tts-eng',
  'en_AU_1': 'facebook/mms-tts-eng',
  'en_AU_2': 'facebook/mms-tts-eng',
  'en_AU_3': 'facebook/mms-tts-eng',
  'en_IN_1': 'facebook/mms-tts-eng',
  'en_IN_2': 'facebook/mms-tts-eng',
  'en_IN_3': 'facebook/mms-tts-eng',
  'en_CA_1': 'facebook/mms-tts-eng',
  'en_CA_2': 'facebook/mms-tts-eng',
  'en_NZ_1': 'facebook/mms-tts-eng',
  'en_NZ_2': 'facebook/mms-tts-eng',
};

export async function POST(request: NextRequest) {
  try {
    const { text, voice = 'en-US-AriaNeural', speed = 1.0 } = await request.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    console.log(`📝 TTS Request: text=${text.slice(0, 50)}... voice=${voice}`);

    // Try Hugging Face TTS API (completely free, no auth needed)
    try {
      console.log(`🎵 Using Hugging Face TTS (${voice})...`);
      
      // Use Facebook MMS TTS - supports 1000+ languages, fast, free
      const model = voiceModels[voice] || 'facebook/mms-tts-eng';
      
      const response = await fetch(
        `https://api-inference.huggingface.co/models/${model}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ inputs: text }),
        }
      );

      console.log('📡 HF TTS response status:', response.status);

      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        console.log('✅ Got audio from Hugging Face:', audioBuffer.byteLength, 'bytes');
        
        return new Response(audioBuffer, {
          headers: {
            'Content-Type': 'audio/wav',
            'Content-Length': audioBuffer.byteLength.toString(),
          },
        });
      } else {
        const errorText = await response.text();
        console.warn('⚠️ HF TTS failed:', response.status, errorText.substring(0, 100));
      }
    } catch (hfError) {
      console.warn('⚠️ Hugging Face TTS error:', hfError instanceof Error ? hfError.message : 'Unknown');
    }

    // Fallback: Google Translate TTS
    try {
      console.log('🎵 Fallback: Using Google Translate TTS...');
      
      const encodedText = encodeURIComponent(text);
      const response = await fetch(
        `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=en&client=tw-ob`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        }
      );

      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        console.log('✅ Got audio from Google:', audioBuffer.byteLength, 'bytes');
        
        return new Response(audioBuffer, {
          headers: {
            'Content-Type': 'audio/mpeg',
            'Content-Length': audioBuffer.byteLength.toString(),
          },
        });
      }
    } catch (googleError) {
      console.warn('⚠️ Google TTS error:', googleError instanceof Error ? googleError.message : 'Unknown');
    }

    // Last resort: Return error
    return NextResponse.json(
      { error: 'All TTS services unavailable. Please try again later.' },
      { status: 503 }
    );
  } catch (error) {
    console.error('❌ API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
